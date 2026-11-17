import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { z } from 'zod';
import { app } from '../src/app.js';
import { today, type Json } from '../src/core.js';

type JsonCall = (...args: Json[]) => Promise<Json>;
interface Frontend {
  client: { setAuthToken(token: string | null): void; setUnauthorizedHandler(callback: (() => void) | null): void };
  akun: { login: JsonCall; getMe: JsonCall; changePassword: JsonCall; updateProfile: JsonCall; logout: JsonCall };
  paket: { createPackage: JsonCall; updatePackage: JsonCall; getPackages: JsonCall; getAddons: JsonCall;
    createAddon: JsonCall; createBackground: JsonCall; setPackageAddons: JsonCall; setPackageAvailability: JsonCall;
    createPackageSetup: JsonCall; updatePackageSetup: JsonCall; deleteAddon: JsonCall };
  antrean: { getVisit: JsonCall; runVisitAction: JsonCall; getQueueRooms: JsonCall };
  kasir: { registerWalkIn: JsonCall; registerReservation: JsonCall; checkInReservation: JsonCall; updateReservation: JsonCall; getReservationSlots: JsonCall;
    getTransactionDetail: JsonCall; getHistory: JsonCall; downloadReceipt(id: number): Promise<Blob> };
  laporan: { getDashboard: JsonCall; getReport: JsonCall; downloadReport(code: string,format: string,query: Json): Promise<Blob> };
}
const userSchema = z.object({ id: z.number(), name: z.string(), username: z.string(), role: z.enum(['ADMIN','OWNER']), must_change_password: z.boolean() });
const loginSchema = z.object({ token: z.string(), user: userSchema });
const entitySchema = z.object({ id: z.number() });
const detailSchema = z.object({
  visit: z.object({ id: z.number(), version: z.number(), status: z.string() }),
  transaction: z.object({ id: z.number(), version: z.number(), total: z.number(), payment_status: z.string() }),
  balance: z.object({ due: z.number(), net: z.number() }),
});

