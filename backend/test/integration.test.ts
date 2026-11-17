import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { pool, read, run, rows } from '../src/db.js';
import { wib, today } from '../src/core.js';
import { verifyFrontendContract } from './frontend-contract.js';
import { closeStaleVisits } from '../src/operations.js';

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
    // Semua migrasi berurutan, sama seperti src/migrate.ts.
    const dir = new URL('../migrations/',import.meta.url);
    for (const file of (await readdir(dir)).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort()) {
      const sql = await readFile(new URL(file,dir),'utf8');
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
    }
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
  // Nota tersedia sejak lunas (sebelum sesi selesai).
  await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(200);
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
test('DP tanpa paket lewat endpoint lama, pindah paket dan refund idempotent', async () => {
  let v = viewSchema.parse((await request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Reservasi DP',
    customer_type: 'RESERVASI',appointment_at: `${today()} 13:15:00`, payment: { client_request_id: randomUUID(),payment_type: 'DP',method: 'TRANSFER',
      amount: 150000,reference: 'TEST-DP-001' } }).expect(201)).body);
  assert.equal(v.visit.queue_number,null); assert.equal(v.transaction.payment_status,'BELUM_LUNAS'); assert.equal(v.balance.surplus,0);
  // Aksi CONFIRM lama sudah dihapus (diganti POST /visits/:id/check-in).
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'CONFIRM' }).expect(422);
  v = viewSchema.parse((await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: pkg,persons: 2,reason: 'Pelanggan memilih paket' }).expect(200)).body);
  v = viewSchema.parse((await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: cheap,persons: 2,reason: 'Pindah paket lebih murah' }).expect(200)).body);
  assert.equal(v.transaction.total,60000); assert.equal(v.balance.surplus,90000); assert.equal(v.visit.queue_number,null);
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
  // L-04 rekap kunjungan dan L-03 penerimaan uang dihapus; tinggal L-01 Penjualan dan L-02 Penjualan per Paket.
  await request(app).get('/api/reports/visits').set(auth(owner)).expect(422);
  await request(app).get('/api/reports/cash').set(auth(owner)).expect(422);
  // Penjualan = uang masuk per pembayaran. Dashboard, L-01, L-02, dan per metode harus sama jumlahnya.
  const sales = z.object({ rows: z.array(z.object({ paid_at: z.string(),customer_type: z.enum(['Di Tempat','Reservasi']),
    method: z.enum(['Tunai','Transfer','QRIS']),status: z.enum(['DP','Lunas','Refund']),amount: numeric })) })
    .parse((await request(app).get('/api/reports/sales').set(auth(owner)).expect(200)).body).rows;
  const perPackage = z.object({ rows: z.array(z.object({ payments: numeric,sales: numeric })) })
    .parse((await request(app).get('/api/reports/packages').set(auth(owner)).expect(200)).body).rows;
  const dashboard = z.object({ sales: numeric,dp: z.object({ count: numeric,amount: numeric }),lunas: z.object({ count: numeric,amount: numeric }),
    refund: z.object({ count: numeric,amount: numeric }),methods: z.array(z.object({ amount: numeric })) })
    .parse((await request(app).get('/api/dashboard').set(auth(owner)).expect(200)).body);
  const total = sales.reduce((sum,r) => sum+r.amount,0);
  assert.ok(sales.length); assert.equal(dashboard.sales,total);
  // Refund (tes pindah paket sebelumnya) tercatat sebagai baris minus.
  assert.ok(sales.some(r => r.status === 'Refund' && r.amount < 0));
  assert.equal(dashboard.methods.reduce((sum,m) => sum+m.amount,0),total);
  assert.equal(perPackage.reduce((sum,r) => sum+r.sales,0),total);
  assert.equal(dashboard.dp.amount+dashboard.lunas.amount-dashboard.refund.amount,total);
  assert.equal(dashboard.dp.count+dashboard.lunas.count+dashboard.refund.count,sales.length);
  for (const code of ['sales','packages']) {
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
test('panggil di luar urutan tanpa alasan, ruangan ditutup, lewati lalu kembali', async () => {
  let first = await register(); let second = await register();
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: false,reason: 'Istirahat sementara' }).expect(200);
  await request(app).post(`/api/visits/${second.visit.id}/actions`).set(auth()).send({ version: second.visit.version,action: 'CALL' }).expect(409);
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: true }).expect(200);
  // Siapa yang dipanggil keputusan Admin: pelanggan kedua boleh dipanggil lebih dulu tanpa alasan.
  second = viewSchema.parse((await request(app).post(`/api/visits/${second.visit.id}/actions`).set(auth())
    .send({ version: second.visit.version,action: 'CALL' }).expect(200)).body);
  await request(app).patch(`/api/packages/${pkg}/availability`).set(auth()).send({ is_open: false,reason: 'Masih dipakai' }).expect(409);
  await request(app).post(`/api/visits/${second.visit.id}/actions`).set(auth()).send({ version: second.visit.version,action: 'SKIP' }).expect(422);
  second = await action(second,'SKIP'); second = await action(second,'RETURN'); assert.equal(second.visit.status,'MENUNGGU');
  first = await action(first,'CALL'); await action(first,'CANCEL'); await action(second,'CANCEL');
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
test('tanggal uang masuk berbeda dengan tanggal layanan; DP nontunai tanpa referensi diterima', async () => {
  const yesterday = new Date(Date.now()-86400_000); const paidAt = wib(yesterday);
  const input = { client_request_id: randomUUID(),customer_name: 'DP kemarin',customer_type: 'RESERVASI',appointment_at: `${today()} 13:15:00`,
    payment: { client_request_id: randomUUID(),payment_type: 'DP',method: 'QRIS',amount: 25000,paid_at: paidAt } };
  const body = (await request(app).post('/api/visits').set(auth()).send(input).expect(201)).body;
  const v = viewSchema.parse(body);
  const stored = z.object({ payments: z.array(z.object({ paid_at: z.string(),reference: z.string().nullable() })) }).parse(body).payments[0];
  assert.ok(stored?.paid_at.startsWith(paidAt)); assert.equal(stored?.reference,null);
  await action(v,'CANCEL');
});
test('pembayaran sebagian belum boleh mulai; setelah lunas terkunci; FINISH menyelesaikan sesi', async () => {
  let v = await action(await register(),'CALL');
  async function pay(amount: number): Promise<View> {
    return viewSchema.parse((await request(app).post(`/api/transactions/${v.transaction.id}/payments`).set(auth())
      .send({ client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TRANSFER',amount }).expect(201)).body);
  }
  v = await pay(50000);
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'START' }).expect(409);
  v = await pay(150000); v = await action(v,'START');
  // Aturan studio: setelah lunas paket/tambahan tidak boleh diubah.
  const locked = await request(app).put(`/api/transactions/${v.transaction.id}/addons`).set(auth()).send({
    version: v.transaction.version,addons: [{ addon_id: addon,qty: 1 }],reason: 'Tambah cetak saat sesi berlangsung' }).expect(409);
  assert.equal(z.object({ error: z.object({ code: z.string() }) }).parse(locked.body).error.code,'PAID_LOCKED');
  await request(app).put(`/api/visits/${v.visit.id}/selection`).set(auth()).send({ version: v.visit.version,
    package_id: pkg,persons: 3,reason: 'Tambah orang' }).expect(409);
  v = await action(v,'FINISH');
  assert.equal(v.visit.status,'SELESAI'); assert.equal(v.balance.net,200000); assert.equal(v.transaction.payment_status,'LUNAS');
  await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'FINISH' }).expect(409);
});
test('walk-in: daftar + tambahan + bayar lunas atomik, idempoten, penjualan dicatat saat bayar', async () => {
  const salesToday = async () => z.object({ sales: z.number() }).parse((await request(app).get('/api/dashboard').set(auth(owner)).expect(200)).body).sales;
  const salesBefore = await salesToday();
  const base = { customer_name: 'Walk-in Lunas',package_id: pkg,persons: 2,addons: [{ addon_id: addon,qty: 2 }] };
  // Kurang bayar → seluruh pendaftaran dibatalkan.
  const short = await request(app).post('/api/visits/walk-in').set(auth()).send({ ...base,client_request_id: randomUUID(),
    payment: { client_request_id: randomUUID(),method: 'TRANSFER',amount: 1000 } }).expect(422);
  assert.equal(z.object({ error: z.object({ code: z.string() }) }).parse(short.body).error.code,'PAYMENT_NOT_SETTLED');
  await request(app).post('/api/visits/walk-in').set(auth()).send({ ...base,client_request_id: randomUUID() }).expect(422);
  await request(app).post('/api/visits/walk-in').set(auth(owner)).send({ ...base,client_request_id: randomUUID() }).expect(403);
  const listed = z.array(z.object({ id: numeric })).parse((await request(app).get('/api/visits?search=Walk-in%20Lunas').set(auth()).expect(200)).body);
  assert.equal(listed.length,0,'Pendaftaran kurang bayar tidak boleh tersimpan');
  // Tunai lebih → lunas + kembalian; permintaan ganda = satu kunjungan.
  const input = { ...base,client_request_id: randomUUID(),payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 500000 } };
  const pair = await Promise.all([1,2].map(() => request(app).post('/api/visits/walk-in').set(auth()).send(input)));
  pair.forEach(p => assert.equal(p.status,201,JSON.stringify(p.body)));
  const v = viewSchema.parse(pair[0]!.body); assert.equal(viewSchema.parse(pair[1]!.body).visit.id,v.visit.id);
  assert.equal(v.visit.status,'MENUNGGU'); assert.equal(v.transaction.payment_status,'LUNAS');
  assert.ok(v.items.some(i => i.item_type === 'TAMBAHAN' && i.qty === 2 && i.is_active));
  assert.equal(v.balance.net,v.transaction.total); assert.equal(v.payments.length,1);
  assert.equal(v.payments[0]?.change_amount,500000-v.transaction.total);
  await request(app).post('/api/visits/walk-in').set(auth()).send({ ...input,customer_name: 'Berbeda' }).expect(409);
  // Nota langsung tersedia; penjualan (uang masuk) sudah bertambah sebelum sesi selesai.
  await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(200);
  assert.equal(await salesToday(),salesBefore+v.transaction.total);
  // Batal setelah bayar: uang ditahan (tidak dikembalikan), jadi tetap tercatat.
  await action(v,'CANCEL');
  assert.equal(await salesToday(),salesBefore+v.transaction.total);
});
test('timer sesi: durasi paket + tambah waktu disimpan saat mulai foto', async () => {
  await request(app).post('/api/packages').set(auth(owner)).send({ name: 'Durasi Nol',queue_code: 'DN',price_type: 'PER_SESI',
    price: 1000,duration_minutes: 0 }).expect(422);
  const timed = z.object({ id: numeric }).parse((await request(app).post('/api/packages').set(auth(owner)).send({ name: 'Berdurasi',
    queue_code: 'TM',price_type: 'PER_SESI',price: 50000,duration_minutes: 15 }).expect(201)).body).id;
  const extra = z.object({ id: numeric }).parse((await request(app).post('/api/addons').set(auth(owner))
    .send({ name: 'Tambah waktu',price: 20000,unit: '5 menit',extra_minutes: 5 }).expect(201)).body).id;
  await request(app).put(`/api/packages/${timed}/addons`).set(auth(owner)).send({ addon_ids: [extra,addon] }).expect(200);
  const catalog = z.object({ packages: z.array(z.object({ id: numeric,duration_minutes: numeric.nullable() })) })
    .parse((await request(app).get('/api/packages').set(auth()).expect(200)).body);
  assert.equal(catalog.packages.find(p => p.id === timed)?.duration_minutes,15);
  const addons = z.array(z.object({ id: numeric,extra_minutes: numeric.nullable() })).parse((await request(app).get('/api/addons').set(auth()).expect(200)).body);
  assert.equal(addons.find(a => a.id === extra)?.extra_minutes,5); assert.equal(addons.find(a => a.id === addon)?.extra_minutes,null);
  const created = await request(app).post('/api/visits/walk-in').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Pelanggan Timer',
    package_id: timed,persons: 1,addons: [{ addon_id: extra,qty: 2 },{ addon_id: addon,qty: 1 }],
    payment: { client_request_id: randomUUID(),method: 'QRIS',amount: 100000 } }).expect(201);
  let v = await action(viewSchema.parse(created.body),'CALL');
  const started = await request(app).post(`/api/visits/${v.visit.id}/actions`).set(auth()).send({ version: v.visit.version,action: 'START' }).expect(200);
  // 15 menit paket + 2 × 5 menit tambah waktu; tambahan cetak tidak menambah waktu.
  assert.equal(z.object({ visit: z.object({ session_minutes: numeric }) }).parse(started.body).visit.session_minutes,25);
  const room = z.array(z.object({ package_id: numeric,session_minutes: numeric.nullable(),started_at: z.string().nullable(),
    queue_code_snapshot: z.string().nullable() })).parse((await request(app).get('/api/queue/rooms').set(auth()).expect(200)).body)
    .find(r => r.package_id === timed);
  assert.equal(room?.session_minutes,25); assert.ok(room?.started_at); assert.equal(room?.queue_code_snapshot,'TM');
  v = await action(viewSchema.parse(started.body),'FINISH');
  assert.equal(v.visit.status,'SELESAI');
  // Paket tanpa durasi: tanpa timer.
  const plain = await action(await action(await register(cheap),'CALL'),'CANCEL');
  assert.equal(plain.visit.status,'DIBATALKAN');
});
test('kunjungan hari sebelumnya yang lupa ditutup ditutup otomatis', async () => {
  const walkIn = async (name: string) => viewSchema.parse((await request(app).post('/api/visits/walk-in').set(auth()).send({
    client_request_id: randomUUID(),customer_name: name,package_id: cheap,persons: 1,
    payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 60000 } }).expect(201)).body);
  const started = await action(await action(await walkIn('Lupa Selesai'),'CALL'),'START');
  const waiting = await walkIn('Lupa Batal');
  const fresh = await walkIn('Hari Ini');
  await read(db => run(db,'UPDATE visits SET service_date=DATE_SUB(service_date,INTERVAL 1 DAY) WHERE id IN (?,?)',[started.visit.id,waiting.visit.id]));
  const salesBefore = z.object({ sales: numeric }).parse((await request(app).get(`/api/dashboard?period=custom&from=${today()}&to=${today()}`).set(auth(owner)).expect(200)).body).sales;
  assert.deepEqual(await closeStaleVisits(),{ cancelled: 1,finished: 1 });
  assert.deepEqual(await closeStaleVisits(),{ cancelled: 0,finished: 0 });
  const done = await view(started.visit.id); const gone = await view(waiting.visit.id);
  assert.equal(done.visit.status,'SELESAI'); assert.equal(gone.visit.status,'DIBATALKAN');
  assert.equal((await view(fresh.visit.id)).visit.status,'MENUNGGU');
  const reasonOf = z.object({ visit: z.object({ cancel_reason: z.string().nullable() }) });
  assert.match(reasonOf.parse((await request(app).get(`/api/visits/${waiting.visit.id}`).set(auth()).expect(200)).body).visit.cancel_reason ?? '',/^Otomatis/);
  // Uang yang dibatalkan otomatis ditahan (tidak dikembalikan); penjualan (uang masuk hari bayar) tidak berubah.
  assert.equal(gone.balance.net,60000); assert.equal(gone.balance.refunded,0);
  const salesAfter = z.object({ sales: numeric }).parse((await request(app).get(`/api/dashboard?period=custom&from=${today()}&to=${today()}`).set(auth(owner)).expect(200)).body).sales;
  assert.equal(salesAfter,salesBefore);
  const events = await read(db => rows<{ event_type: string }>(db,'SELECT event_type FROM visit_events WHERE visit_id IN (?,?) ORDER BY id',[started.visit.id,waiting.visit.id]));
  assert.ok(events.some(e => e.event_type === 'AUTO_FINISH')); assert.ok(events.some(e => e.event_type === 'AUTO_CANCEL'));
  await action(fresh,'CANCEL');
});
test('Kelola Paket: paket + latar + tambahan disimpan sekaligus dan atomik', async () => {
  const base = { name: 'Paket Popup',queue_code: 'PP',price_type: 'PER_SESI',price: 90000,max_persons: 6,duration_minutes: 20 };
  const errorOf = (body: unknown) => z.object({ error: z.object({ code: z.string(),details: z.array(z.object({ path: z.array(z.union([z.string(),numeric])) })).optional() }) }).parse(body).error;
  await request(app).post('/api/packages/setup').set(auth()).send({ package: base }).expect(403);
  // Nama latar kembar → ditolak, tidak ada yang tersimpan.
  const twin = await request(app).post('/api/packages/setup').set(auth(owner)).send({ package: base,
    backgrounds: [{ name: 'Putih' },{ name: 'putih' }],addon_ids: [addon] }).expect(422);
  assert.deepEqual(errorOf(twin.body).details?.[0]?.path,['backgrounds',1,'name']);
  const catalogSchema = z.object({ packages: z.array(z.object({ id: numeric,queue_code: z.string(),price: numeric,duration_minutes: numeric.nullable() })),
    backgrounds: z.array(z.object({ id: numeric,package_id: numeric,name: z.string(),max_persons: numeric.nullable(),is_active: numeric })),
    allowed_addons: z.array(z.object({ package_id: numeric,addon_id: numeric })) });
  const catalog = async () => catalogSchema.parse((await request(app).get('/api/packages').set(auth(owner)).expect(200)).body);
  assert.ok(!(await catalog()).packages.some(p => p.queue_code === 'PP'));
  // Buat sekaligus.
  const created = z.object({ id: numeric }).parse((await request(app).post('/api/packages/setup').set(auth(owner)).send({ package: base,
    backgrounds: [{ name: 'Putih',max_persons: 6 },{ name: 'Abu',max_persons: 4 }],addon_ids: [addon] }).expect(201)).body).id;
  let now = await catalog();
  assert.equal(now.packages.find(p => p.id === created)?.duration_minutes,20);
  const backgrounds = now.backgrounds.filter(b => b.package_id === created);
  assert.deepEqual(backgrounds.map(b => b.name).sort(),['Abu','Putih']);
  assert.deepEqual(now.allowed_addons.filter(a => a.package_id === created).map(a => a.addon_id),[addon]);
  const white = backgrounds.find(b => b.name === 'Putih')!; const grey = backgrounds.find(b => b.name === 'Abu')!;
  // Ubah sekaligus: harga, latar lama diubah/dinonaktifkan, latar baru, tambahan dikosongkan.
  await request(app).put(`/api/packages/${created}/setup`).set(auth(owner)).send({ package: { ...base,price: 95000 },
    backgrounds: [{ id: white.id,name: 'Putih Bersih',max_persons: 6 },{ id: grey.id,name: 'Abu',max_persons: 4,is_active: false },{ name: 'Hitam' }],
    addon_ids: [] }).expect(200);
  now = await catalog();
  assert.equal(now.packages.find(p => p.id === created)?.price,95000);
  assert.deepEqual(now.backgrounds.filter(b => b.package_id === created).map(b => `${b.name}:${b.is_active}`).sort(),['Abu:0','Hitam:1','Putih Bersih:1']);
  assert.equal(now.allowed_addons.filter(a => a.package_id === created).length,0);
  // Gagal di tengah (latar milik paket lain) → seluruh perubahan dibatalkan.
  const foreign = now.backgrounds.find(b => b.package_id !== created)!;
  const mismatch = await request(app).put(`/api/packages/${created}/setup`).set(auth(owner)).send({ package: { ...base,price: 1 },
    backgrounds: [{ name: 'Baru Gagal' },{ id: foreign.id,name: foreign.name }],addon_ids: [addon] }).expect(422);
  assert.equal(errorOf(mismatch.body).code,'BACKGROUND_MISMATCH');
  now = await catalog();
  assert.equal(now.packages.find(p => p.id === created)?.price,95000);
  assert.ok(!now.backgrounds.some(b => b.name === 'Baru Gagal'));
  assert.equal(now.allowed_addons.filter(a => a.package_id === created).length,0);
  // Kode antrean kembar → 409, paket baru tidak tercipta.
  await request(app).post('/api/packages/setup').set(auth(owner)).send({ package: { ...base,name: 'Paket Kembar' },backgrounds: [{ name: 'X' }] }).expect(409);
  assert.ok(!(await catalog()).backgrounds.some(b => b.name === 'X'));
});
test('kontrak HTTP memakai modul API frontend asli', verifyFrontendContract);
test('hapus tambahan: belum dipakai dihapus permanen, sudah dipakai diarsipkan', async () => {
  const create = async (name: string) => z.object({ id: numeric }).parse((await request(app).post('/api/addons').set(auth(owner))
    .send({ name,price: 5000,unit: 'pcs' }).expect(201)).body).id;
  const unused = await create('Belum Dipakai'); const used = await create('Sudah Dipakai');
  await request(app).put(`/api/packages/${pkg}/addons`).set(auth(owner)).send({ addon_ids: [addon,unused,used] }).expect(200);
  const sold = viewSchema.parse((await request(app).post('/api/visits/walk-in').set(auth()).send({ client_request_id: randomUUID(),
    customer_name: 'Pakai Tambahan',package_id: pkg,persons: 1,addons: [{ addon_id: used,qty: 1 }],
    payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 1000000 } }).expect(201)).body);
  await request(app).delete(`/api/addons/${used}`).set(auth()).expect(403);
  // Masih tercentang di paket → ditolak dengan nama paketnya, tidak ada yang berubah.
  const blocked = z.object({ error: z.object({ code: z.string(),message: z.string() }) })
    .parse((await request(app).delete(`/api/addons/${unused}`).set(auth(owner)).expect(409)).body).error;
  assert.equal(blocked.code,'ADDON_IN_USE'); assert.match(blocked.message,/Reguler/);
  assert.ok(z.array(z.object({ id: numeric })).parse((await request(app).get('/api/addons').set(auth()).expect(200)).body).some(a => a.id === unused));
  await request(app).put(`/api/packages/${pkg}/addons`).set(auth(owner)).send({ addon_ids: [addon] }).expect(200);
  assert.deepEqual((await request(app).delete(`/api/addons/${unused}`).set(auth(owner)).expect(200)).body,{ id: unused,archived: false });
  assert.deepEqual((await request(app).delete(`/api/addons/${used}`).set(auth(owner)).expect(200)).body,{ id: used,archived: true });
  const list = z.array(z.object({ id: numeric,is_active: numeric })).parse((await request(app).get('/api/addons').set(auth()).expect(200)).body);
  assert.ok(!list.some(a => a.id === unused)); assert.equal(list.find(a => a.id === used)?.is_active,0);
  const links = z.object({ allowed_addons: z.array(z.object({ package_id: numeric,addon_id: numeric })) })
    .parse((await request(app).get('/api/packages').set(auth(owner)).expect(200)).body).allowed_addons;
  assert.ok(!links.some(l => l.addon_id === used || l.addon_id === unused)); assert.ok(links.some(l => l.addon_id === addon));
  // Riwayat lama tetap utuh; tambahan terhapus tidak bisa dipilih lagi.
  assert.ok((await view(sold.visit.id)).items.some(i => i.item_type === 'TAMBAHAN' && i.is_active));
  await request(app).post('/api/visits/walk-in').set(auth()).send({ client_request_id: randomUUID(),customer_name: 'Tambahan Terhapus',
    package_id: pkg,persons: 1,addons: [{ addon_id: used,qty: 1 }],payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 1000000 } }).expect(404);
  await request(app).delete(`/api/addons/${unused}`).set(auth(owner)).expect(404);
  await action(sold,'CANCEL');
});
// ---- Reservasi WhatsApp: tab Reservasi di Pendaftaran, bagian Reservasi + "Sudah Datang" di Antrean ----
const slot = (time: string, day = today()) => `${day} ${time}:00`;
const tomorrow = () => wib(new Date(Date.now()+86400_000)).slice(0,10);
const errorCode = (body: unknown) => z.object({ error: z.object({ code: z.string() }) }).parse(body).error.code;
const reservationExtra = z.object({ visit: z.object({ customer_type: z.string(),phone: z.string().nullable(),appointment_at: z.string().nullable(),
  service_date: z.string(),queue_entered_at: z.string().nullable(),queue_code_snapshot: z.string().nullable() }) });
