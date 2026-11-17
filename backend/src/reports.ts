import { Router, type Response } from 'express';
import { z } from 'zod';
import PdfPrinter from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import ExcelJS from 'exceljs';
import { actorOf, role } from './auth.js';
import { ensure, id, today } from './core.js';
import { snapshot as read, rows, one, type Db } from './db.js';
import { detail, queueLabel } from './operations.js';

const printer = new PdfPrinter({ Helvetica: {
  normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique',
} });
function pdf(res: Response, filename: string, content: Content[], landscape = false): void {
  const doc: TDocumentDefinitions = { pageSize: 'A4', pageOrientation: landscape ? 'landscape' : 'portrait',
    defaultStyle: { font: 'Helvetica', fontSize: 9 }, content,
    footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'center', fontSize: 8 }) };
  const output = printer.createPdfKitDocument(doc);
  res.type('application/pdf').attachment(filename);
  output.on('error', error => res.destroy(error));
  output.pipe(res); output.end();
}
type ReportRow = Record<string, string | number | null>;
const labels: Record<string,string> = {
  paid_at: 'Waktu (WIB)',transaction_no: 'No. transaksi',customer_name: 'Pelanggan',customer_type: 'Jenis',package_name: 'Paket',
  persons: 'Orang',method: 'Metode',status: 'Status',amount: 'Nominal (Rp)',
  package_id: 'ID paket',name: 'Paket',payments: 'Pembayaran',sales: 'Penjualan (Rp)',
};
// Hanya dua laporan: L-01 Penjualan dan L-02 Penjualan per Paket.
// L-03 Penerimaan Uang dihapus (17 Nov 2026) dan L-04 Rekap Kunjungan dihapus (kebutuhannya dipenuhi menu Riwayat).
const titles = { sales: 'L-01 Penjualan',packages: 'L-02 Penjualan per Paket' };
function display(_key: string,value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString('id-ID');
  return value.replace(/(\d{2}:\d{2}:\d{2})\.\d+$/,'$1');
}
export function period(input: { period: 'today' | 'week' | 'month' | 'custom'; from?: string | undefined; to?: string | undefined }): { from: string; to: string } {
  let from = today(); let to = today();
  if (input.period === 'week') {
    const value = new Date(`${from}T00:00:00Z`); const offset = (value.getUTCDay()+6)%7;
    value.setUTCDate(value.getUTCDate()-offset); from = value.toISOString().slice(0,10);
    value.setUTCDate(value.getUTCDate()+6); to = value.toISOString().slice(0,10);
  } else if (input.period === 'month') {
    from = `${today().slice(0,7)}-01`;
    const value = new Date(`${from}T00:00:00Z`); value.setUTCMonth(value.getUTCMonth()+1); value.setUTCDate(0);
    to = value.toISOString().slice(0,10);
  } else if (input.period === 'custom') {
    ensure(!!input.from && !!input.to, 'DATE_RANGE_REQUIRED', 'Periode custom memerlukan from dan to', 422);
    from = input.from; to = input.to;
  }
  ensure(from <= to && new Date(to).getTime()-new Date(from).getTime() <= 366*86400_000,
    'INVALID_RANGE', 'Rentang tanggal harus berurutan dan maksimal 367 hari', 422);
  return { from, to };
}
const querySchema = z.object({ period: z.enum(['today','week','month','custom']).default('today'),
  from: z.iso.date().optional(), to: z.iso.date().optional(), format: z.enum(['json','pdf','xlsx']).default('json') });