// Menguji file API frontend asli melalui fetch HTTP, bukan salinan request atau mock.
export async function verifyFrontendContract(): Promise<void> {
  const server = app.listen(0,'127.0.0.1');
  const output = resolve('.local/frontend-contract.mjs');
  try {
    await once(server,'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const frontend = resolve(process.env['FRONTEND_DIR'] ?? '../frontend');
    await mkdir(resolve('.local'),{ recursive: true });
    await build({
      stdin: { contents: [
        "export * as client from '@/shared/api/client.js';",
        ...['akun','paket','antrean','kasir','laporan'].map(name => `export * as ${name} from '@/modules/${name}/api.js';`),
      ].join('\n'), resolveDir: frontend, loader: 'js' },
      alias: { '@': resolve(frontend,'src') }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(`${base}/api`) },
      bundle: true, format: 'esm', platform: 'node', target: 'node24', outfile: output,
    });
    // Antarmuka modul hasil build dipercaya; semua respons jaringan divalidasi dengan Zod.
    const fe: Frontend = await import(pathToFileURL(output).href);
    let expired = 0;
    fe.client.setUnauthorizedHandler(() => { expired += 1; });
    const password = 'Permanent-Dream-Password-456';
    const owner = loginSchema.parse(await fe.akun.login('owner',password));
    assert.equal(owner.user.must_change_password,false);
    fe.client.setAuthToken(owner.token);
    await assert.rejects(fe.akun.changePassword('sandi-lama-salah','New-Dream-Password-789'),{ status: 422, code: 'INVALID_PASSWORD' });
    assert.equal(expired,0,'Kesalahan sandi lama tidak boleh memicu logout frontend');
    const current = userSchema.parse(await fe.akun.getMe());
    await fe.akun.updateProfile('Owner Integrasi');
    assert.equal(userSchema.parse(await fe.akun.getMe()).name,'Owner Integrasi');
    await fe.akun.updateProfile(current.name);
    const payload = { name: 'Paket Integrasi',queue_code: 'INT',price_type: 'PER_KELOMPOK',price: 110000,
      included_persons: 2,extra_person_price: 30000,min_persons: 1,max_persons: 15,duration_minutes: 20,
      description: 'Pengujian kontrak frontend',is_active: true };
    try {
      await fe.paket.createPackage({ ...payload,min_persons: 10,max_persons: 2 });
      assert.fail('Batas orang yang terbalik harus ditolak');
    } catch (error) {
      const result = z.object({ code: z.literal('VALIDATION_ERROR'),details: z.array(z.object({ path: z.array(z.union([z.string(),z.number()])) })) }).parse(error);
      assert.ok(result.details.some(issue => issue.path[0] === 'max_persons'));
    }
    const pkg = entitySchema.parse(await fe.paket.createPackage(payload));
    const bg = entitySchema.parse(await fe.paket.createBackground(pkg.id,{ name: 'Putih',max_persons: 5,is_active: true }));
    const addon = entitySchema.parse(await fe.paket.createAddon({ name: 'Tambah waktu',price: 20000,unit: '5 menit',extra_minutes: 5,is_active: true }));
    await fe.paket.setPackageAddons(pkg.id,[addon.id]);
    const catalog = z.object({ packages: z.array(entitySchema),backgrounds: z.array(entitySchema),
      allowed_addons: z.array(z.object({ package_id: z.number(),addon_id: z.number() })) }).parse(await fe.paket.getPackages());
    assert.ok(catalog.packages.some(p => p.id === pkg.id));
    assert.ok(catalog.backgrounds.some(p => p.id === bg.id));
    assert.ok(catalog.allowed_addons.some(p => p.package_id === pkg.id && p.addon_id === addon.id));
    assert.ok(z.array(entitySchema).parse(await fe.paket.getAddons()).some(a => a.id === addon.id));
    // Hapus tambahan (DELETE lewat klien frontend): belum pernah dipakai → hapus permanen.
    const temporary = entitySchema.parse(await fe.paket.createAddon({ name: 'Sementara',price: 1000,unit: 'pcs',extra_minutes: null,is_active: true }));
    assert.deepEqual(await fe.paket.deleteAddon(temporary.id),{ id: temporary.id,archived: false });
    assert.ok(!z.array(entitySchema).parse(await fe.paket.getAddons()).some(a => a.id === temporary.id));
    // Pop-up Kelola Paket: info + latar + tambahan disimpan sekaligus.
    const setupBody = { ...payload,name: 'Paket Setup',queue_code: 'SET' };
    const setup = entitySchema.parse(await fe.paket.createPackageSetup({ package: setupBody,
      backgrounds: [{ name: 'Hitam',max_persons: 4,is_active: true }],addon_ids: [addon.id] }));
    const setupBackground = z.object({ backgrounds: z.array(z.object({ id: z.number(),package_id: z.number(),name: z.string() })) })
      .parse(await fe.paket.getPackages()).backgrounds.find(b => b.package_id === setup.id);
    assert.equal(setupBackground?.name,'Hitam');
    await fe.paket.updatePackageSetup(setup.id,{ package: { ...setupBody,price: 120000 },
      backgrounds: [{ id: setupBackground?.id,name: 'Hitam Doff',max_persons: 4,is_active: true },{ name: 'Krem',max_persons: null,is_active: true }],addon_ids: [] });
    const afterSetup = z.object({ packages: z.array(z.object({ id: z.number(),price: z.number() })),
      backgrounds: z.array(z.object({ package_id: z.number(),name: z.string() })),
      allowed_addons: z.array(z.object({ package_id: z.number() })) }).parse(await fe.paket.getPackages());
    assert.equal(afterSetup.packages.find(p => p.id === setup.id)?.price,120000);
    assert.deepEqual(afterSetup.backgrounds.filter(b => b.package_id === setup.id).map(b => b.name).sort(),['Hitam Doff','Krem']);
    assert.equal(afterSetup.allowed_addons.filter(a => a.package_id === setup.id).length,0);
    const admin = loginSchema.parse(await fe.akun.login('admin',password));
    fe.client.setAuthToken(admin.token);
    await fe.paket.setPackageAvailability(pkg.id,false,'Persiapan ruangan');
    await fe.paket.setPackageAvailability(pkg.id,true);
    const rooms = z.array(z.object({ package_id: z.number(),is_open: z.number() })).parse(await fe.antrean.getQueueRooms());
    assert.equal(rooms.find(r => r.package_id === pkg.id)?.is_open,1);
    // Alur Pendaftaran: daftar + tambahan + bayar lunas sekaligus (idempoten), lalu antrean, lalu FINISH.
    const input = { client_request_id: randomUUID(),customer_name: 'Integrasi Frontend',package_id: pkg.id,background_id: bg.id,persons: 3,
      addons: [{ addon_id: addon.id,qty: 1 }],payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 200000,reference: null } };
    let v = detailSchema.parse(await fe.kasir.registerWalkIn(input));
    assert.equal(detailSchema.parse(await fe.kasir.registerWalkIn(input)).visit.id,v.visit.id);
    assert.equal(v.transaction.total,160000); assert.equal(v.transaction.payment_status,'LUNAS'); assert.equal(v.balance.net,160000);
    const receipt = await fe.kasir.downloadReceipt(v.transaction.id);
    assert.equal(receipt.type,'application/pdf'); assert.equal((await receipt.text()).slice(0,5),'%PDF-');
    v = detailSchema.parse(await fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'CALL' }));
    const started = await fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'START' });
    v = detailSchema.parse(started);
    // Timer: durasi paket 20 menit + tambah waktu 1 × 5 menit.
    assert.equal(z.object({ visit: z.object({ session_minutes: z.number() }) }).parse(started).visit.session_minutes,25);
    const running = z.array(z.object({ package_id: z.number(),active_visit_id: z.number().nullable(),session_minutes: z.number().nullable(),
      started_at: z.string().nullable() })).parse(await fe.antrean.getQueueRooms()).find(r => r.package_id === pkg.id);
    assert.equal(running?.active_visit_id,v.visit.id); assert.equal(running?.session_minutes,25); assert.ok(running?.started_at);
    v = detailSchema.parse(await fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'FINISH' }));
    assert.equal(v.visit.status,'SELESAI');
    assert.equal(detailSchema.parse(await fe.kasir.getTransactionDetail(v.visit.id)).visit.status,'SELESAI');
    const history = z.array(z.object({ id: z.number() })).parse(await fe.kasir.getHistory({ from: today(),to: today(),search: 'Integrasi Frontend' }));
    assert.ok(history.some(row => row.id === v.visit.id));
    // Tab Reservasi: paket wajib + DP → pilihan jam (tanpa bentrok) → Ubah Reservasi (pindah jam) → Sudah Datang (lunasi tunai) → nomor INT-R001.
    let r = detailSchema.parse(await fe.kasir.registerReservation({ client_request_id: randomUUID(),customer_name: 'Reservasi Frontend',
      phone: '081234567890',appointment_at: `${today()} 20:45:00`,package_id: pkg.id,background_id: bg.id,persons: 2,addons: [],
      payment: { client_request_id: randomUUID(),type: 'DP',method: 'QRIS',amount: 50000,reference: null } }));
    assert.equal(r.visit.status,'RESERVASI'); assert.equal(r.balance.net,50000);
    // Paket 20 menit di 20.45 → 20.30 bentrok, 13.15 kosong.
    const free = z.object({ slots: z.array(z.string()) }).parse(await fe.kasir.getReservationSlots({ date: today(),package_id: pkg.id,minutes: 20 })).slots;
    assert.ok(!free.includes('20:30') && !free.includes('20:45'));
    // Ubah Reservasi: pindah jam (paket sama, total sama → tanpa refund).
    r = detailSchema.parse(await fe.kasir.updateReservation(r.visit.id,{ version: r.visit.version,customer_name: 'Reservasi Frontend',
      phone: '081234567890',appointment_at: `${today()} 13:15:00`,package_id: pkg.id,background_id: bg.id,persons: 2,addons: [] }));
    assert.equal(r.transaction.total,110000); assert.equal(r.balance.net,50000);
    const arrived = await fe.kasir.checkInReservation(r.visit.id,{ version: r.visit.version,
      payment: { client_request_id: randomUUID(),method: 'TUNAI',amount: 100000,reference: null } });
    r = detailSchema.parse(arrived);
    assert.equal(r.visit.status,'MENUNGGU'); assert.equal(r.transaction.total,110000); assert.equal(r.transaction.payment_status,'LUNAS');
    const queued = z.object({ visit: z.object({ customer_type: z.string(),queue_number: z.number(),queue_code_snapshot: z.string() }) }).parse(arrived).visit;
    assert.deepEqual([queued.customer_type,queued.queue_code_snapshot,queued.queue_number],['RESERVASI','INT',1]);
    await fe.antrean.runVisitAction(r.visit.id,{ version: r.visit.version,action: 'CANCEL',reason: 'Uji kontrak selesai' });
    // Admin: Laporan hari ini saja, tanpa Dashboard; Riwayat tanggal mana pun.
    await assert.rejects(fe.laporan.getDashboard({ period: 'today' }),{ status: 403,code: 'FORBIDDEN' });
    await fe.laporan.getReport('sales',{ period: 'today' });
    await assert.rejects(fe.laporan.getReport('sales',{ period: 'month' }),{ status: 403,code: 'REPORT_TODAY_ONLY' });
    await fe.kasir.getHistory({ from: '2000-01-01',to: '2000-01-01' });
    fe.client.setAuthToken(owner.token);
    const query = { period: 'custom',from: today(),to: today() };
    const [dashboard,sales] = await Promise.all([fe.laporan.getDashboard(query),fe.laporan.getReport('sales',query)]);
    const dash = z.object({ from: z.string(),to: z.string(),sales: z.number(),refund: z.object({ count: z.number(),amount: z.number() }),
      dp: z.object({ count: z.number(),amount: z.number() }),lunas: z.object({ count: z.number(),amount: z.number() }),
      methods: z.array(z.object({ method: z.enum(['TUNAI','TRANSFER','QRIS']),amount: z.number() })),
      packages: z.array(z.object({ name: z.string(),payments: z.number(),sales: z.number() })),
      visits_by_status: z.array(z.object({ status: z.string(),count: z.number() })) }).parse(dashboard);
    assert.equal(dash.methods.reduce((sum,m) => sum+m.amount,0),dash.sales);
    const salesData = z.object({ rows: z.array(z.object({ paid_at: z.string(),customer_name: z.string(),customer_type: z.string(),persons: z.number(),
      method: z.string(),status: z.enum(['DP','Lunas','Refund']),amount: z.number() })) }).parse(sales);
    const integration = salesData.rows.filter(row => row.customer_name === 'Integrasi Frontend');
    assert.deepEqual(integration.map(row => [row.customer_type,row.method,row.status,row.amount]),[['Di Tempat','Tunai','Lunas',160000]]);
    const reserved = salesData.rows.filter(row => row.customer_name === 'Reservasi Frontend');
    assert.deepEqual(reserved.map(row => [row.customer_type,row.method,row.status,row.amount]),[['Reservasi','QRIS','DP',50000],['Reservasi','Tunai','Lunas',60000]]);
    const pdf = await fe.laporan.downloadReport('sales','pdf',query);
    assert.equal((await pdf.text()).slice(0,5),'%PDF-');
    const excel = await fe.laporan.downloadReport('packages','xlsx',query);
    assert.equal(Buffer.from(await excel.arrayBuffer()).subarray(0,2).toString(),'PK');
    const preflight = await fetch(`${base}/api/packages`,{ method: 'OPTIONS',headers: {
      Origin: 'http://localhost:5173','Access-Control-Request-Method': 'POST','Access-Control-Request-Headers': 'authorization,content-type' } });
    assert.equal(preflight.status,204); assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost:5173');
    const headers = await fetch(`${base}/api/auth/me`,{ headers: { Origin: 'http://localhost:5173',Authorization: `Bearer ${owner.token}` } });
    assert.match(headers.headers.get('access-control-expose-headers') ?? '',/X-Request-Id/);
    await fe.akun.logout();
    await assert.rejects(fe.akun.getMe(),{ status: 401,code: 'SESSION_EXPIRED' });
    assert.equal(expired,1,'Sesi yang dicabut tetap memicu logout frontend');
    fe.client.setAuthToken(null); fe.client.setUnauthorizedHandler(null);
  } finally {
    await new Promise<void>((resolveClose,reject) => server.close(error => error ? reject(error) : resolveClose()));
    await rm(output,{ force: true });
  }
}
