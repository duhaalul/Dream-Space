import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { closeStaleVisits } from './operations.js';

const server = app.listen(config.PORT, () => console.log(`Dream Space API http://localhost:${config.PORT}`));

// Tutup otomatis kunjungan hari sebelumnya yang lupa ditutup: saat server menyala, lalu tiap 5 menit (menangkap pergantian hari).
async function closeStale(): Promise<void> {
  try {
    const result = await closeStaleVisits();
    if (result.cancelled || result.finished)
      console.log(`Kunjungan hari sebelumnya ditutup otomatis: ${result.cancelled} dibatalkan, ${result.finished} selesai`);
  } catch (error) { console.error('Gagal menutup kunjungan hari sebelumnya', error); }
}
void closeStale();
const closeStaleTimer = setInterval(() => void closeStale(), 5 * 60_000);
closeStaleTimer.unref();

async function shutdown(): Promise<void> {
  clearInterval(closeStaleTimer);
  server.close(async error => { await pool.end(); process.exitCode = error ? 1 : 0; });
  setTimeout(() => process.exit(1),10_000).unref();
}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
