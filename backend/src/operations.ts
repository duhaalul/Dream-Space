import { Router } from 'express';
import { z } from 'zod';
import { actorOf, role } from './auth.js';
import { ensure, id, money, reason, method, timestamp, today, wib, fingerprint, priceLines,
  type Actor, type PriceType, type Json } from './core.js';
import { snapshot as read, transaction, rows, one, run, audit, type Db } from './db.js';
import { validateSelection } from './catalog.js';

type Status = 'RESERVASI' | 'MENUNGGU' | 'DIPANGGIL' | 'SEDANG_DILAYANI' | 'DILEWATI' | 'SELESAI' | 'DIBATALKAN';
export interface Visit {
  id: number; customer_name: string; customer_type: 'WALK_IN' | 'RESERVASI'; appointment_at: string | null;
  service_date: string; package_id: number | null; background_id: number | null; persons: number | null;
  queue_number: number | null; queue_code_snapshot: string | null; status: Status; version: number;
  request_hash: string; queue_entered_at: string | null;
}
export interface Sale {
  id: number; visit_id: number; transaction_no: string; price_type_snapshot: PriceType | null;
  price_snapshot: number | null; included_persons_snapshot: number | null; extra_person_price_snapshot: number | null;
  background_snapshot: string | null; subtotal: number; total: number; payment_status: string;
  refund_status: string; version: number; completed_at: string | null; cancelled_at: string | null;
}
export interface Item { id: number; item_type: string; addon_id: number | null; description: string;
  qty: number; unit_snapshot: string; unit_price: number; amount: number; is_active: number }
export interface Payment { id: number; transaction_id: number; payment_type: 'DP' | 'PEMBAYARAN'; method: 'TUNAI' | 'TRANSFER' | 'QRIS';
  amount: number; cash_received: number | null; change_amount: number | null; paid_at: string;
  reference: string | null; request_hash: string }
interface Refund { id: number; transaction_id: number; amount: number; request_hash: string }
const personsSchema = z.number().int().min(1).max(1000);
const versionSchema = z.number().int().positive();
export const paymentSchema = z.strictObject({ client_request_id: z.uuid(), payment_type: z.enum(['DP', 'PEMBAYARAN']),
  method, amount: money.refine(n => n > 0), paid_at: timestamp.optional(), reference: z.string().trim().min(1).max(100).nullable().default(null) });
const refundSchema = z.strictObject({ client_request_id: z.uuid(), amount: money.refine(n => n > 0), method, reason });
type PaymentInput = z.infer<typeof paymentSchema>;
const addonInput = z.strictObject({ addon_id: id, qty: z.number().int().min(1).max(1000) });
const addonList = z.array(addonInput).max(100).refine(items => new Set(items.map(i => i.addon_id)).size === items.length,
  'Tambahan tidak boleh duplikat');
const selectionSchema = z.strictObject({ version: versionSchema, package_id: id, background_id: id.nullable().default(null),
  persons: personsSchema, reason });
