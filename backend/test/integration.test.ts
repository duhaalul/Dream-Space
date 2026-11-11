import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { pool, read, run, rows } from '../src/db.js';
import { wib, today } from '../src/core.js';

const numeric = z.number();
const viewSchema = z.object({
  visit: z.object({ id: numeric, version: numeric, status: z.string(), queue_number: numeric.nullable(), package_id: numeric.nullable() }),
  transaction: z.object({ id: numeric, version: numeric, total: numeric, payment_status: z.string() }),
  balance: z.object({ paid: numeric, refunded: numeric, net: numeric, due: numeric, surplus: numeric }),
  items: z.array(z.object({ id: numeric, item_type: z.string(), unit_price: numeric, qty: numeric, is_active: numeric })),
  payments: z.array(z.object({ id: numeric, amount: numeric, change_amount: numeric.nullable(), cash_received: numeric.nullable() })),
});
type View = z.infer<typeof viewSchema>;
let admin = ''; let owner = ''; let pkg = 0; let cheap = 0; let addon = 0;
const initial = 'Initial-Dream-Password-123';
const permanent = 'Permanent-Dream-Password-456';
function auth(token = admin) { return { Authorization: `Bearer ${token}` }; }
async function login(username: string, secret: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ username,password: secret }).expect(200);
  return z.object({ token: z.string() }).parse(response.body).token;
}
async function view(visitId: number): Promise<View> {
  return viewSchema.parse((await request(app).get(`/api/visits/${visitId}`).set(auth()).expect(200)).body);
}
async function register(packageId = pkg): Promise<View> {
  const response = await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),
    customer_name: 'Pelanggan Uji',customer_type: 'WALK_IN',package_id: packageId,persons: 2 }).expect(201);
  return viewSchema.parse(response.body);
}
async function action(v: View, type: string, reason = 'Keperluan pengujian'): Promise<View> {
  const response = await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth())
    .send({ version: v.visit.version,action: type,reason }).expect(200);
  return viewSchema.parse(response.body);
}
before(async () => {
  assert.equal(config.NODE_ENV,'test','Integration test hanya boleh dijalankan dengan NODE_ENV=test');
  assert.match(config.DB_NAME,/_test$/,'Gunakan database khusus berakhiran _test');
  await read(async db => {
    const tables = await rows<{ TABLE_NAME: string }>(db,'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=?',[config.DB_NAME]);
    if (tables.length) {
      assert.equal(process.env['TEST_RESET'],'1','Database test harus kosong atau TEST_RESET=1 untuk reset eksplisit');
      await db.query('SET FOREIGN_KEY_CHECKS=0');
      for (const table of tables) {
        assert.match(table.TABLE_NAME,/^[a-z_]+$/);
        await db.query(`DROP TABLE \`${table.TABLE_NAME}\``);
      }
      await db.query('SET FOREIGN_KEY_CHECKS=1');
    }
    await db.query("SET time_zone='+07:00'");
    const sql = await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
    const hash = await bcrypt.hash(initial,12);
    await run(db,'INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?),(?,?,?,?)',
      ['Admin','admin',hash,'ADMIN','Owner','owner',hash,'OWNER']);
  });
  admin = await login('admin',initial); owner = await login('owner',initial);
  await request(app).get('/api/packages').set(auth()).expect(403);
  for (const token of [admin,owner]) await request(app).post('/api/auth/change-password').set(auth(token))
    .send({ current_password: initial,new_password: permanent }).expect(200);
  await request(app).get('/api/auth/me').set(auth()).expect(401);
  admin = await login('admin',permanent); owner = await login('owner',permanent);
  for (const [name,code,price] of [['Reguler','RG',100000],['Ekonomis','EK',60000]] as const) {
    const response = await request(app).post('/api/packages').set(auth(owner))
      .send({ name,queue_code: code,price_type: 'PER_SESI',price }).expect(201);
    const packageId = z.object({ id: numeric }).parse(response.body).id;
    if (code === 'RG') pkg = packageId; else cheap = packageId;
  }
  addon = z.object({ id: numeric }).parse((await request(app).post('/api/addons').set(auth(owner))
    .send({ name: 'Cetak tambahan',price: 10000,unit: 'lembar' }).expect(201)).body).id;
  await request(app).put(`/api/packages/${pkg}/addons`).set(auth(owner)).send({ addon_ids: [addon] }).expect(200);
});
after(async () => { await pool.end(); });