const reservationPayment = (type: 'DP' | 'LUNAS', amount: number, method = 'TRANSFER') => ({ client_request_id: randomUUID(),type,method,amount });
// Reservasi wajib paket (bawaan: Ekonomis 1 orang). Tiap tes memakai jam berbeda supaya tidak saling bentrok.
function reserve(body: Record<string, unknown>) {
  return request(app).post('/api/visits/reservation').set(auth())
    .send({ client_request_id: randomUUID(),customer_name: 'Uji Reservasi',appointment_at: slot('13:15'),package_id: cheap,persons: 1,...body });
}
// Reservasi lama tanpa paket (sebelum aturan wajib paket) lewat endpoint lama; check-in masih mendukung data seperti ini.
function legacyReservation(name: string, appointmentAt: string, dp: number) {
  return request(app).post('/api/visits').set(auth()).send({ client_request_id: randomUUID(),customer_name: name,customer_type: 'RESERVASI',
    appointment_at: appointmentAt,payment: { client_request_id: randomUUID(),payment_type: 'DP',method: 'QRIS',amount: dp } });
}
function checkIn(v: View, body: Record<string, unknown> = {}) {
  return request(app).post(`/api/visits/${v.visit.id}/check-in`).set(auth()).send({ version: v.visit.version,...body });
}
test('reservasi: jadwal 13.15–20.45 per 15 menit, wajib paket & bayar Transfer/QRIS, DP < total, No. WhatsApp', async () => {
  for (const time of ['13:00','21:00','14:10']) {
    const response = await reserve({ appointment_at: slot(time),payment: reservationPayment('DP',10000) }).expect(422);
    assert.equal(errorCode(response.body),'APPOINTMENT_INVALID',time);
  }
  const yesterday = wib(new Date(Date.now()-86400_000)).slice(0,10);
  assert.equal(errorCode((await reserve({ appointment_at: slot('14:00',yesterday),payment: reservationPayment('DP',10000) }).expect(422)).body),'PAST_APPOINTMENT');
  await reserve({}).expect(422); // tanpa pembayaran
  await reserve({ payment: reservationPayment('DP',10000,'TUNAI') }).expect(422); // saat reservasi hanya Transfer/QRIS
  await reserve({ phone: '12ab',payment: reservationPayment('DP',10000) }).expect(422);
  assert.equal(errorCode((await reserve({ package_id: null,persons: null,payment: reservationPayment('DP',10000) }).expect(422)).body),'PACKAGE_REQUIRED');
  assert.equal(errorCode((await reserve({ persons: 2,payment: reservationPayment('DP',60000) }).expect(422)).body),'DP_TOO_LARGE');
  assert.equal(errorCode((await reserve({ persons: 2,payment: reservationPayment('LUNAS',50000) }).expect(422)).body),'PAYMENT_NOT_SETTLED');
  await request(app).post('/api/visits/reservation').set(auth(owner)).send({}).expect(403);
  const saved = z.array(z.object({ id: numeric })).parse((await request(app).get('/api/visits?search=Uji%20Reservasi').set(auth()).expect(200)).body);
  assert.equal(saved.length,0,'Reservasi yang gagal tidak boleh tersimpan');
  // Berhasil: No. WhatsApp dirapikan, belum dapat nomor antrean, DP tanpa referensi diterima, permintaan ganda = satu reservasi.
  const input = { client_request_id: randomUUID(),customer_name: 'Uji Reservasi Valid',phone: '0812-3456 7890',appointment_at: slot('20:45',tomorrow()),
    package_id: cheap,persons: 1,payment: reservationPayment('DP',30000,'QRIS') };
  const pair = await Promise.all([1,2].map(() => request(app).post('/api/visits/reservation').set(auth()).send(input)));
  pair.forEach(p => assert.equal(p.status,201,JSON.stringify(p.body)));
  const v = viewSchema.parse(pair[0]!.body); assert.equal(viewSchema.parse(pair[1]!.body).visit.id,v.visit.id);
  const extra = reservationExtra.parse(pair[0]!.body).visit;
  assert.equal(v.visit.status,'RESERVASI'); assert.equal(v.visit.queue_number,null); assert.equal(v.balance.paid,30000);
  assert.equal(extra.phone,'081234567890'); assert.equal(extra.customer_type,'RESERVASI'); assert.equal(extra.service_date,tomorrow());
  assert.equal(errorCode((await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(409)).body),'RECEIPT_NOT_READY');
  await action(v,'CANCEL');
});
test('Sudah Datang (data lama tanpa paket): pilih paket + lunasi → RG-R001, urut jam reservasi, panggil bebas', async () => {
  const dp = viewSchema.parse((await legacyReservation('Uji DP Tanpa Paket',slot('13:15'),20000).expect(201)).body);
  // Datang langsung yang masuk 13.20 harus di bawah reservasi jam 13.15, walau reservasinya datang belakangan.
  const walk = viewSchema.parse((await request(app).post('/api/visits/walk-in').set(auth()).send({ client_request_id: randomUUID(),
    customer_name: 'Uji Datang 13.20',package_id: cheap,persons: 1,payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 60000 } }).expect(201)).body);
  await read(db => run(db,'UPDATE visits SET queue_entered_at=? WHERE id=?',[slot('13:20'),walk.visit.id]));
  assert.equal(errorCode((await checkIn(dp).expect(422)).body),'PACKAGE_REQUIRED');
  // Uang tunai kurang → tidak ada yang tersimpan.
  const short = await checkIn(dp,{ package_id: cheap,persons: 1,payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 10000 } }).expect(422);
  assert.equal(errorCode(short.body),'PAYMENT_NOT_SETTLED');
  assert.equal((await view(dp.visit.id)).visit.status,'RESERVASI'); assert.equal((await view(dp.visit.id)).payments.length,1);
  const body = { package_id: cheap,persons: 1,payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 50000 } };
  const response = await checkIn(dp,body).expect(200);
  const v = viewSchema.parse(response.body); const extra = reservationExtra.parse(response.body).visit;
  assert.equal(v.visit.status,'MENUNGGU'); assert.equal(v.transaction.payment_status,'LUNAS'); assert.equal(v.transaction.total,60000);
  assert.equal(v.payments.length,2); assert.equal(v.payments[1]?.change_amount,10000);
  assert.equal(v.visit.queue_number,1,'Nomor reservasi punya urutan sendiri (EK-R001)'); assert.equal(extra.queue_code_snapshot,'EK');
  assert.ok(extra.queue_entered_at?.startsWith(slot('13:15')),'Urutan memakai jam reservasi');
  // Kirim ulang setelah berhasil (koneksi putus) → hasil sama, tidak ada pembayaran kedua.
  const retry = viewSchema.parse((await checkIn(dp,body).expect(200)).body);
  assert.equal(retry.visit.id,v.visit.id); assert.equal(retry.payments.length,2);
  const order = z.array(z.object({ id: numeric })).parse((await request(app).get(`/api/visits?date=${today()}`).set(auth()).expect(200)).body).map(r => r.id);
  assert.ok(order.indexOf(v.visit.id) < order.indexOf(walk.visit.id),'Reservasi 13.15 di atas datang langsung 13.20');
  const receipt = await request(app).get(`/api/transactions/${v.transaction.id}/receipt.pdf`).set(auth()).expect(200);
  assert.ok(Buffer.isBuffer(receipt.body));
  // Admin bebas memanggil yang bukan urutan pertama, tanpa alasan.
  const called = viewSchema.parse((await request(app).post(`/api/visits/${walk.visit.id}/actions`).set(auth())
    .send({ version: walk.visit.version,action: 'CALL' }).expect(200)).body);
  await action(called,'CANCEL'); await action(v,'CANCEL');
  // DP lebih besar dari total paket yang dipilih saat datang → ditolak (refund tidak tersedia).
  const big = viewSchema.parse((await legacyReservation('Uji DP Besar',slot('13:30'),70000).expect(201)).body);
  assert.equal(errorCode((await checkIn(big,{ package_id: cheap,persons: 1 }).expect(422)).body),'DP_EXCEEDS_TOTAL');
  await action(big,'CANCEL');
});
test('reservasi paket + DP / lunas: paket terkunci, nota sebelum datang, ubah jadwal, tidak ditutup otomatis', async () => {
  const dp = viewSchema.parse((await reserve({ customer_name: 'Uji Paket DP',persons: 2,payment: reservationPayment('DP',20000) }).expect(201)).body);
  assert.equal(dp.transaction.total,60000); assert.equal(dp.transaction.payment_status,'BELUM_LUNAS');
  assert.equal(errorCode((await checkIn(dp,{ package_id: pkg,persons: 1 }).expect(422)).body),'PACKAGE_LOCKED');
  assert.equal(errorCode((await checkIn(dp).expect(422)).body),'PAYMENT_REQUIRED');
  const queued = viewSchema.parse((await checkIn(dp,{ payment: { client_request_id: randomUUID(),method: 'QRIS',amount: 40000 } }).expect(200)).body);
  assert.equal(queued.visit.status,'MENUNGGU'); assert.equal(queued.balance.net,60000);
  // Lunas + tambahan untuk besok: nota tersedia sebelum datang.
  const paid = viewSchema.parse((await reserve({ customer_name: 'Uji Lunas Besok',appointment_at: slot('14:00',tomorrow()),package_id: pkg,persons: 1,
    addons: [{ addon_id: addon,qty: 1 }],payment: reservationPayment('LUNAS',210000,'QRIS') }).expect(201)).body);
  assert.equal(paid.transaction.payment_status,'LUNAS'); assert.equal(paid.transaction.total,210000);
  await request(app).get(`/api/transactions/${paid.transaction.id}/receipt.pdf`).set(auth()).expect(200);
  assert.equal(errorCode((await checkIn(paid).expect(409)).body),'WRONG_SERVICE_DATE');
  // Ubah jadwal ke hari ini → langsung masuk antrean tanpa bayar lagi.
  const move = (v: View, appointment_at: string) => request(app).patch(`/api/visits/${v.visit.id}/appointment`).set(auth())
    .send({ version: v.visit.version,appointment_at });
  assert.equal(errorCode((await move(paid,slot('14:10')).expect(422)).body),'APPOINTMENT_INVALID');
  const moved = viewSchema.parse((await move(paid,slot('14:00')).expect(200)).body);
  assert.equal(reservationExtra.parse((await request(app).get(`/api/visits/${moved.visit.id}`).set(auth()).expect(200)).body).visit.service_date,today());
  const arrived = viewSchema.parse((await checkIn(moved).expect(200)).body);
  assert.equal(arrived.visit.status,'MENUNGGU'); assert.equal(arrived.payments.length,1);
  assert.equal(errorCode((await move(arrived,slot('15:00')).expect(409)).body),'INVALID_TRANSITION');
  // Ganti hari: reservasi yang sudah masuk antrean ikut ditutup otomatis; yang belum datang tetap sampai dibatalkan Admin.
  const pending = viewSchema.parse((await reserve({ customer_name: 'Uji Belum Datang',appointment_at: slot('15:00'),
    payment: reservationPayment('DP',10000) }).expect(201)).body);
  await read(db => run(db,'UPDATE visits SET service_date=DATE_SUB(service_date,INTERVAL 1 DAY) WHERE id IN (?,?)',[queued.visit.id,pending.visit.id]));
  assert.deepEqual(await closeStaleVisits(),{ cancelled: 1,finished: 0 });
  assert.equal((await view(queued.visit.id)).visit.status,'DIBATALKAN');
  const stillPending = await view(pending.visit.id); assert.equal(stillPending.visit.status,'RESERVASI');
  const cancelled = await action(stillPending,'CANCEL'); assert.equal(cancelled.balance.net,10000); // DP ditahan
  await action(arrived,'CANCEL');
});
test('reservasi tidak boleh bentrok di paket yang sama (durasi paket + tambah waktu)', async () => {
  const bt = z.object({ id: numeric }).parse((await request(app).post('/api/packages').set(auth(owner))
    .send({ name: 'Uji Bentrok',queue_code: 'BT',price_type: 'PER_SESI',price: 50000,duration_minutes: 20 }).expect(201)).body).id;
  const extra = z.object({ id: numeric }).parse((await request(app).post('/api/addons').set(auth(owner))
    .send({ name: 'Uji Tambah Waktu',price: 10000,unit: '5 menit',extra_minutes: 5 }).expect(201)).body).id;
  await request(app).put(`/api/packages/${bt}/addons`).set(auth(owner)).send({ addon_ids: [extra] }).expect(200);
  const day = tomorrow();
  const book = (name: string, time: string, body: Record<string, unknown> = {}) => reserve({ customer_name: name,
    appointment_at: slot(time,day),package_id: bt,persons: 1,payment: reservationPayment('DP',10000),...body });
  const made: View[] = [];
  const keep = async (response: request.Test) => { const v = viewSchema.parse((await response.expect(201)).body); made.push(v); return v; };
  await keep(book('Uji A','14:00'));                                       // 14.00–14.20
  const clash = await book('Uji B','14:15').expect(409);
  assert.equal(errorCode(clash.body),'RESERVATION_CLASH'); assert.match(z.object({ error: z.object({ message: z.string() }) }).parse(clash.body).error.message,/14\.00–14\.20/);
  const b = await keep(book('Uji B','14:30'));                            // 14.30–14.50
  await keep(reserve({ customer_name: 'Uji C',appointment_at: slot('14:15',day),payment: reservationPayment('DP',10000) })); // paket lain, jam sama → boleh
  await keep(book('Uji D','15:00',{ addons: [{ addon_id: extra,qty: 3 }] }));   // 20 + 3×5 = 35 menit: 15.00–15.35
  assert.equal(errorCode((await book('Uji E','15:30').expect(409)).body),'RESERVATION_CLASH'); // tanpa tambah waktu D selesai 15.20
  await keep(book('Uji E','15:45'));
  // Pilihan jam: 13.45 + 20 menit menabrak A; dengan 15 menit masih muat.
  const slots = async (query: string) => z.object({ slots: z.array(z.string()) })
    .parse((await request(app).get(`/api/reservations/availability?date=${day}&${query}`).set(auth()).expect(200)).body).slots;
  const twenty = await slots(`package_id=${bt}&minutes=20`);
  assert.ok(twenty.includes('13:15') && twenty.includes('13:30')); assert.ok(!['13:45','14:00','14:15','14:30','15:30'].some(s => twenty.includes(s)));
  assert.ok((await slots(`package_id=${bt}&minutes=15`)).includes('13:45'));
  await request(app).get(`/api/reservations/availability?date=${day}`).set(auth()).expect(422);
  // Ubah Jadwal: ke jam bentrok ditolak; dirinya sendiri tidak dihitung bentrok.
  const move = (v: View, time: string) => request(app).patch(`/api/visits/${v.visit.id}/appointment`).set(auth())
    .send({ version: v.visit.version,appointment_at: slot(time,day) });
  assert.equal(errorCode((await move(b,'14:00').expect(409)).body),'RESERVATION_CLASH');
  const own = await slots(`visit_id=${b.visit.id}`); assert.ok(own.includes('14:30') && !own.includes('14:00'));
  const moved = viewSchema.parse((await move(b,'13:15').expect(200)).body); made[made.indexOf(b)] = moved;
  // Batal → jamnya kosong lagi.
  for (const v of made) await action(await view(v.visit.id),'CANCEL');
  assert.ok((await slots(`package_id=${bt}&minutes=20`)).includes('14:00'));
});
test('Laporan = uang masuk per pembayaran (DP/Lunas), Admin hanya hari ini; Riwayat semua tanggal', async () => {
  const yesterday = wib(new Date(Date.now()-86400_000)).slice(0,10);
  await request(app).get(`/api/visits?history=true&date=${yesterday}`).set(auth()).expect(200); // Admin boleh riwayat tanggal lain
  // Admin: laporan hari ini saja, tanpa Dashboard.
  await request(app).get('/api/reports/sales?period=today').set(auth()).expect(200);
  await request(app).get(`/api/reports/packages?period=custom&from=${today()}&to=${today()}`).set(auth()).expect(200);
  assert.equal(errorCode((await request(app).get('/api/reports/sales?period=month').set(auth()).expect(403)).body),'REPORT_TODAY_ONLY');
  await request(app).get(`/api/reports/sales?period=custom&from=${yesterday}&to=${yesterday}`).set(auth()).expect(403);
  await request(app).get('/api/dashboard').set(auth()).expect(403);
  const query = `period=custom&from=${today()}&to=${today()}`;
  const dashboard = z.object({ sales: numeric,dp: z.object({ count: numeric,amount: numeric }),lunas: z.object({ count: numeric,amount: numeric }),
    methods: z.array(z.object({ method: z.string(),amount: numeric })) });
  const dash = async () => dashboard.parse((await request(app).get(`/api/dashboard?${query}`).set(auth(owner)).expect(200)).body);
  const amountOf = (d: z.infer<typeof dashboard>, method: string) => d.methods.find(m => m.method === method)?.amount ?? 0;
  const before = await dash();
  // DP QRIS → baris DP hari ini; pelunasan tunai saat datang → baris Lunas sebesar sisanya.
  const dpBody = (await reserve({ customer_name: 'Uji Laporan',appointment_at: slot('16:00'),payment: reservationPayment('DP',20000,'QRIS') }).expect(201)).body;
  const trxNo = z.object({ transaction: z.object({ transaction_no: z.string() }) }).parse(dpBody).transaction.transaction_no;
  const afterDp = await dash();
  assert.equal(afterDp.sales,before.sales+20000); assert.equal(afterDp.dp.amount,before.dp.amount+20000); assert.equal(afterDp.dp.count,before.dp.count+1);
  const done = viewSchema.parse((await checkIn(viewSchema.parse(dpBody),{ payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 50000 } }).expect(200)).body);
  const afterLunas = await dash();
  assert.equal(afterLunas.sales,before.sales+60000); assert.equal(afterLunas.lunas.amount,before.lunas.amount+40000);
  assert.equal(amountOf(afterLunas,'QRIS'),amountOf(before,'QRIS')+20000); assert.equal(amountOf(afterLunas,'TUNAI'),amountOf(before,'TUNAI')+40000);
  const rows = z.object({ rows: z.array(z.object({ transaction_no: z.string(),customer_type: z.string(),method: z.string(),status: z.string(),amount: numeric })) })
    .parse((await request(app).get(`/api/reports/sales?${query}`).set(auth()).expect(200)).body).rows.filter(r => r.transaction_no === trxNo);
  assert.deepEqual(rows.map(r => [r.customer_type,r.method,r.status,r.amount]),[['Reservasi','QRIS','DP',20000],['Reservasi','Tunai','Lunas',40000]]);
  // Batal → uang ditahan, laporan tidak berubah.
  await action(done,'CANCEL');
  assert.equal((await dash()).sales,afterLunas.sales);
});
test('Ubah Reservasi: turun paket → refund (baris minus), naik paket → bayar saat datang, tambahan saat datang', async () => {
  const query = `period=custom&from=${today()}&to=${today()}`;
  const dashboard = z.object({ sales: numeric,refund: z.object({ count: numeric,amount: numeric }),methods: z.array(z.object({ method: z.string(),amount: numeric })) });
  const dash = async () => dashboard.parse((await request(app).get(`/api/dashboard?${query}`).set(auth(owner)).expect(200)).body);
  const amountOf = (d: z.infer<typeof dashboard>, method: string) => d.methods.find(m => m.method === method)?.amount ?? 0;
  const edit = (v: View, body: Record<string, unknown>) => request(app).put(`/api/visits/${v.visit.id}/reservation`).set(auth())
    .send({ version: v.visit.version,customer_name: 'Uji Ubah',appointment_at: slot('17:00',tomorrow()),package_id: cheap,persons: 1,addons: [],...body });
  const refundedOf = (body: unknown) => z.object({ balance: z.object({ refunded: numeric }) }).parse(body).balance.refunded;
  const before = await dash();

  // 1. Lunas Rp200.000 (Reguler) turun ke Ekonomis Rp60.000 → kelebihan Rp140.000 WAJIB dikembalikan (Tunai/Transfer).
  let a = viewSchema.parse((await reserve({ customer_name: 'Uji Turun',appointment_at: slot('17:00',tomorrow()),package_id: pkg,
    payment: reservationPayment('LUNAS',200000,'QRIS') }).expect(201)).body);
  assert.equal(errorCode((await edit(a,{}).expect(422)).body),'REFUND_REQUIRED');
  await edit(a,{ refund: { client_request_id: randomUUID(),method: 'QRIS' } }).expect(422); // QRIS tidak untuk mengembalikan uang
  const refundBody = { client_request_id: randomUUID(),method: 'TRANSFER' };
  const downBody = (await edit(a,{ customer_name: 'Uji Turun',refund: refundBody }).expect(200)).body;
  const down = viewSchema.parse(downBody);
  assert.equal(down.transaction.total,60000); assert.equal(down.transaction.payment_status,'LUNAS');
  assert.equal(down.balance.net,60000); assert.equal(refundedOf(downBody),140000);
  // Kirim ulang (koneksi putus) → hasil sama, tidak ada refund kedua.
  assert.equal(refundedOf((await edit(a,{ customer_name: 'Uji Turun',refund: refundBody }).expect(200)).body),140000);
  a = down;
  const afterDown = await dash();
  assert.equal(afterDown.sales,before.sales+200000-140000); assert.equal(afterDown.refund.amount,before.refund.amount+140000);
  assert.equal(amountOf(afterDown,'QRIS'),amountOf(before,'QRIS')+200000); assert.equal(amountOf(afterDown,'TRANSFER'),amountOf(before,'TRANSFER')-140000);
  const trxA = z.object({ transaction: z.object({ transaction_no: z.string() }) }).parse(downBody).transaction.transaction_no;
  const rowsA = z.object({ rows: z.array(z.object({ transaction_no: z.string(),method: z.string(),status: z.string(),amount: numeric })) })
    .parse((await request(app).get(`/api/reports/sales?${query}`).set(auth(owner)).expect(200)).body).rows.filter(r => r.transaction_no === trxA);
  assert.deepEqual(rowsA.map(r => [r.status,r.method,r.amount]),[['Lunas','QRIS',200000],['Refund','Transfer',-140000]]);
  // Batal setelah lunas → tidak ada pengembalian.
  await action(a,'CANCEL');
  assert.equal((await dash()).refund.amount,afterDown.refund.amount);

  // 2. Lunas Ekonomis Rp60.000 naik ke Reguler Rp200.000 → jadi belum lunas, selisih dibayar saat datang (+ tambahan saat datang).
  let b = viewSchema.parse((await reserve({ customer_name: 'Uji Naik',appointment_at: slot('18:00'),
    payment: reservationPayment('LUNAS',60000) }).expect(201)).body);
  b = viewSchema.parse((await edit(b,{ customer_name: 'Uji Naik',appointment_at: slot('18:00'),package_id: pkg }).expect(200)).body);
  assert.equal(b.transaction.total,200000); assert.equal(b.transaction.payment_status,'BELUM_LUNAS'); assert.equal(b.balance.due,140000);
  assert.equal(errorCode((await checkIn(b).expect(422)).body),'PAYMENT_REQUIRED');
  const arrived = viewSchema.parse((await checkIn(b,{ addons: [{ addon_id: addon,qty: 1 }],
    payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 150000 } }).expect(200)).body);
  assert.equal(arrived.visit.status,'MENUNGGU'); assert.equal(arrived.transaction.total,210000); assert.equal(arrived.transaction.payment_status,'LUNAS');

  // 3. DP Rp100.000 (Reguler + cetak ×2): saat datang tambahan tidak boleh dikurangi; turun ke Ekonomis → kelebihan DP dikembalikan.
  let c = viewSchema.parse((await reserve({ customer_name: 'Uji DP Turun',appointment_at: slot('19:00'),package_id: pkg,
    addons: [{ addon_id: addon,qty: 2 }],payment: reservationPayment('DP',100000) }).expect(201)).body);
  assert.equal(errorCode((await checkIn(c,{ addons: [{ addon_id: addon,qty: 1 }] }).expect(422)).body),'ADDON_DECREASE_NOT_ALLOWED');
  // Jam bentrok saat diubah → ditolak.
  const d = viewSchema.parse((await reserve({ customer_name: 'Uji Pengisi Jam',appointment_at: slot('20:00'),payment: reservationPayment('DP',10000) }).expect(201)).body);
  assert.equal(errorCode((await edit(c,{ customer_name: 'Uji DP Turun',appointment_at: slot('20:00'),
    refund: { client_request_id: randomUUID(),method: 'TUNAI' } }).expect(409)).body),'RESERVATION_CLASH');
  c = viewSchema.parse((await edit(c,{ customer_name: 'Uji DP Turun',appointment_at: slot('19:00'),
    refund: { client_request_id: randomUUID(),method: 'TUNAI' } }).expect(200)).body);
  assert.equal(c.transaction.total,60000); assert.equal(c.transaction.payment_status,'LUNAS'); assert.equal(c.balance.net,60000);
  // Sudah datang (masuk Menunggu) → tidak bisa diubah lagi.
  assert.equal(errorCode((await edit(arrived,{ customer_name: 'Uji Naik',appointment_at: slot('18:00') }).expect(409)).body),'INVALID_TRANSITION');
  for (const v of [arrived,c,d]) await action(await view(v.visit.id),'CANCEL');
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