const reportCode = z.enum(['sales','packages']);
// Laporan = BUKU KAS (17 Nov 2026): uang masuk (+) dan keluar (−) dicatat pada hari kejadiannya.
// - DP reservasi → baris "DP"; pelunasan saat datang / bayar selisih naik paket → baris "Lunas";
// - bayar penuh sekaligus (Di Tempat / reservasi lunas) → satu baris "Lunas";
// - turun paket / kurangi tambahan → kelebihan dikembalikan → baris "Refund" bernilai MINUS pada hari pengembalian;
// - kunjungan yang dibatalkan tetap tercatat (uangnya ditahan, tidak dikembalikan).
const methodLabel = (alias: string) => `CASE ${alias}.method WHEN 'TUNAI' THEN 'Tunai' WHEN 'TRANSFER' THEN 'Transfer' ELSE 'QRIS' END`;
const PACKAGE_NAME = `(SELECT i.description FROM transaction_items i WHERE i.transaction_id=t.id AND i.item_type='PAKET' AND i.is_active=TRUE LIMIT 1)`;
const CUSTOMER_TYPE = `CASE v.customer_type WHEN 'RESERVASI' THEN 'Reservasi' ELSE 'Di Tempat' END`;
async function report(db: Db, code: z.infer<typeof reportCode>, from: string, to: string): Promise<ReportRow[]> {
  const start = `${from} 00:00:00`; const end = `${to} 23:59:59.999`;
  if (code === 'sales') return rows<ReportRow>(db, `SELECT * FROM (
    SELECT p.paid_at,t.transaction_no,v.customer_name,${CUSTOMER_TYPE} AS customer_type,${PACKAGE_NAME} AS package_name,
      v.persons,${methodLabel('p')} AS method,CASE p.payment_type WHEN 'DP' THEN 'DP' ELSE 'Lunas' END AS status,CAST(p.amount AS SIGNED) AS amount
    FROM payments p JOIN transactions t ON t.id=p.transaction_id JOIN visits v ON v.id=t.visit_id WHERE p.paid_at BETWEEN ? AND ?
    UNION ALL
    SELECT r.refunded_at,t.transaction_no,v.customer_name,${CUSTOMER_TYPE},${PACKAGE_NAME},
      v.persons,${methodLabel('r')},'Refund',-CAST(r.amount AS SIGNED)
    FROM refunds r JOIN transactions t ON t.id=r.transaction_id JOIN visits v ON v.id=t.visit_id WHERE r.refunded_at BETWEEN ? AND ?
    ) kas ORDER BY paid_at,transaction_no LIMIT 10001`, [start,end,start,end]);
  // L-02 = L-01 dikelompokkan per paket kunjungan (bersih setelah refund). payments = jumlah pembayaran masuk.
  return rows<ReportRow>(db, `SELECT pk.id AS package_id,pk.name,COUNT(x.payment_id) AS payments,COALESCE(SUM(x.amount),0) AS sales
    FROM packages pk LEFT JOIN (
      SELECT p.id AS payment_id,CAST(p.amount AS SIGNED) AS amount,v.package_id FROM payments p JOIN transactions t ON t.id=p.transaction_id
        JOIN visits v ON v.id=t.visit_id WHERE p.paid_at BETWEEN ? AND ?
      UNION ALL
      SELECT NULL,-CAST(r.amount AS SIGNED),v.package_id FROM refunds r JOIN transactions t ON t.id=r.transaction_id
        JOIN visits v ON v.id=t.visit_id WHERE r.refunded_at BETWEEN ? AND ?
    ) x ON x.package_id=pk.id
    GROUP BY pk.id,pk.name ORDER BY sales DESC,payments DESC,pk.id LIMIT 10001`, [start,end,start,end]);
}
export const reports = Router();
// Nota dapat dibaca kedua role; hak tulis kasir tetap Admin.
// Nota tersedia sejak transaksi lunas (dicetak saat mendaftar), dengan nomor antrean di bagian atas.
reports.get('/transactions/:id/receipt.pdf', async (req, res) => {
  const saleId = id.parse(Number(req.params['id']));
  const result = await read(async db => {
    const sale = await one<{ visit_id: number }>(db, 'SELECT visit_id FROM transactions WHERE id=?', [saleId]);
    return detail(db,sale.visit_id);
  });
  const { visit, transaction: sale } = result;
  ensure(sale.paid_off_at !== null || visit.status === 'SELESAI', 'RECEIPT_NOT_READY', 'Nota tersedia setelah transaksi lunas');
  const queue = queueLabel(visit);
  const rp = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
  const change = result.payments.reduce((sum,p) => sum+(p.change_amount ?? 0),0);
  // Reservasi yang lunas sebelum datang belum punya nomor antrean, jadi jadwalnya ikut dicetak.
  const at = visit.customer_type === 'RESERVASI' ? visit.appointment_at : null;
  const content: Content[] = [
    { text: 'DREAM SPACE', bold: true, fontSize: 16 },
    ...(queue ? [{ text: queue, bold: true, fontSize: 32, margin: [0,6,0,0] as [number,number,number,number] }, { text: 'Nomor antrean', fontSize: 8 }] : []),
    { text: `${visit.customer_name} · ${sale.transaction_no}`, margin: [0,10,0,0] },
    ...(at ? [`Reservasi: ${at.slice(8,10)}/${at.slice(5,7)}/${at.slice(0,4)} ${at.slice(11,16).replace(':','.')} WIB`] : []),
    `Lunas: ${display('paid_off_at',sale.paid_off_at ?? sale.completed_at)} WIB`,
    { margin: [0,10,0,10], table: { headerRows: 1, widths: ['*','auto','auto'], body: [
      ['Layanan','Jumlah','Nilai'], ...result.items.filter(i => i.is_active).map(i => [i.description,`${i.qty} ${i.unit_snapshot}`,rp(i.amount)]),
    ] } },
    { text: `TOTAL ${rp(sale.total)}`, bold: true, fontSize: 13 },
    ...result.payments.map(p => `${p.method === 'TUNAI' ? 'Tunai' : p.method === 'TRANSFER' ? 'Transfer' : 'QRIS'}: ${rp(p.payment_type === 'PEMBAYARAN' && p.cash_received ? p.cash_received : p.amount)}`),
    `Kembalian: ${rp(change)}`,
    ...(result.balance.refunded > 0 ? [`Refund: ${rp(result.balance.refunded)}`] : []),
  ];
  pdf(res,`nota-${saleId}.pdf`,content);
});
reports.use('/dashboard',role('OWNER'));
// Laporan: Owner bebas memilih periode; Admin hanya hari ini (melihat total penjualan hari itu).
reports.get('/reports/:code', async (req, res) => {
  const code = reportCode.parse(req.params['code']); const q = querySchema.parse(req.query); const range = period(q);
  ensure(actorOf(req).role === 'OWNER' || (range.from === today() && range.to === today()),
    'REPORT_TODAY_ONLY', 'Admin hanya dapat melihat laporan hari ini', 403);
  const data = await read(db => report(db,code,range.from,range.to));
  ensure(data.length <= 10000, 'REPORT_TOO_LARGE', 'Data melebihi 10.000 baris; persempit periode', 422);
  if (q.format === 'json') { res.json({ code, ...range, rows: data }); return; }
  const columns = Object.keys(data[0] ?? { info: 'Tidak ada data' });
  const weights = columns.map(key => key === 'id' || key === 'persons' ? 0.4
    : key === 'transaction_no' || key === 'category' ? 1.5 : 1);
  const weightTotal = weights.reduce((sum,value) => sum+value,0);
  // Lebar eksplisit mencegah minimum kolom '*' mendorong tabel melewati kertas.
  const widths = weights.map(weight => (841.89-80-16*(columns.length-1))*weight/weightTotal);
  if (q.format === 'xlsx') {
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'Dream Space';
    const sheet = workbook.addWorksheet(code);
    sheet.columns = columns.map(key => ({ header: labels[key] ?? key, key, width: 24 }));
    for (const row of data) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1,column: 1 }, to: { row: Math.max(1,data.length+1),column: columns.length } };
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${code}-${range.from}-${range.to}.xlsx`);
    await workbook.xlsx.write(res); res.end(); return;
  }
  pdf(res,`${code}-${range.from}-${range.to}.pdf`,[
    { text: `Dream Space - ${titles[code]}`, fontSize: 18, bold: true },
    { text: `${range.from} s.d. ${range.to} (WIB)`, margin: [0,6,0,12] },
    data.length ? { fontSize: 9, layout: 'lightHorizontalLines', table: {
      headerRows: 1, widths, body: [
        columns.map(c => ({ text: labels[c] ?? c,bold: true,color: '#ffffff',fillColor: '#49365e' })),
        ...data.map(row => columns.map(c => display(c,row[c]))),
      ] } }
      : { text: 'Tidak ada data pada periode ini.' },
  ],true);
});
reports.get('/dashboard', async (req, res) => {
  const range = period(querySchema.parse(req.query));
  res.json(await read(async db => {
    const start = `${range.from} 00:00:00`; const end = `${range.to} 23:59:59.999`;
    // Sama dengan L-01 (buku kas): DP + Lunas masuk, Refund keluar; sales = uang bersih.
    const sum = await one<{ dp_count: number; dp_amount: number; lunas_count: number; lunas_amount: number }>(db,
      `SELECT COALESCE(SUM(payment_type='DP'),0) AS dp_count,COALESCE(SUM(CASE WHEN payment_type='DP' THEN amount END),0) AS dp_amount,
        COALESCE(SUM(payment_type<>'DP'),0) AS lunas_count,COALESCE(SUM(CASE WHEN payment_type<>'DP' THEN amount END),0) AS lunas_amount
      FROM payments WHERE paid_at BETWEEN ? AND ?`, [start,end]);
    const out = await one<{ count: number; amount: number }>(db,
      'SELECT COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount FROM refunds WHERE refunded_at BETWEEN ? AND ?', [start,end]);
    // Per metode: masuk dikurangi keluar; jumlah semua metode = sales.
    const methods = await rows<{ method: string; amount: number }>(db, `SELECT m.method,SUM(m.amount) AS amount FROM (
      SELECT method,CAST(amount AS SIGNED) AS amount FROM payments WHERE paid_at BETWEEN ? AND ?
      UNION ALL SELECT method,-CAST(amount AS SIGNED) FROM refunds WHERE refunded_at BETWEEN ? AND ?
      ) m GROUP BY m.method ORDER BY m.method`, [start,end,start,end]);
    const dp = { count: Number(sum.dp_count), amount: Number(sum.dp_amount) };
    const lunas = { count: Number(sum.lunas_count), amount: Number(sum.lunas_amount) };
    const refund = { count: Number(out.count), amount: Number(out.amount) };
    return { ...range, sales: dp.amount + lunas.amount - refund.amount, dp, lunas, refund,
      methods: methods.map(m => ({ method: m.method, amount: Number(m.amount) })),
      packages: await report(db,'packages',range.from,range.to),
      visits_by_status: await rows(db, 'SELECT status,COUNT(*) AS count FROM visits WHERE service_date BETWEEN ? AND ? GROUP BY status', [range.from,range.to]) };
  }));
});
