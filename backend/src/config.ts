import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/),
  DB_USER: z.string().min(1), DB_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(32),
});
export const config = schema.parse(process.env);
