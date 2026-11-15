import { readFile } from 'node:fs/promises';
import { pool, read, rows, run } from './db.js';

try {
  await read(async db => {
    await db.query("SET time_zone = '+07:00'");
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const applied = await rows<{ version: string }>(db, 'SELECT version FROM schema_migrations WHERE version=?', ['001_initial']);
    if (applied.length) { console.log('001_initial sudah diterapkan'); return; }
    const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
    // DDL MySQL auto-commit. Jika gagal, periksa tabel parsial sebelum menjalankan ulang.
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await db.query(statement);
    await run(db, 'INSERT INTO schema_migrations(version) VALUES(?)', ['001_initial']);
    console.log('Migrasi 001_initial selesai');
  });
} finally { await pool.end(); }
