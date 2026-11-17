import { readdir, readFile } from 'node:fs/promises';
import { pool, read, rows, run } from './db.js';

// Menjalankan semua file migrations/NNN_nama.sql yang belum tercatat di schema_migrations, berurutan.
const dir = new URL('../migrations/', import.meta.url);

try {
  await read(async db => {
    await db.query("SET time_zone = '+07:00'");
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const files = (await readdir(dir)).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const applied = await rows<{ version: string }>(db, 'SELECT version FROM schema_migrations WHERE version=?', [version]);
      if (applied.length) { console.log(`${version} sudah diterapkan`); continue; }
      const sql = await readFile(new URL(file, dir), 'utf8');
      // DDL MySQL auto-commit. Jika gagal, periksa perubahan parsial sebelum menjalankan ulang.
      for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await db.query(statement);
      await run(db, 'INSERT INTO schema_migrations(version) VALUES(?)', [version]);
      console.log(`Migrasi ${version} selesai`);
    }
  });
} finally { await pool.end(); }
