import { z } from 'zod';
import { createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}
export function ensure(condition: boolean, code: string, message: string, status = 409): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export const money = z.number().int().min(0).max(1_000_000_000_000);
export const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const reason = z.string().trim().min(3).max(500);
export const method = z.enum(['TUNAI', 'TRANSFER', 'QRIS']);
export const date = z.iso.date();
export const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .refine(value => {
    const instant = new Date(value.replace(' ', 'T') + '+07:00');
    return Number.isFinite(instant.valueOf()) && wib(instant) === value;
  }, 'Tanggal/jam WIB tidak valid');
export const password = z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
  'Kata sandi maksimal 72 byte UTF-8 karena bcrypt');
export function wib(instant = new Date()): string {
  return new Date(instant.getTime() + 7 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
}
export function today(): string { return wib().slice(0, 10); }
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export function fingerprint(payload: object): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
export type Role = 'ADMIN' | 'OWNER';
export interface Actor { id: number; role: Role; sessionId: string; mustChangePassword: boolean }
export type PriceType = 'PER_SESI' | 'PER_ORANG' | 'PER_KELOMPOK';
export function priceLines(type: PriceType, price: number, persons: number, included: number | null,
  extra: number | null): { baseQty: number; extraQty: number; total: number } {
  const baseQty = type === 'PER_ORANG' ? persons : 1;
  const extraQty = type === 'PER_ORANG' || included === null ? 0 : Math.max(persons - included, 0);
  const total = baseQty * price + extraQty * (extra ?? 0);
  ensure(Number.isSafeInteger(total) && total <= 1_000_000_000_000, 'AMOUNT_LIMIT', 'Total melebihi batas nominal', 422);
  return { baseQty, extraQty, total };
}
