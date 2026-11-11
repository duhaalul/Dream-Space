import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { config } from './config.js';

const options = z.object({ BACKUP_DIR: z.string().min(1), MYSQLDUMP_PATH: z.string().default('mysqldump') }).parse(process.env);
const directory = resolve(options.BACKUP_DIR);
const relativePath = relative(resolve('..'),directory);
if (!relativePath.startsWith('..') && !isAbsolute(relativePath)) throw new Error('BACKUP_DIR wajib berada di luar repositori');
const temporary = await mkdtemp(join(tmpdir(),'dream-space-backup-'));
const defaults = join(temporary,'client.cnf');
const quote = (value: string): string => '"' + value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r') + '"';
try {
  await mkdir(directory,{ recursive: true });
  await writeFile(defaults,`[client]\nhost=${quote(config.DB_HOST)}\nport=${config.DB_PORT}\nuser=${quote(config.DB_USER)}\npassword=${quote(config.DB_PASSWORD)}\n`,{ mode: 0o600 });
  const output = join(directory,`${config.DB_NAME}-${new Date().toISOString().replaceAll(':','-')}.sql`);
  try {
    await promisify(execFile)(options.MYSQLDUMP_PATH,[
      `--defaults-extra-file=${defaults}`,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',`--result-file=${output}`,config.DB_NAME,
    ]);
    if ((await stat(output)).size === 0) throw new Error('Backup kosong');
    console.log(`Backup selesai: ${output}`);
  } catch (error) {
    await rm(output,{ force: true });
    const message = error instanceof Error ? error.message.replaceAll(config.DB_PASSWORD,'[REDACTED]') : 'Kegagalan proses mysqldump';
    throw new Error(`Backup gagal; periksa executable, koneksi, dan izin direktori. ${message}`);
  }
} finally { await rm(temporary,{ recursive: true,force: true }); }
