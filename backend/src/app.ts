import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError } from './core.js';
import { read, one } from './db.js';
import { auth, authenticate, requireChangedPassword } from './auth.js';
import { catalog } from './catalog.js';
import { operations } from './operations.js';
import { reports } from './reports.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.FRONTEND_ORIGIN, methods: ['GET','POST','PUT','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '128kb' }));
app.use((_req,res,next) => { res.setHeader('X-Request-Id',randomUUID()); res.setHeader('Cache-Control','no-store'); next(); });
app.get('/health/live', (_req,res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req,res) => {
  await read(db => one(db,'SELECT 1 AS healthy')); res.json({ status: 'ok', database: 'connected' });
});
app.use('/api/auth',auth);
app.use('/api',authenticate,requireChangedPassword,catalog,reports,operations);
app.use((_req,_res,next) => next(new AppError(404,'ROUTE_NOT_FOUND','Endpoint tidak ditemukan')));
interface DatabaseError extends Error { code?: string; status?: number }
const errors: ErrorRequestHandler = (error: DatabaseError, _req,res,_next) => {
  if (res.headersSent) { res.destroy(error); return; }
  const requestId = res.getHeader('X-Request-Id');
  if (error instanceof ZodError) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Periksa isian permintaan', details: error.issues, request_id: requestId } }); return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, request_id: requestId } }); return;
  }
  if (error.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: { code: 'DUPLICATE_VALUE', message: 'Nilai unik sudah digunakan; periksa kode, nama, atau referensi pembayaran', request_id: requestId } }); return;
  }
  if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT') {
    res.status(503).json({ error: { code: 'BUSY', message: 'Data sedang diproses; ulangi dengan request ID yang sama', request_id: requestId } }); return;
  }
  if (error instanceof SyntaxError && error.status === 400) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON tidak valid', request_id: requestId } }); return;
  }
  if (error.status === 413) {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Body request maksimal 128 KB', request_id: requestId } }); return;
  }
  // Log tanpa SQL, payload, token, atau kata sandi.
  console.error(JSON.stringify({ request_id: requestId, name: error.name, code: error.code ?? 'INTERNAL_ERROR' }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Operasi gagal; sampaikan request_id kepada pengelola', request_id: requestId } });
};
app.use(errors);
