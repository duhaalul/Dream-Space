import mysql, { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from './config.js';
import { AppError, type Actor, type Json } from './core.js';

export const pool = mysql.createPool({ host: config.DB_HOST, port: config.DB_PORT, database: config.DB_NAME,
  user: config.DB_USER, password: config.DB_PASSWORD, connectionLimit: 10,
  timezone: '+07:00', dateStrings: true, supportBigNumbers: true, decimalNumbers: true,
  multipleStatements: false });
export type Db = PoolConnection;
type Value = string | number | boolean | null;
export async function rows<T extends object>(db: Db, sql: string, params: Value[] = []): Promise<T[]> {
  const [result] = await db.execute<(T & RowDataPacket)[]>(sql, params);
  return result;
}
export async function one<T extends object>(db: Db, sql: string, params: Value[] = []): Promise<T> {
  const result = (await rows<T>(db, sql, params))[0];
  if (!result) throw new AppError(404, 'NOT_FOUND', 'Data tidak ditemukan');
  return result;
}
export async function run(db: Db, sql: string, params: Value[] = []): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}
export async function read<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.getConnection();
  try { await db.query("SET time_zone = '+07:00'"); return await fn(db); } finally { db.release(); }
}
export async function snapshot<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return read(async db => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db.query('START TRANSACTION READ ONLY');
    try {
      const result = await fn(db); await db.commit(); return result;
    } catch (error) { await db.rollback(); throw error; }
  });
}
export async function transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.getConnection();
  let locked = false;
  try {
    // Satu studio, dua akun: serialisasi mutasi singkat menghindari deadlock lintas kasir/antrean.
    const lock = await one<{ acquired: number }>(db, 'SELECT GET_LOCK(?, 2) AS acquired', [`${config.DB_NAME}:write`]);
    if (lock.acquired !== 1) throw new AppError(503, 'BUSY', 'Operasi lain masih berjalan; coba lagi dengan request ID yang sama');
    locked = true;
    await db.query("SET time_zone = '+07:00'");
    await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await db.beginTransaction();
    const result = await fn(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    if (locked) await db.execute('SELECT RELEASE_LOCK(?)', [`${config.DB_NAME}:write`]);
    db.release();
  }
}
export async function audit(db: Db, actor: Actor, entity: string, entityId: number | string,
  action: string, before: Json, after: Json, reason: string | null = null): Promise<void> {
  await run(db, `INSERT INTO audit_logs(entity,entity_id,action,old_values,new_values,reason,user_id,session_id)
    VALUES(?,?,?,?,?,?,?,?)`, [entity, String(entityId), action, JSON.stringify(before), JSON.stringify(after),
    reason, actor.id, actor.sessionId]);
}