test('RBAC, username unik, validasi latar dan paket', async () => {
  await request(app).post('/api/packages').set(auth()).send({}).expect(403);
  await request(app).post('/api/visits').set(auth(owner)).send({}).expect(403);
  await request(app).get('/api/dashboard').set(auth()).expect(403);
  await request(app).get('/api/packages').expect(401);
  await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Tanpa Paket',customer_type: 'WALK_IN' }).expect(422);
  const background = z.object({ id: numeric }).parse((await request(app).post(`/api/packages/${cheap}/backgrounds`).set(auth(owner))
    .send({ name: 'Putih',max_persons: 2 }).expect(201)).body).id;
  await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Beda paket',customer_type: 'WALK_IN',
    package_id: pkg,background_id: background,persons: 2 }).expect(422);
  await request(app).put(`/api/backgrounds/${background}`).set(auth(owner)).send({ name: 'Putih',max_persons: 2,is_active: false }).expect(200);
});
test('pendaftaran dan pembayaran concurrent idempotent; payload beda ditolak', async () => {
  const input = { client_request_id: randomUUID(),customer_name: 'Retry',customer_type: 'WALK_IN',package_id: pkg,persons: 2 };
  const pair = await Promise.all([1,2].map(() => request(app).post('/api/visits').set(auth()).send(input)));
  pair.forEach(p => assert.equal(p.status,201,JSON.stringify(p.body)));
  const a = viewSchema.parse(pair[0]!.body); const b = viewSchema.parse(pair[1]!.body);
  assert.equal(a.visit.id,b.visit.id);
  await request(app).post('/api/visits').set(auth()).send({ ...input,customer_name: 'Berbeda' }).expect(409);
  const payment = { client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TUNAI',amount: 120000 };
  const paid = await Promise.all([1,2].map(() => request(app).post(`/api/transactions/${a.transaction.id}/payments`).set(auth()).send(payment)));
  paid.forEach(p => assert.equal(p.status,201,JSON.stringify(p.body)));
  const result = viewSchema.parse(paid[1]!.body);
  assert.equal(result.balance.paid,100000); assert.equal(result.payments.length,1); assert.equal(result.payments[0]?.change_amount,20000);
  await request(app).post(`/api/transactions/${a.transaction.id}/payments`).set(auth()).send({ ...payment,amount: 1 }).expect(409);
  await action(result,'CANCEL');
});
test('nomor unik dan satu ruangan tidak dapat dipanggil dua komputer', async () => {
  const pair = await Promise.all([register(),register()]); const a = pair[0]!; const b = pair[1]!;
  assert.notEqual(a.visit.queue_number,b.visit.queue_number);
  const calls = await Promise.all(pair.map(v => request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth())
    .send({ version: v.visit.version,action: 'CALL',reason: 'Uji dua komputer' })));
  assert.deepEqual(calls.map(c => c.status).sort(),[200,409]);
  for (const v of pair) await action(await view(v.visit.id),'CANCEL');
});
test('foto wajib lunas di awal; tambahan saat sesi dibayar di akhir; finish gagal rollback', async () => {
  let v = await action(await register(),'CALL');
  const unpaid = await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth())
    .send({ version: v.visit.version,action: 'START' }).expect(409);
  assert.equal(z.object({ error: z.object({ code: z.string() }) }).parse(unpaid.body).error.code,'PAYMENT_REQUIRED_BEFORE_START');
  v = viewSchema.parse((await request(app).post(`/api/transactions/${v.transaction.id}/payments`).set(auth())
    .send({ client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TUNAI',amount: 100000 }).expect(201)).body);
  v = await action(v,'START');
  const finish = { version: v.visit.version,transaction_version: v.transaction.version,persons: 3,
    addons: [{ addon_id: addon,qty: 2 }],reason: 'Tambahan cetak selama sesi' };
  await request(app).post(`/api/visits/${v.visit.id}/finish`).set(auth()).send(finish).expect(409);
  const after = await view(v.visit.id); assert.equal(after.transaction.total,100000); assert.equal(after.visit.version,v.visit.version);
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'CANCEL',reason: 'Tidak jadi' }).expect(409);
  await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(409);
  v = viewSchema.parse((await request(app).post(`/api/visits/${v.visit.id}/finish`).set(auth()).send({ ...finish,
    payment: { client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TUNAI',amount: 50000 } }).expect(200)).body);
  assert.equal(v.visit.status,'SELESAI'); assert.equal(v.transaction.total,120000); assert.equal(v.balance.net,120000);
  assert.equal(v.payments.length,2); assert.equal(v.payments[1]?.amount,20000); assert.equal(v.payments[1]?.change_amount,30000);
  const pdf = await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(200);
  assert.match(pdf.headers['content-type'] as string,/application\/pdf/);
  assert.ok(Buffer.isBuffer(pdf.body)); assert.ok(pdf.body.subarray(0,5).equals(Buffer.from('%PDF-')));
  // Koreksi selesai harus tetap seimbang, tidak membuka kembali sesi atau menghapus pembayaran.
  const payment = v.payments[0]!;
  await request(app).post(`/api/transactions/${v.transaction.id}/corrections`).set(auth()).send({ version: v.transaction.version,reason: 'Koreksi nominal salah',
    payments: [{ id: payment.id,method: 'TUNAI',amount: 1,cash_received: 1,paid_at: wib(),reference: null }] }).expect(409);
  const corrected = await request(app).post(`/api/transactions/${v.transaction.id}/corrections`).set(auth()).send({ version: v.transaction.version,
    reason: 'Salah metode pembayaran',payments: [{ id: payment.id,method: 'TRANSFER',amount: 100000,cash_received: null,paid_at: wib(),reference: 'TEST-CORRECTION' }] }).expect(200);
  assert.equal(viewSchema.parse(corrected.body).visit.status,'SELESAI');
  const logs = await request(app).get(`/api/transactions/${v.transaction.id}/audit`).set(auth(owner)).expect(200);
  assert.ok(z.array(z.object({ action: z.string() })).parse(logs.body).some(l => l.action === 'CORRECTION'));
});
test('DP tanpa paket, konfirmasi janji, pindah paket dan refund idempotent', async () => {
  let v = viewSchema.parse((await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Reservasi DP',
    customer_type: 'RESERVASI',appointment_at: `${today()} 00:00:00`, payment: { client_request_id: randomUUID(),payment_type: 'DP',method: 'TRANSFER',
      amount: 150000,reference: 'TEST-DP-001' } }).expect(201)).body);
  assert.equal(v.visit.queue_number,null); assert.equal(v.transaction.payment_status,'BELUM_LUNAS'); assert.equal(v.balance.surplus,0);
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'CONFIRM' }).expect(422);
  v = viewSchema.parse((await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: pkg,persons: 2,reason: 'Pelanggan memilih paket' }).expect(200)).body);
  v = await action(v,'CONFIRM'); const number = v.visit.queue_number;
  v = viewSchema.parse((await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: cheap,persons: 2,reason: 'Pindah paket lebih murah' }).expect(200)).body);
  assert.equal(v.transaction.total,60000); assert.equal(v.balance.surplus,90000); assert.ok(number);
  const refund = { client_request_id: randomUUID(),amount: 90000,method: 'TRANSFER',reason: 'Kelebihan setelah pindah paket' };
  const responses = await Promise.all([1,2].map(() => request(app).post(`/api/transactions/${v.transaction.id}/refunds`).set(auth()).send(refund)));
  responses.forEach(r => assert.equal(r.status,201,JSON.stringify(r.body)));
  v = viewSchema.parse(responses[0]!.body); assert.equal(v.balance.refunded,90000);
  await request(app).post(`/api/transactions/${v.transaction.id}/refunds`).set(auth()).send({ ...refund,client_request_id: randomUUID(),amount: 1 }).expect(409);
  v = await action(v,'CANCEL'); assert.equal(v.transaction.total,60000); assert.equal(v.balance.net,60000);
  await request(app).post(`/api/transactions/${v.transaction.id}/refunds`).set(auth()).send({ ...refund,client_request_id: randomUUID(),amount: 1 }).expect(409);
});
test('snapshot tarif lama, perubahan orang dan skip kembali', async () => {
  let v = await register();
  await request(app).put(`/api/packages/${pkg}`).set(auth(owner)).send({ name: 'Reguler Baru',queue_code: 'RG',price_type: 'PER_SESI',price: 200000 }).expect(200);
  v = viewSchema.parse((await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: pkg,persons: 3,reason: 'Jumlah orang berubah' }).expect(200)).body);
  assert.equal(v.transaction.total,100000);
  v = await action(await action(v,'CALL'),'SKIP'); v = await action(v,'RETURN'); assert.equal(v.visit.status,'MENUNGGU');
  const stale = await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: 1,action: 'CALL' }); assert.equal(stale.status,409);
  await action(v,'CANCEL');
});
test('laporan, PDF dan XLSX memakai sumber data transaksi', async () => {
  const dashboard = await request(app).get('/api/dashboard').set(auth(owner)).expect(200);
  assert.equal(z.object({ sales: z.number() }).parse(dashboard.body).sales,120000);
  for (const code of ['sales','packages','cash','visits']) {
    const response = await request(app).get(`/api/reports/${code}`).set(auth(owner)).expect(200);
    assert.ok(z.object({ rows: z.array(z.record(z.string(),z.union([z.string(),z.number(),z.null()]))) }).parse(response.body).rows.length);
    const pdf = await request(app).get(`/api/reports/${code}?format=pdf`).set(auth(owner)).expect(200);
    assert.ok(Buffer.isBuffer(pdf.body));
    const xlsx = await request(app).get(`/api/reports/${code}?format=xlsx`).set(auth(owner)).buffer(true).parse((response,callback) => {
      const chunks: Buffer[] = []; response.on('data',(chunk: Buffer) => chunks.push(chunk));
      response.on('end',() => callback(null,Buffer.concat(chunks))); response.on('error',callback);
    }).expect(200);
    assert.ok(Buffer.isBuffer(xlsx.body));
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.read(Readable.from([xlsx.body])); assert.ok(workbook.worksheets[0]!.rowCount > 1);
  }
});
test('prioritas reservasi, alasan keluar urutan, ruangan ditutup, dan jam janji', async () => {
  let regular = await register();
  let reservation = viewSchema.parse((await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),
    customer_name: 'Prioritas',customer_type: 'RESERVASI',appointment_at: `${today()} 00:00:00`,package_id: pkg,persons: 2 }).expect(201)).body);
  reservation = await action(reservation,'CONFIRM');
  await request(app).post(`/api/visits/${regular.visit.id}/actions`).set(auth()).send({ version: regular.visit.version,action: 'CALL' }).expect(422);
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: false,reason: 'Istirahat sementara' }).expect(200);
  await request(app).post(`/api/visits/${reservation.visit.id}/actions`).set(auth()).send({ version: reservation.visit.version,action: 'CALL' }).expect(409);
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: true }).expect(200);
  reservation = await action(reservation,'CALL');
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: false,reason: 'Masih dipakai' }).expect(409);
  reservation = await action(reservation,'SKIP'); reservation = await action(reservation,'RETURN');
  await request(app).post(`/api/visits/${reservation.visit.id}/actions`).set(auth()).send({ version: reservation.visit.version,action: 'CALL' }).expect(422);
  regular = await action(regular,'CALL'); await action(regular,'CANCEL'); await action(reservation,'CANCEL');
  const future = new Date(); future.setTime(future.getTime()+86400_000);
  const pending = viewSchema.parse((await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),
    customer_name: 'Besok',customer_type: 'RESERVASI',appointment_at: wib(future),package_id: pkg,persons: 2 }).expect(201)).body);
  await request(app).post(`/api/visits/${pending.visit.id}/actions`).set(auth()).send({ version: pending.visit.version,action: 'CONFIRM' }).expect(409);
  await action(pending,'CANCEL');
});
test('paket dinonaktifkan tidak merusak snapshot kunjungan lama; tagihan nol bisa selesai', async () => {
  const free = z.object({ id: numeric }).parse((await request(app).post('/api/packages').set(auth(owner))
    .send({ name: 'Uji nol',queue_code: 'FREE',price_type: 'PER_SESI',price: 0 }).expect(201)).body).id;
  let v = await register(free);
  await request(app).put(`/api/packages/${free}`).set(auth(owner)).send({ name: 'Uji nol berubah',queue_code: 'FREE',
    price_type: 'PER_SESI',price: 99999,is_active: false }).expect(200);
  await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Baru',customer_type: 'WALK_IN',package_id: free,persons: 2 }).expect(422);
  v = await action(await action(v,'CALL'),'START');
  v = viewSchema.parse((await request(app).post(`/api/visits/${v.visit.id}/finish`).set(auth()).send({ version: v.visit.version,
    transaction_version: v.transaction.version,persons: 2,addons: [] }).expect(200)).body);
  assert.equal(v.transaction.total,0); assert.equal(v.transaction.payment_status,'TIDAK_ADA_TAGIHAN');
});
test('dua pembayaran berbeda tidak dapat melunasi saldo yang sama dua kali', async () => {
  let v = await register();
  const responses = await Promise.all([1,2].map(() => request(app).post(`/api/transactions/${v.transaction.id}/payments`).set(auth())
    .send({ client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TRANSFER',amount: 200000 })));
  assert.deepEqual(responses.map(r => r.status).sort(),[201,409]);
  v = await view(v.visit.id); assert.equal(v.balance.net,200000); assert.equal(v.payments.length,1);
  await action(v,'CANCEL');
});
test('tanggal uang masuk berbeda dengan tanggal layanan; DP nontunai wajib referensi', async () => {
  const yesterday = new Date(Date.now()-86400_000); const paidAt = wib(yesterday);
  const input = { client_request_id: randomUUID(),customer_name: 'DP kemarin',customer_type: 'RESERVASI',appointment_at: `${today()} 00:00:00`,
    payment: { client_request_id: randomUUID(),payment_type: 'DP',method: 'QRIS',amount: 25000,paid_at: paidAt } };
  await request(app).post('/api/visits').set(auth()).send(input).expect(422);
  const v = viewSchema.parse((await request(app).post('/api/visits').set(auth()).send({ ...input,payment: { ...input.payment,reference: 'DP-KEMARIN' } }).expect(201)).body);
  const response = await request(app).get(`/api/reports/cash?period=custom&from=${paidAt.slice(0,10)}&to=${paidAt.slice(0,10)}`).set(auth(owner)).expect(200);
  const data = z.object({ rows: z.array(z.object({ cash_in: z.number() })) }).parse(response.body);
  assert.equal(data.rows.reduce((sum,r) => sum+r.cash_in,0),25000);
  await action(v,'CANCEL');
});
test('pembayaran sebagian belum boleh mulai; addon tercatat saat berjalan boleh terutang hingga akhir', async () => {
  let v = await action(await register(),'CALL');
  async function pay(amount: number): Promise<View> {
    return viewSchema.parse((await request(app).post(`/api/transactions/${v.transaction.id}/payments`).set(auth())
      .send({ client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TRANSFER',amount }).expect(201)).body);
  }
  v = await pay(50000);
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'START' }).expect(409);
  v = await pay(150000); v = await action(v,'START');
  v = viewSchema.parse((await request(app).put(`/api/transactions/${v.transaction.id}/addons`).set(auth()).send({
    version: v.transaction.version,addons: [{ addon_id: addon,qty: 1 }],reason: 'Tambah cetak saat sesi berlangsung' }).expect(200)).body);
  assert.equal(v.visit.status,'SEDANG_DILAYANI'); assert.equal(v.transaction.payment_status,'BELUM_LUNAS'); assert.equal(v.balance.due,10000);
  const finish = { version: v.visit.version,transaction_version: v.transaction.version,persons: 2,addons: [{ addon_id: addon,qty: 1 }] };
  await request(app).post(`/api/visits/${v.visit.id}/finish`).set(auth()).send(finish).expect(409);
  v = viewSchema.parse((await request(app).post(`/api/visits/${v.visit.id}/finish`).set(auth()).send({ ...finish,
    payment: { client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TRANSFER',amount: 10000 } }).expect(200)).body);
  assert.equal(v.visit.status,'SELESAI'); assert.equal(v.balance.net,210000);
});
test('reset password mencabut semua sesi, idle 30 menit ditolak', async () => {
  const second = await login('admin',permanent);
  await request(app).post('/api/auth/reset-admin-password').set(auth(owner)).send({ temporary_password: initial }).expect(200);
  await request(app).get('/api/auth/me').set(auth(second)).expect(401);
  await request(app).get('/api/auth/me').set(auth()).expect(401);
  admin = await login('admin',initial);
  await request(app).get('/api/packages').set(auth()).expect(403);
  await request(app).post('/api/auth/change-password').set(auth()).send({ current_password: initial,new_password: permanent }).expect(200);
  admin = await login('admin',permanent);
  await read(db => run(db,"UPDATE sessions SET last_activity_at=DATE_SUB(NOW(),INTERVAL 31 MINUTE) WHERE user_id=(SELECT id FROM users WHERE role='ADMIN')"));
  await request(app).get('/api/auth/me').set(auth()).expect(401);
});
