import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { AppError, ensure, password, type Actor, type Role } from './core.js';
import { read, transaction, rows, one, run, audit } from './db.js';

declare global {
  namespace Express { interface Request { actor?: Actor } }
}
export function actorOf(req: Express.Request): Actor {
  if (!req.actor) throw new AppError(401, 'UNAUTHENTICATED', 'Silakan login');
  return req.actor;
}
interface Account { id: number; name: string; username: string; password_hash: string; role: Role; must_change_password: number }
const dummyPasswordHash = await bcrypt.hash(randomUUID(),12);
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Bearer token diperlukan');
  let sessionId: string;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'dream-space', audience: 'dream-space-web' });
    ensure(typeof payload !== 'string', 'INVALID_TOKEN', 'Token tidak valid', 401);
    sessionId = z.uuid().parse(payload['sid']);
  } catch { throw new AppError(401, 'INVALID_TOKEN', 'Token tidak valid atau kedaluwarsa; login ulang'); }
  req.actor = await transaction(async db => {
    const result = await rows<Account>(db, `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=? AND s.revoked_at IS NULL AND s.last_activity_at > DATE_SUB(NOW(3),INTERVAL 30 MINUTE) FOR UPDATE`, [sessionId]);
    const account = result[0];
    if (!account) throw new AppError(401, 'SESSION_EXPIRED', 'Sesi berakhir; login ulang');
    await run(db, 'UPDATE sessions SET last_activity_at=NOW(3) WHERE id=?', [sessionId]);
    return { id: account.id, role: account.role, sessionId, mustChangePassword: !!account.must_change_password };
  });
  next();
};
export const requireChangedPassword: RequestHandler = (req, _res, next) => {
  if (actorOf(req).mustChangePassword) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Ganti kata sandi sementara terlebih dahulu');
  next();
};
export function role(required: Role): RequestHandler {
  return (req, _res, next) => {
    if (actorOf(req).role !== required) throw new AppError(403, 'FORBIDDEN', 'Akun tidak berhak menjalankan tindakan ini');
    next();
  };
}
export const auth = Router();
auth.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (_req,_res,next) => next(new AppError(429,'LOGIN_RATE_LIMIT','Terlalu banyak percobaan login; coba lagi nanti')) }), async (req, res) => {
  const input = z.strictObject({ username: z.string().trim().min(1).max(60), password: z.string().max(200) }).parse(req.body);
  const user = await read(async db => (await rows<Account>(db, 'SELECT * FROM users WHERE username=?', [input.username]))[0]);
  const valid = await bcrypt.compare(input.password, user?.password_hash ?? dummyPasswordHash);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Username atau kata sandi salah');
  const sessionId = randomUUID();
  await transaction(async db => {
    const current = await one<Account>(db, 'SELECT * FROM users WHERE id=? FOR UPDATE', [user.id]);
    ensure(current.password_hash === user.password_hash, 'CREDENTIALS_CHANGED', 'Kata sandi berubah; login ulang', 401);
    await run(db, 'INSERT INTO sessions(id,user_id,last_activity_at) VALUES(?,?,NOW(3))', [sessionId, user.id]);
    await audit(db, { id: user.id, role: user.role, sessionId, mustChangePassword: !!user.must_change_password },
      'sessions', sessionId, 'LOGIN', null, { user_id: user.id });
  });
  const token = jwt.sign({ sid: sessionId }, config.JWT_SECRET,
    { algorithm: 'HS256', issuer: 'dream-space', audience: 'dream-space-web', expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role,
    must_change_password: !!user.must_change_password } });
});
auth.use(authenticate);
auth.get('/me', async (req, res) => res.json(await read(db => one(db,
  'SELECT id,name,username,role,must_change_password FROM users WHERE id=?', [actorOf(req).id]))));
auth.post('/logout', async (req, res) => {
  const actor = actorOf(req);
  await transaction(async db => {
    await run(db, 'UPDATE sessions SET revoked_at=NOW(3) WHERE id=?', [actor.sessionId]);
    await audit(db, actor, 'sessions', actor.sessionId, 'LOGOUT', null, null);
  });
  res.status(204).end();
});
auth.post('/change-password', async (req, res) => {
  const input = z.strictObject({ current_password: z.string().max(200), new_password: password }).parse(req.body);
  const actor = actorOf(req);
  ensure(input.current_password !== input.new_password, 'SAME_PASSWORD', 'Gunakan kata sandi yang baru', 422);
  const account = await read(db => one<Account>(db, 'SELECT * FROM users WHERE id=?', [actor.id]));
  ensure(await bcrypt.compare(input.current_password, account.password_hash), 'INVALID_PASSWORD', 'Kata sandi lama salah', 401);
  const hash = await bcrypt.hash(input.new_password, 12);
  await transaction(async db => {
    const current = await one<Account>(db, 'SELECT * FROM users WHERE id=? FOR UPDATE', [actor.id]);
    ensure(current.password_hash === account.password_hash, 'CREDENTIALS_CHANGED', 'Kata sandi sudah berubah; login ulang');
    await run(db, 'UPDATE users SET password_hash=?,must_change_password=FALSE WHERE id=?', [hash, actor.id]);
    await run(db, 'UPDATE sessions SET revoked_at=NOW(3) WHERE user_id=? AND revoked_at IS NULL', [actor.id]);
    await audit(db, actor, 'users', actor.id, 'CHANGE_PASSWORD', null, null);
  });
  res.json({ message: 'Kata sandi diperbarui. Semua sesi dicabut; login kembali.' });
});
auth.patch('/profile', requireChangedPassword, async (req, res) => {
  const input = z.strictObject({ name: z.string().trim().min(1).max(100) }).parse(req.body);
  const actor = actorOf(req);
  await transaction(async db => {
    const old = await one<{ name: string }>(db, 'SELECT name FROM users WHERE id=?', [actor.id]);
    await run(db, 'UPDATE users SET name=? WHERE id=?', [input.name, actor.id]);
    await audit(db, actor, 'users', actor.id, 'PROFILE', { name: old.name }, { name: input.name });
  });
  res.json(input);
});
auth.post('/reset-admin-password', requireChangedPassword, role('OWNER'), async (req, res) => {
  const input = z.strictObject({ temporary_password: password }).parse(req.body);
  const hash = await bcrypt.hash(input.temporary_password, 12);
  await transaction(async db => {
    const admin = await one<{ id: number }>(db, "SELECT id FROM users WHERE role='ADMIN' FOR UPDATE");
    await run(db, 'UPDATE users SET password_hash=?,must_change_password=TRUE WHERE id=?', [hash, admin.id]);
    await run(db, 'UPDATE sessions SET revoked_at=NOW(3) WHERE user_id=? AND revoked_at IS NULL', [admin.id]);
    await audit(db, actorOf(req), 'users', admin.id, 'RESET_PASSWORD', null, { must_change_password: true });
  });
  res.json({ message: 'Sandi sementara ditetapkan dan seluruh sesi Admin dicabut.' });
});