function checkVersion(actual: number, expected: number): void {
  ensure(actual === expected, 'STALE_VERSION', 'Data berubah di komputer lain; muat ulang sebelum melanjutkan');
}
function active(visit: Visit): void {
  ensure(!['SELESAI','DIBATALKAN'].includes(visit.status), 'TERMINAL_VISIT', 'Kunjungan sudah berakhir');
}
export async function balance(db: Db, transactionId: number): Promise<{ paid: number; refunded: number; net: number }> {
  const paid = Number((await one<{ value: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS value FROM payments WHERE transaction_id=?', [transactionId])).value);
  const refunded = Number((await one<{ value: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS value FROM refunds WHERE transaction_id=?', [transactionId])).value);
  return { paid, refunded, net: paid - refunded };
}
async function refresh(db: Db, transactionId: number): Promise<void> {
  const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=?', [transactionId]);
  const b = await balance(db, transactionId);
  const paymentStatus = sale.cancelled_at ? (sale.total === 0 ? 'TIDAK_ADA_TAGIHAN' : 'LUNAS')
    : sale.price_type_snapshot === null ? (b.net > 0 ? 'BELUM_LUNAS' : 'BELUM_DIBAYAR')
    : b.net > sale.total ? 'KELEBIHAN_BAYAR' : b.net === sale.total ? (sale.total === 0 ? 'TIDAK_ADA_TAGIHAN' : 'LUNAS')
    : b.net === 0 ? 'BELUM_DIBAYAR' : 'BELUM_LUNAS';
  await run(db, 'UPDATE transactions SET payment_status=?,refund_status=?,version=version+1 WHERE id=?',
    [paymentStatus,b.refunded === 0 ? 'BELUM_ADA' : b.refunded === b.paid ? 'PENUH' : 'SEBAGIAN',transactionId]);
}
async function totalItems(db: Db, transactionId: number): Promise<void> {
  const total = Number((await one<{ total: number }>(db,
    'SELECT COALESCE(SUM(amount),0) AS total FROM transaction_items WHERE transaction_id=? AND is_active=TRUE', [transactionId])).total);
  ensure(Number.isSafeInteger(total) && total <= 1_000_000_000_000, 'AMOUNT_LIMIT', 'Total melebihi batas nominal', 422);
  await run(db, 'UPDATE transactions SET subtotal=?,total=? WHERE id=?', [total,total,transactionId]);
  await refresh(db, transactionId);
}
async function event(db: Db, actor: Actor, visit: Visit, type: string, next: Status, why: string | null): Promise<void> {
  await run(db, `INSERT INTO visit_events(visit_id,event_type,from_status,to_status,package_id,queue_number,
    service_date_snapshot,queue_code_snapshot,reason,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`,
  [visit.id,type,type === 'REGISTER' ? null : visit.status,next,visit.package_id,visit.queue_number,visit.service_date,visit.queue_code_snapshot,why,actor.id]);
}
async function nextNumber(db: Db, packageId: number, serviceDate: string): Promise<number> {
  await run(db, `INSERT INTO queue_counters(package_id,service_date,last_number) VALUES(?,?,0)
    ON DUPLICATE KEY UPDATE last_number=last_number`, [packageId,serviceDate]);
  const counter = await one<{ last_number: number }>(db, 'SELECT last_number FROM queue_counters WHERE package_id=? AND service_date=? FOR UPDATE', [packageId,serviceDate]);
  await run(db, 'UPDATE queue_counters SET last_number=last_number+1 WHERE package_id=? AND service_date=?', [packageId,serviceDate]);
  return counter.last_number + 1;
}
async function addItem(db: Db, actor: Actor, saleId: number, type: string, addonId: number | null,
  description: string, qty: number, unit: string, price: number, why: string | null): Promise<void> {
  await run(db, `INSERT INTO transaction_items(transaction_id,item_type,addon_id,description,qty,unit_snapshot,unit_price,amount,reason,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?)`, [saleId,type,addonId,description,qty,unit,price,qty*price,why,actor.id]);
}
async function selectPackage(db: Db, actor: Actor, visit: Visit, sale: Sale, packageId: number,
  backgroundId: number | null, persons: number, why: string | null): Promise<void> {
  const { pkg, background } = await validateSelection(db,packageId,backgroundId,persons,
    sale.price_type_snapshot === null ? undefined : visit);
  const changed = visit.package_id !== packageId || sale.price_type_snapshot === null;
  if (changed && visit.package_id !== null) {
    ensure(['RESERVASI','MENUNGGU'].includes(visit.status), 'PACKAGE_LOCKED', 'Paket hanya boleh diganti sebelum dipanggil');
    const extras = await rows(db, "SELECT id FROM transaction_items WHERE transaction_id=? AND item_type='TAMBAHAN' AND is_active=TRUE", [sale.id]);
    ensure(!extras.length, 'REMOVE_ADDONS_FIRST', 'Kosongkan tambahan lama terlebih dahulu sebelum mengganti paket');
  }
  const type = changed ? pkg.price_type : sale.price_type_snapshot;
  const price = changed ? pkg.price : sale.price_snapshot;
  ensure(type !== null && price !== null, 'MISSING_PRICE', 'Snapshot tarif belum tersedia', 422);
  const included = changed ? pkg.included_persons : sale.included_persons_snapshot;
  const extra = changed ? pkg.extra_person_price : sale.extra_person_price_snapshot;
  const calculation = priceLines(type,price,persons,included,extra);
  const oldBase = await rows<Item>(db, "SELECT * FROM transaction_items WHERE transaction_id=? AND item_type='PAKET' AND is_active=TRUE", [sale.id]);
  const name = changed ? pkg.name : oldBase[0]?.description ?? pkg.name;
  await run(db, `UPDATE transactions SET price_type_snapshot=?,price_snapshot=?,included_persons_snapshot=?,
    extra_person_price_snapshot=?,background_snapshot=? WHERE id=?`,
  [type,price,included,extra,backgroundId === visit.background_id && !changed ? sale.background_snapshot : background?.name ?? null,sale.id]);
  await run(db, "UPDATE transaction_items SET is_active=FALSE WHERE transaction_id=? AND item_type IN ('PAKET','TAMBAH_ORANG') AND is_active=TRUE", [sale.id]);
  await addItem(db,actor,sale.id,'PAKET',null,name,calculation.baseQty,type === 'PER_ORANG' ? 'orang' : 'sesi',price,why);
  if (calculation.extraQty > 0 && extra !== null) await addItem(db,actor,sale.id,'TAMBAH_ORANG',null,'Tambahan orang',calculation.extraQty,'orang',extra,why);
  let queueNumber = visit.queue_number;
  let code = visit.queue_code_snapshot;
  if (changed && visit.status === 'MENUNGGU') {
    await event(db,actor,visit,'MOVE_PACKAGE',visit.status,why);
    queueNumber = await nextNumber(db,packageId,visit.service_date); code = pkg.queue_code;
  }
  await run(db, `UPDATE visits SET package_id=?,background_id=?,persons=?,queue_number=?,queue_code_snapshot=?,version=version+1 WHERE id=?`,
    [packageId,backgroundId,persons,queueNumber,code,visit.id]);
  await totalItems(db,sale.id);
  await audit(db,actor,'transactions',sale.id,'SELECT_PACKAGE',
    { package_id: visit.package_id, background_id: visit.background_id, persons: visit.persons, total: sale.total },
    { package_id: packageId, background_id: backgroundId, persons, price, price_type: type },why);
}
async function setAddons(db: Db, actor: Actor, visit: Visit, sale: Sale,
  requested: z.infer<typeof addonList>, why: string | null): Promise<void> {
  const existing = await rows<Item>(db, "SELECT * FROM transaction_items WHERE transaction_id=? AND item_type='TAMBAHAN' AND is_active=TRUE", [sale.id]);
  for (const input of requested) {
    const old = existing.find(i => i.addon_id === input.addon_id);
    if (old?.qty === input.qty) continue;
    const addon = old ?? await one<{ name: string; unit: string; price: number }>(db,
      `SELECT a.name,a.unit,a.price FROM addons a JOIN package_addons pa ON pa.addon_id=a.id
       WHERE a.id=? AND pa.package_id=? AND a.is_active=TRUE`, [input.addon_id,visit.package_id]);
    if (old) await run(db, 'UPDATE transaction_items SET is_active=FALSE WHERE id=?', [old.id]);
    await addItem(db,actor,sale.id,'TAMBAHAN',input.addon_id,
      'description' in addon ? addon.description : addon.name,input.qty,
      'unit_snapshot' in addon ? addon.unit_snapshot : addon.unit,
      'unit_price' in addon ? addon.unit_price : addon.price,why);
  }
  for (const old of existing) if (!requested.some(i => i.addon_id === old.addon_id))
    await run(db, 'UPDATE transaction_items SET is_active=FALSE WHERE id=?', [old.id]);
  await totalItems(db,sale.id);
  await audit(db,actor,'transactions',sale.id,'SET_ADDONS',existing.map(i => ({ addon_id: i.addon_id, qty: i.qty, unit_price: i.unit_price })),requested,why);
}
export async function detail(db: Db, visitId: number) {
  const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=?', [visitId]);
  const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE visit_id=?', [visitId]);
  const b = await balance(db,sale.id);
  return { visit, transaction: sale, balance: { ...b, due: Math.max(sale.total-b.net,0),
    surplus: sale.price_type_snapshot === null ? 0 : Math.max(b.net-sale.total,0) },
    items: await rows<Item>(db, 'SELECT * FROM transaction_items WHERE transaction_id=? ORDER BY id', [sale.id]),
    payments: await rows<Payment>(db, 'SELECT * FROM payments WHERE transaction_id=? ORDER BY id', [sale.id]),
    refunds: await rows<Refund>(db, 'SELECT * FROM refunds WHERE transaction_id=? ORDER BY id', [sale.id]),
    events: await rows(db, 'SELECT * FROM visit_events WHERE visit_id=? ORDER BY id', [visitId]) };
}
async function receivePayment(db: Db, actor: Actor, sale: Sale, visit: Visit, input: PaymentInput): Promise<number> {
  const hash = fingerprint({ transaction_id: sale.id, ...input });
  const previous = (await rows<Payment>(db, 'SELECT * FROM payments WHERE client_request_id=?', [input.client_request_id]))[0];
  if (previous) {
    ensure(previous.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Request ID pembayaran sudah digunakan untuk data berbeda');
    return previous.id;
  }
  ensure(visit.status !== 'DIBATALKAN', 'CANCELLED', 'Transaksi batal tidak dapat menerima pembayaran');
  const b = await balance(db,sale.id);
  const unallocated = sale.price_type_snapshot === null;
  ensure(!unallocated || (visit.status === 'RESERVASI' && input.payment_type === 'DP'), 'UNALLOCATED_DP_ONLY', 'Tanpa paket hanya dapat menerima DP reservasi');
  ensure(input.payment_type !== 'DP' || visit.customer_type === 'RESERVASI', 'DP_RESERVATION_ONLY', 'DP khusus reservasi', 422);
  ensure(!(input.payment_type === 'DP' && input.method !== 'TUNAI' && !input.reference), 'REFERENCE_REQUIRED', 'DP nontunai wajib memiliki referensi', 422);
  const due = unallocated ? input.amount : sale.total-b.net;
  ensure(due > 0, 'NO_OUTSTANDING', 'Tidak ada sisa tagihan');
  ensure(input.method === 'TUNAI' || input.amount <= due, 'EXCESS_NONCASH', 'Transfer/QRIS tidak boleh melebihi sisa tagihan', 422);
  const amount = Math.min(input.amount,due);
  const paidAt = input.paid_at ?? wib();
  ensure(paidAt <= wib(), 'FUTURE_PAYMENT', 'Tanggal penerimaan tidak boleh di masa depan', 422);
  ensure(Number.isSafeInteger(b.paid + amount) && b.paid + amount <= 1_000_000_000_000,
    'AMOUNT_LIMIT', 'Akumulasi pembayaran melebihi batas nominal', 422);
  const result = await run(db, `INSERT INTO payments(transaction_id,payment_type,method,amount,cash_received,change_amount,
    paid_at,reference,client_request_id,request_hash,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
  [sale.id,input.payment_type,input.method,amount,input.method === 'TUNAI' ? input.amount : null,
    input.method === 'TUNAI' ? input.amount-amount : null,paidAt,input.reference,input.client_request_id,hash,actor.id]);
  await refresh(db,sale.id);
  await audit(db,actor,'transactions',sale.id,'PAYMENT',null,{ payment_id: result.insertId, amount, method: input.method, paid_at: paidAt });
  return result.insertId;
}
async function makeRefund(db: Db, actor: Actor, sale: Sale, input: z.infer<typeof refundSchema>): Promise<number> {
  const hash = fingerprint({ transaction_id: sale.id, ...input });
  const previous = (await rows<Refund>(db, 'SELECT * FROM refunds WHERE client_request_id=?', [input.client_request_id]))[0];
  if (previous) {
    ensure(previous.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Request ID refund sudah digunakan untuk data berbeda');
    return previous.id;
  }
  ensure(sale.cancelled_at === null && sale.price_type_snapshot !== null, 'REFUND_NOT_ALLOWED', 'Refund hanya untuk kelebihan tagihan yang sudah ditentukan');
  const b = await balance(db,sale.id);
  ensure(input.amount <= b.net-sale.total && input.amount <= b.net, 'REFUND_EXCEEDS_SURPLUS', 'Refund melebihi kelebihan bayar');
  const result = await run(db, `INSERT INTO refunds(transaction_id,amount,method,reason,refunded_at,client_request_id,request_hash,created_by)
    VALUES(?,?,?,?,NOW(3),?,?,?)`, [sale.id,input.amount,input.method,input.reason,input.client_request_id,hash,actor.id]);
  await refresh(db,sale.id);
  await audit(db,actor,'transactions',sale.id,'REFUND',null,{ refund_id: result.insertId, amount: input.amount, method: input.method },input.reason);
  return result.insertId;
}
export const operations = Router();
operations.get('/visits', async (req, res) => {
  const q = z.object({ date: z.iso.date().default(today()), from: z.iso.date().optional(), to: z.iso.date().optional(), history: z.enum(['true','false']).default('false'),
    search: z.string().max(100).default(''), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).parse(req.query);
  const from = q.from ?? q.date; const to = q.to ?? q.date;
  ensure(from <= to && new Date(to).getTime()-new Date(from).getTime() <= 366*86400_000,
    'INVALID_RANGE','Rentang tanggal tidak valid atau melebihi 367 hari',422);
  const states = q.history === 'true' ? "('SELESAI','DIBATALKAN')" : "('RESERVASI','MENUNGGU','DIPANGGIL','SEDANG_DILAYANI','DILEWATI')";
  res.json(await read(db => rows(db, `SELECT v.*,t.id AS transaction_id,t.transaction_no,t.total,t.payment_status,t.version AS transaction_version
    FROM visits v JOIN transactions t ON t.visit_id=v.id WHERE v.service_date BETWEEN ? AND ? AND v.status IN ${states}
    AND (v.customer_name LIKE ? OR t.transaction_no LIKE ?)
    ORDER BY v.has_priority DESC, CASE WHEN v.has_priority THEN v.appointment_at ELSE NULL END,
    v.queue_entered_at,v.id LIMIT 100 OFFSET ${100*(q.page-1)}`, [from,to,`%${q.search}%`,`%${q.search}%`])));
});
operations.get('/queue/rooms', async (_req,res) => res.json(await read(db => rows(db,`SELECT p.id AS package_id,p.name,p.is_open,p.closed_reason,
  v.id AS active_visit_id,v.customer_name,v.status,v.service_date FROM packages p LEFT JOIN visits v ON v.package_id=p.id
  AND v.status IN ('DIPANGGIL','SEDANG_DILAYANI') ORDER BY p.id`))));
operations.get('/visits/:id', async (req, res) => res.json(await read(db => detail(db,id.parse(Number(req.params['id']))))));
operations.get('/transactions/:id/audit', async (req, res) => {
  const saleId = id.parse(Number(req.params['id']));
  res.json(await read(async db => {
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=?', [saleId]);
    return rows(db, `SELECT id,entity,entity_id,action,old_values,new_values,reason,user_id,session_id,created_at
      FROM audit_logs WHERE (entity='transactions' AND entity_id=?) OR (entity='visits' AND entity_id=?) ORDER BY id`, [String(saleId),String(sale.visit_id)]);
  }));
});
operations.use(role('ADMIN'));
operations.post('/visits', async (req, res) => {
  const input = z.strictObject({ client_request_id: z.uuid(), customer_name: z.string().trim().min(1).max(100),
    customer_type: z.enum(['WALK_IN','RESERVASI']), appointment_at: timestamp.nullable().default(null),
    package_id: id.nullable().default(null), background_id: id.nullable().default(null),
    persons: personsSchema.nullable().default(null), note: z.string().max(500).nullable().default(null),
    payment: paymentSchema.optional() }).parse(req.body);
  const result = await transaction(async db => {
    const hash = fingerprint(input);
    const previous = (await rows<Visit>(db, 'SELECT * FROM visits WHERE client_request_id=?', [input.client_request_id]))[0];
    if (previous) {
      ensure(previous.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Request ID pendaftaran sudah digunakan untuk data berbeda');
      return detail(db,previous.id);
    }
    const reservation = input.customer_type === 'RESERVASI';
    ensure(reservation ? input.appointment_at !== null : input.appointment_at === null,
      'APPOINTMENT_INVALID', 'Reservasi wajib memiliki jam janji; walk-in tidak memakai jam janji', 422);
    ensure(reservation || (input.package_id !== null && input.persons !== null), 'PACKAGE_REQUIRED', 'Walk-in wajib memilih paket dan jumlah orang', 422);
    ensure(input.package_id !== null || (input.background_id === null && input.persons === null), 'PACKAGE_REQUIRED', 'Latar/jumlah orang memerlukan paket', 422);
    ensure(input.package_id === null || input.persons !== null, 'PERSONS_REQUIRED', 'Jumlah orang wajib jika paket dipilih', 422);
    const serviceDate = reservation ? input.appointment_at!.slice(0,10) : today();
    ensure(serviceDate >= today(), 'PAST_APPOINTMENT', 'Reservasi baru tidak boleh untuk tanggal yang sudah lewat', 422);
    const selection = input.package_id !== null && input.persons !== null
      ? await validateSelection(db,input.package_id,input.background_id,input.persons) : null;
    const queue = !reservation && selection ? await nextNumber(db,selection.pkg.id,serviceDate) : null;
    const inserted = await run(db, `INSERT INTO visits(customer_name,customer_type,appointment_at,service_date,package_id,background_id,
      persons,queue_number,queue_entered_at,queue_code_snapshot,status,note,client_request_id,request_hash,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [input.customer_name,input.customer_type,input.appointment_at,serviceDate,input.package_id,input.background_id,input.persons,
      queue,queue !== null ? wib() : null,queue !== null ? selection!.pkg.queue_code : null,reservation ? 'RESERVASI' : 'MENUNGGU',
      input.note,input.client_request_id,hash,actorOf(req).id]);
    await run(db, 'INSERT INTO transactions(transaction_no,visit_id,created_by) VALUES(?,?,?)',
      [`DS-${today().replaceAll('-','')}-${String(inserted.insertId).padStart(6,'0')}`,inserted.insertId,actorOf(req).id]);
    let visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=?', [inserted.insertId]);
    let sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE visit_id=?', [visit.id]);
    if (input.package_id !== null && input.persons !== null) {
      // Nomor pendaftaran sudah dialokasikan; hindari alokasi ulang saat snapshot pertama dibuat.
      await selectPackage(db,actorOf(req),{ ...visit, status: 'RESERVASI' },sale,input.package_id,input.background_id,input.persons,null);
      visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=?', [visit.id]);
      sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=?', [sale.id]);
    }
    await event(db,actorOf(req),visit,'REGISTER',visit.status,null);
    await audit(db,actorOf(req),'visits',visit.id,'REGISTER',null,{ customer_name: visit.customer_name, status: visit.status, service_date: serviceDate });
    if (input.payment) await receivePayment(db,actorOf(req),sale,visit,input.payment);
    return detail(db,visit.id);
  });
  res.status(201).json(result);
});
operations.put('/visits/:id/selection', async (req, res) => {
  const visitId = id.parse(Number(req.params['id'])); const input = selectionSchema.parse(req.body);
  res.json(await transaction(async db => {
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=? FOR UPDATE', [visitId]);
    active(visit); checkVersion(visit.version,input.version);
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE visit_id=? FOR UPDATE', [visitId]);
    await selectPackage(db,actorOf(req),visit,sale,input.package_id,input.background_id,input.persons,input.reason);
    return detail(db,visitId);
  }));
});
operations.post('/visits/:id/actions', async (req, res) => {
  const visitId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ version: versionSchema, action: z.enum(['CONFIRM','CALL','START','SKIP','RETURN','CANCEL']),
    reason: reason.optional(), priority: z.boolean().default(true) }).parse(req.body);
  res.json(await transaction(async db => {
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=? FOR UPDATE', [visitId]);
    active(visit); checkVersion(visit.version,input.version);
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE visit_id=? FOR UPDATE', [visitId]);
    let next: Status = visit.status;
    if (input.action === 'CONFIRM') {
      ensure(visit.status === 'RESERVASI', 'INVALID_TRANSITION', 'Hanya reservasi yang dapat dikonfirmasi');
      ensure(visit.service_date === today() && visit.appointment_at !== null && visit.appointment_at <= wib(),
        'APPOINTMENT_NOT_DUE', 'Konfirmasi hanya pada tanggal dan mulai jam janji');
      ensure(input.priority || !!input.reason, 'REASON_REQUIRED', 'Konfirmasi tanpa prioritas wajib disertai alasan', 422);
      ensure(visit.package_id !== null && visit.persons !== null, 'PACKAGE_REQUIRED', 'Lengkapi paket/latar/jumlah orang terlebih dahulu', 422);
      const { pkg } = await validateSelection(db,visit.package_id,visit.background_id,visit.persons,visit);
      const number = await nextNumber(db,pkg.id,visit.service_date);
      await run(db, 'UPDATE visits SET queue_number=?,queue_code_snapshot=?,queue_entered_at=NOW(3),has_priority=? WHERE id=?',
        [number,pkg.queue_code,input.priority,visitId]); next = 'MENUNGGU';
    } else if (input.action === 'CALL') {
      ensure(visit.status === 'MENUNGGU', 'INVALID_TRANSITION', 'Hanya pelanggan menunggu yang dapat dipanggil');
      ensure(visit.service_date === today(), 'WRONG_SERVICE_DATE', 'Antrean hari lain tidak dapat dipanggil');
      const pkg = await one<{ is_open: number }>(db, 'SELECT is_open FROM packages WHERE id=? FOR UPDATE', [visit.package_id]);
      ensure(!!pkg.is_open, 'ROOM_CLOSED', 'Ruangan sedang ditutup');
      ensure(!(await rows(db, "SELECT id FROM visits WHERE package_id=? AND status IN ('DIPANGGIL','SEDANG_DILAYANI')", [visit.package_id])).length,
        'ROOM_BUSY', 'Paket masih memiliki pelanggan dipanggil/sedang dilayani');
      const first = await one<{ id: number }>(db, `SELECT id FROM visits WHERE package_id=? AND service_date=? AND status='MENUNGGU'
        ORDER BY has_priority DESC,CASE WHEN has_priority THEN appointment_at ELSE NULL END,queue_entered_at,id LIMIT 1`, [visit.package_id,today()]);
      ensure(first.id === visit.id || !!input.reason, 'OUT_OF_ORDER_REASON', 'Memanggil di luar urutan memerlukan alasan', 422);
      await run(db, 'UPDATE visits SET called_at=NOW(3) WHERE id=?', [visitId]); next = 'DIPANGGIL';
    } else if (input.action === 'START') {
      ensure(visit.status === 'DIPANGGIL', 'INVALID_TRANSITION', 'Panggil pelanggan sebelum mulai sesi');
      const b = await balance(db,sale.id);
      ensure(sale.price_type_snapshot !== null && b.net === sale.total, 'PAYMENT_REQUIRED_BEFORE_START',
        b.net > sale.total ? 'Kembalikan kelebihan bayar sebelum mulai foto' : 'Lunasi tagihan awal sebelum mulai foto');
      await audit(db,actorOf(req),'transactions',sale.id,'START_PAYMENT_CHECK',null,{ total: sale.total, net_paid: b.net });
      await run(db, 'UPDATE visits SET started_at=NOW(3) WHERE id=?', [visitId]); next = 'SEDANG_DILAYANI';
    } else if (input.action === 'SKIP') {
      ensure(visit.status === 'DIPANGGIL', 'INVALID_TRANSITION', 'Hanya pelanggan dipanggil yang dapat dilewati');
      ensure(!!input.reason, 'REASON_REQUIRED', 'Alasan melewati wajib diisi', 422); next = 'DILEWATI';
    } else if (input.action === 'RETURN') {
      ensure(visit.status === 'DILEWATI' && visit.service_date === today(), 'INVALID_TRANSITION', 'Hanya antrean dilewati hari ini yang dapat kembali');
      ensure(!!input.reason, 'REASON_REQUIRED', 'Alasan kembali wajib diisi', 422);
      await run(db, 'UPDATE visits SET has_priority=FALSE,queue_entered_at=NOW(3),called_at=NULL WHERE id=?', [visitId]); next = 'MENUNGGU';
    } else {
      ensure(visit.status !== 'SEDANG_DILAYANI', 'CANNOT_CANCEL_STARTED', 'Sesi yang sudah dimulai tidak boleh dibatalkan');
      ensure(!!input.reason, 'REASON_REQUIRED', 'Alasan pembatalan wajib diisi', 422);
      const b = await balance(db,sale.id);
      await run(db, 'UPDATE transactions SET total=?,cancelled_at=NOW(3) WHERE id=?', [b.net,sale.id]);
      await run(db, 'UPDATE visits SET cancel_reason=? WHERE id=?', [input.reason ?? null,visitId]);
      await refresh(db,sale.id); next = 'DIBATALKAN';
    }
    await event(db,actorOf(req),visit,input.action,next,input.reason ?? null);
    await run(db, 'UPDATE visits SET status=?,version=version+1 WHERE id=?', [next,visitId]);
    await audit(db,actorOf(req),'visits',visitId,input.action,{ status: visit.status },{ status: next },input.reason ?? null);
    return detail(db,visitId);
  }));
});
operations.put('/transactions/:id/addons', async (req, res) => {
  const saleId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ version: versionSchema, addons: addonList, reason }).parse(req.body);
  res.json(await transaction(async db => {
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=? FOR UPDATE', [saleId]);
    checkVersion(sale.version,input.version);
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=? FOR UPDATE', [sale.visit_id]); active(visit);
    ensure(visit.package_id !== null, 'PACKAGE_REQUIRED', 'Pilih paket sebelum tambahan', 422);
    await setAddons(db,actorOf(req),visit,sale,input.addons,input.reason);
    return detail(db,visit.id);
  }));
});
operations.post('/transactions/:id/payments', async (req, res) => {
  const saleId = id.parse(Number(req.params['id'])); const input = paymentSchema.parse(req.body);
  res.status(201).json(await transaction(async db => {
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=? FOR UPDATE', [saleId]);
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=?', [sale.visit_id]);
    await receivePayment(db,actorOf(req),sale,visit,input); return detail(db,visit.id);
  }));
});
operations.post('/transactions/:id/refunds', async (req, res) => {
  const saleId = id.parse(Number(req.params['id'])); const input = refundSchema.parse(req.body);
  res.status(201).json(await transaction(async db => {
    const sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=? FOR UPDATE', [saleId]);
    await makeRefund(db,actorOf(req),sale,input); return detail(db,sale.visit_id);
  }));
});
operations.post('/visits/:id/finish', async (req, res) => {
  const visitId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ version: versionSchema, transaction_version: versionSchema,
    persons: personsSchema, addons: addonList, reason: reason.optional(), payment: paymentSchema.optional(), refund: refundSchema.optional() }).parse(req.body);
  res.json(await transaction(async db => {
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=? FOR UPDATE', [visitId]);
    checkVersion(visit.version,input.version);
    ensure(visit.status === 'SEDANG_DILAYANI', 'INVALID_TRANSITION', 'Hanya sesi berjalan dapat diselesaikan');
    let sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE visit_id=? FOR UPDATE', [visitId]);
    checkVersion(sale.version,input.transaction_version);
    ensure(visit.package_id !== null, 'PACKAGE_REQUIRED', 'Paket belum dipilih', 422);
    const oldAddons = await rows<Item>(db,"SELECT * FROM transaction_items WHERE transaction_id=? AND item_type='TAMBAHAN' AND is_active=TRUE",[sale.id]);
    const addonsChanged = oldAddons.length !== input.addons.length || oldAddons.some(old => !input.addons.some(i => i.addon_id === old.addon_id && i.qty === old.qty));
    if (sale.payment_status === 'LUNAS' && (visit.persons !== input.persons || addonsChanged))
      ensure(!!input.reason, 'REASON_REQUIRED', 'Perubahan transaksi lunas wajib memiliki alasan', 422);
    await selectPackage(db,actorOf(req),visit,sale,visit.package_id,visit.background_id,input.persons,input.reason ?? 'Konfirmasi akhir sesi');
    await setAddons(db,actorOf(req),visit,sale,input.addons,input.reason ?? 'Konfirmasi akhir sesi');
    sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=?', [sale.id]);
    if (input.refund) await makeRefund(db,actorOf(req),sale,input.refund);
    if (input.payment) await receivePayment(db,actorOf(req),sale,visit,input.payment);
    const b = await balance(db,sale.id);
    ensure(b.net === sale.total, 'UNSETTLED', b.net > sale.total ? 'Refund kelebihan bayar sebelum selesai' : 'Lunasi seluruh tagihan sebelum selesai');
    await run(db, "UPDATE visits SET status='SELESAI',finished_at=NOW(3),version=version+1 WHERE id=?", [visitId]);
    await run(db, 'UPDATE transactions SET completed_at=NOW(3),version=version+1 WHERE id=?', [sale.id]);
    await event(db,actorOf(req),visit,'FINISH','SELESAI',input.reason ?? null);
    await audit(db,actorOf(req),'transactions',sale.id,'FINISH',null,{ total: sale.total, net: b.net },input.reason ?? null);
    return detail(db,visitId);
  }));
});

