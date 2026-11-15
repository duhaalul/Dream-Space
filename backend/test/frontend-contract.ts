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
    createAddon: JsonCall; createBackground: JsonCall; setPackageAddons: JsonCall; setPackageAvailability: JsonCall };
  antrean: { createVisit: JsonCall; getVisit: JsonCall; runVisitAction: JsonCall; getQueueRooms: JsonCall };
  kasir: { addPayment: JsonCall; finishVisit: JsonCall; setTransactionAddons: JsonCall; getHistory: JsonCall;
    downloadReceipt(id: number): Promise<Blob> };
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
      included_persons: 2,extra_person_price: 30000,min_persons: 1,max_persons: 15,
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
    const addon = entitySchema.parse(await fe.paket.createAddon({ name: 'Tambah waktu',price: 20000,unit: '5 menit',is_active: true }));
    await fe.paket.setPackageAddons(pkg.id,[addon.id]);
    const catalog = z.object({ packages: z.array(entitySchema),backgrounds: z.array(entitySchema),
      allowed_addons: z.array(z.object({ package_id: z.number(),addon_id: z.number() })) }).parse(await fe.paket.getPackages());
    assert.ok(catalog.packages.some(p => p.id === pkg.id));
    assert.ok(catalog.backgrounds.some(p => p.id === bg.id));
    assert.ok(catalog.allowed_addons.some(p => p.package_id === pkg.id && p.addon_id === addon.id));
    assert.ok(z.array(entitySchema).parse(await fe.paket.getAddons()).some(a => a.id === addon.id));
    const admin = loginSchema.parse(await fe.akun.login('admin',password));
    fe.client.setAuthToken(admin.token);
    await fe.paket.setPackageAvailability(pkg.id,false,'Persiapan ruangan');
    await fe.paket.setPackageAvailability(pkg.id,true);
    const rooms = z.array(z.object({ package_id: z.number(),is_open: z.number() })).parse(await fe.antrean.getQueueRooms());
    assert.equal(rooms.find(r => r.package_id === pkg.id)?.is_open,1);
    const input = { client_request_id: randomUUID(),customer_name: 'Integrasi Frontend',customer_type: 'WALK_IN',
      package_id: pkg.id,background_id: bg.id,persons: 3 };
    let v = detailSchema.parse(await fe.antrean.createVisit(input));
    assert.equal(detailSchema.parse(await fe.antrean.createVisit(input)).visit.id,v.visit.id);
    assert.equal(v.transaction.total,140000);
    v = detailSchema.parse(await fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'CALL' }));
    await assert.rejects(fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'START' }),{ code: 'PAYMENT_REQUIRED_BEFORE_START' });
    await fe.kasir.addPayment(v.transaction.id,{ client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TUNAI',amount: 150000 });
    v = detailSchema.parse(await fe.antrean.runVisitAction(v.visit.id,{ version: v.visit.version,action: 'START' }));
    v = detailSchema.parse(await fe.kasir.setTransactionAddons(v.transaction.id,{ version: v.transaction.version,
      addons: [{ addon_id: addon.id,qty: 1 }],reason: 'Tambahan selama sesi' }));
    assert.equal(v.balance.due,20000);
    v = detailSchema.parse(await fe.kasir.finishVisit(v.visit.id,{ version: v.visit.version,transaction_version: v.transaction.version,
      persons: 3,addons: [{ addon_id: addon.id,qty: 1 }],payment: {
        client_request_id: randomUUID(),payment_type: 'PEMBAYARAN',method: 'TRANSFER',amount: 20000 } }));
    assert.equal(v.visit.status,'SELESAI'); assert.equal(v.balance.net,160000);
    const history = z.array(z.object({ id: z.number() })).parse(await fe.kasir.getHistory({ from: today(),to: today(),search: 'Integrasi Frontend' }));
    assert.ok(history.some(row => row.id === v.visit.id));
    const receipt = await fe.kasir.downloadReceipt(v.transaction.id);
    assert.equal(receipt.type,'application/pdf'); assert.equal((await receipt.text()).slice(0,5),'%PDF-');
    await assert.rejects(fe.laporan.getDashboard({ period: 'today' }),{ status: 403,code: 'FORBIDDEN' });
    fe.client.setAuthToken(owner.token);
    const query = { period: 'custom',from: today(),to: today() };
    const [dashboard,sales,cash] = await Promise.all([fe.laporan.getDashboard(query),fe.laporan.getReport('sales',query),fe.laporan.getReport('cash',query)]);
    z.object({ from: z.string(),to: z.string(),sessions: z.number(),sales: z.number(),cash_in: z.number(),refunds: z.number(),
      net_cash: z.number(),cancelled_net_cash: z.number(),packages: z.array(z.object({ name: z.string(),sessions: z.number(),sales: z.number() })),
      visits_by_status: z.array(z.object({ status: z.string(),count: z.number() })) }).parse(dashboard);
    const salesData = z.object({ rows: z.array(z.object({ customer_name: z.string(),total: z.number(),persons: z.number(),completed_at: z.string() })) }).parse(sales);
    assert.equal(salesData.rows.find(row => row.customer_name === 'Integrasi Frontend')?.total,160000);
    z.object({ rows: z.array(z.object({ kind: z.enum(['PAYMENT','REFUND']),method: z.string(),net: z.number(),occurred_at: z.string(),category: z.string() })) }).parse(cash);
    const pdf = await fe.laporan.downloadReport('visits','pdf',query);
    assert.equal((await pdf.text()).slice(0,5),'%PDF-');
    const excel = await fe.laporan.downloadReport('cash','xlsx',query);
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
