import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = app.listen(config.PORT, () => console.log(`Dream Space API http://localhost:${config.PORT}`));
async function shutdown(): Promise<void> {
  server.close(async error => { await pool.end(); process.exitCode = error ? 1 : 0; });
  setTimeout(() => process.exit(1),10_000).unref();
}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