// Koreksi mengubah catatan yang salah, bukan menciptakan arus kas baru. Nilai asal tetap ada di audit.
operations.post('/transactions/:id/corrections', async (req, res) => {
  const saleId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ version: versionSchema, reason,
    customer_name: z.string().trim().min(1).max(100).optional(),
    payments: z.array(z.strictObject({ id, method, amount: money.refine(n => n > 0),
      cash_received: money.nullable(), paid_at: timestamp, reference: z.string().trim().min(1).max(100).nullable() })).max(50).default([]),
    items: z.array(z.strictObject({ id, unit_price: money })).max(100).default([]),
    payment: paymentSchema.optional(), refund: refundSchema.optional(),
  }).parse(req.body);
  ensure(new Set(input.payments.map(p => p.id)).size === input.payments.length && new Set(input.items.map(p => p.id)).size === input.items.length,
    'DUPLICATE_ID', 'ID koreksi tidak boleh berulang', 422);
  res.json(await transaction(async db => {
    let sale = await one<Sale>(db, 'SELECT * FROM transactions WHERE id=? FOR UPDATE', [saleId]);
    checkVersion(sale.version,input.version);
    const visit = await one<Visit>(db, 'SELECT * FROM visits WHERE id=? FOR UPDATE', [sale.visit_id]);
    const before: Json = { customer_name: visit.customer_name, total: sale.total,
      payments: (await rows<Payment>(db,'SELECT * FROM payments WHERE transaction_id=?',[saleId])).map(p => ({ id: p.id, amount: p.amount, method: p.method, paid_at: p.paid_at, reference: p.reference, cash_received: p.cash_received, change_amount: p.change_amount })),
      items: (await rows<Item>(db,'SELECT * FROM transaction_items WHERE transaction_id=? AND is_active=TRUE',[saleId])).map(i => ({ id: i.id, unit_price: i.unit_price, amount: i.amount })) };
    if (input.customer_name) await run(db, 'UPDATE visits SET customer_name=?,version=version+1 WHERE id=?', [input.customer_name,visit.id]);
    for (const p of input.payments) {
      const old = await one<Payment>(db, 'SELECT * FROM payments WHERE id=? AND transaction_id=?', [p.id,saleId]);
      ensure(p.paid_at <= wib(), 'FUTURE_PAYMENT', 'Tanggal penerimaan tidak boleh di masa depan', 422);
      ensure(p.method === 'TUNAI' ? p.cash_received !== null && p.cash_received >= p.amount : p.cash_received === null,
        'INVALID_CASH', 'Uang tunai harus cukup; nontunai tidak memakai cash_received', 422);
      ensure(old.payment_type !== 'DP' || p.method === 'TUNAI' || !!p.reference, 'REFERENCE_REQUIRED', 'DP nontunai wajib referensi', 422);
      await run(db, 'UPDATE payments SET method=?,amount=?,cash_received=?,change_amount=?,paid_at=?,reference=? WHERE id=?',
        [p.method,p.amount,p.cash_received,p.method === 'TUNAI' ? p.cash_received!-p.amount : null,p.paid_at,p.reference,p.id]);
    }
    for (const item of input.items) {
      const old = await one<Item>(db, 'SELECT * FROM transaction_items WHERE id=? AND transaction_id=? AND is_active=TRUE', [item.id,saleId]);
      await run(db, 'UPDATE transaction_items SET is_active=FALSE WHERE id=?', [old.id]);
      await addItem(db,actorOf(req),saleId,old.item_type,old.addon_id,old.description,old.qty,old.unit_snapshot,item.unit_price,input.reason);
      if (old.item_type === 'PAKET') await run(db, 'UPDATE transactions SET price_snapshot=? WHERE id=?', [item.unit_price,saleId]);
      if (old.item_type === 'TAMBAH_ORANG') await run(db, 'UPDATE transactions SET extra_person_price_snapshot=? WHERE id=?', [item.unit_price,saleId]);
    }
    const b = await balance(db,saleId);
    ensure(b.net >= 0 && b.paid <= 1_000_000_000_000, 'INVALID_BALANCE', 'Koreksi pembayaran membuat saldo tidak valid');
    if (visit.status === 'DIBATALKAN') {
      ensure(!input.items.length && !input.payment && !input.refund, 'CANCELLED', 'Transaksi batal hanya menerima koreksi data pelanggan/penerimaan');
      await run(db,'UPDATE transactions SET total=? WHERE id=?',[b.net,saleId]); await refresh(db,saleId);
    } else await totalItems(db,saleId);
    sale = await one<Sale>(db,'SELECT * FROM transactions WHERE id=?',[saleId]);
    if (input.refund) await makeRefund(db,actorOf(req),sale,input.refund);
    if (input.payment) await receivePayment(db,actorOf(req),sale,visit,input.payment);
    if (visit.status === 'SELESAI') ensure((await balance(db,saleId)).net === sale.total, 'UNSETTLED_CORRECTION',
      'Koreksi transaksi selesai harus tetap lunas; sertakan pembayaran/refund nyata bila diperlukan');
    await audit(db,actorOf(req),'transactions',saleId,'CORRECTION',before,JSON.parse(JSON.stringify(input)) as Json,input.reason);
    return detail(db,visit.id);
  }));
});
