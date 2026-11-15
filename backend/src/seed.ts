import bcrypt from 'bcrypt';
import { password } from './core.js';
import { pool, transaction, rows, run } from './db.js';

try {
  const accounts = [
    { name: 'Admin Dream Space', username: 'admin', role: 'ADMIN', value: process.env.SEED_ADMIN_PASSWORD },
    { name: 'Owner Dream Space', username: 'owner', role: 'OWNER', value: process.env.SEED_OWNER_PASSWORD },
  ];
  for (const account of accounts) {
    const hash = await bcrypt.hash(password.parse(account.value), 12);
    await transaction(async db => {
      if ((await rows(db, 'SELECT id FROM users WHERE role=?', [account.role])).length) {
        console.log(`${account.role}: sudah ada, sandi tidak diubah`); return;
      }
      await run(db, 'INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)',
        [account.name, account.username, hash, account.role]);
      console.log(`${account.role}: dibuat; wajib ganti sandi saat login pertama`);
    });
  }
} finally { await pool.end(); }
