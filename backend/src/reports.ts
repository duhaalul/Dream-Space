import { Router, type Response } from 'express';
import { z } from 'zod';
import PdfPrinter from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import ExcelJS from 'exceljs';
import { role } from './auth.js';
import { ensure, id, today } from './core.js';
import { snapshot as read, rows, one, type Db } from './db.js';
import { detail } from './operations.js';

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
  id: 'ID',transaction_no: 'No. transaksi',customer_name: 'Pelanggan',package_name: 'Paket',persons: 'Orang',
  subtotal: 'Subtotal (Rp)',total: 'Total (Rp)',completed_at: 'Selesai',package_id: 'ID paket',name: 'Paket',
  sessions: 'Sesi',sales: 'Penjualan (Rp)',kind: 'Jenis',method: 'Metode',cash_in: 'Masuk (Rp)',cash_out: 'Keluar (Rp)',
  net: 'Bersih (Rp)',occurred_at: 'Waktu (WIB)',category: 'Kategori',customer_type: 'Jenis pelanggan',
  service_date: 'Tanggal layanan',appointment_at: 'Jam janji',queue_label: 'Antrean',status: 'Status',
  queue_entered_at: 'Masuk antrean',called_at: 'Dipanggil',started_at: 'Mulai',finished_at: 'Selesai',
  cancel_reason: 'Alasan batal',payment_status: 'Pembayaran',
};
const titles = { sales: 'L-01 Penjualan',packages: 'L-02 Kinerja Paket',cash: 'L-03 Arus Kas',visits: 'L-04 Kunjungan' };
function display(key: string,value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString('id-ID');
  if (['kind','category','status','customer_type','payment_status'].includes(key)) {
    if (value === 'PAYMENT') return 'Pembayaran';
    if (value === 'WALK_IN') return 'Datang langsung';
    return value.replaceAll('_',' ');
  }
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
const reportCode = z.enum(['sales','packages','cash','visits']);
async function report(db: Db, code: z.infer<typeof reportCode>, from: string, to: string): Promise<ReportRow[]> {
  const start = `${from} 00:00:00`; const end = `${to} 23:59:59.999`;
  if (code === 'sales') return rows<ReportRow>(db, `SELECT t.transaction_no,v.customer_name,
    (SELECT i.description FROM transaction_items i WHERE i.transaction_id=t.id AND i.item_type='PAKET' AND i.is_active=TRUE LIMIT 1) AS package_name,
    v.persons,t.subtotal,t.total,t.completed_at FROM transactions t JOIN visits v ON v.id=t.visit_id
    WHERE v.status='SELESAI' AND t.completed_at BETWEEN ? AND ? ORDER BY t.completed_at,t.id LIMIT 10001`, [start,end]);
  if (code === 'packages') return rows<ReportRow>(db, `SELECT p.id AS package_id,p.name,
    COUNT(t.id) AS sessions,COALESCE(SUM(t.total),0) AS sales FROM packages p
    LEFT JOIN visits v ON v.package_id=p.id AND v.status='SELESAI'
    LEFT JOIN transactions t ON t.visit_id=v.id AND t.completed_at BETWEEN ? AND ?
    GROUP BY p.id,p.name ORDER BY sessions DESC,p.id LIMIT 10001`, [start,end]);
  if (code === 'cash') return rows<ReportRow>(db, `SELECT * FROM (
    SELECT p.id,'PAYMENT' AS kind,t.transaction_no,p.method,p.amount AS cash_in,0 AS cash_out,p.amount AS net,
      p.paid_at AS occurred_at,CASE WHEN v.status='DIBATALKAN' THEN 'BATAL_DITAHAN' ELSE 'NORMAL' END AS category
    FROM payments p JOIN transactions t ON t.id=p.transaction_id JOIN visits v ON v.id=t.visit_id WHERE p.paid_at BETWEEN ? AND ?
    UNION ALL
    SELECT r.id,'REFUND',t.transaction_no,r.method,0,r.amount,-CAST(r.amount AS SIGNED),r.refunded_at,'REFUND_KELEBIHAN'
    FROM refunds r JOIN transactions t ON t.id=r.transaction_id WHERE r.refunded_at BETWEEN ? AND ?
    ) cash ORDER BY occurred_at,id LIMIT 10001`, [start,end,start,end]);
  return rows<ReportRow>(db, `SELECT v.id,v.customer_name,v.customer_type,v.service_date,v.appointment_at,
    CONCAT(v.queue_code_snapshot,'-',LPAD(v.queue_number,3,'0')) AS queue_label,
    v.status,v.queue_entered_at,v.called_at,v.started_at,v.finished_at,v.cancel_reason,t.total,t.payment_status
    FROM visits v JOIN transactions t ON t.visit_id=v.id WHERE v.service_date BETWEEN ? AND ? ORDER BY v.service_date,v.id LIMIT 10001`, [from,to]);
}
export const reports = Router();
// Nota dapat dibaca kedua role; hak tulis kasir tetap Admin.
reports.get('/transactions/:id/receipt.pdf', async (req, res) => {
  const saleId = id.parse(Number(req.params['id']));
  const result = await read(async db => {
    const sale = await one<{ visit_id: number }>(db, 'SELECT visit_id FROM transactions WHERE id=?', [saleId]);
    return detail(db,sale.visit_id);
  });
  ensure(result.visit.status === 'SELESAI', 'RECEIPT_NOT_READY', 'Nota tersedia setelah sesi selesai');
  const content: Content[] = [
    { text: 'DREAM SPACE', bold: true, fontSize: 20 }, { text: 'Nota pembayaran', margin: [0,4,0,12] },
    `Nomor: ${result.transaction.transaction_no}`, `Pelanggan: ${result.visit.customer_name}`,
    `Selesai: ${display('completed_at',result.transaction.completed_at)} WIB`, `Latar: ${result.transaction.background_snapshot ?? '-'}`,
    { margin: [0,12,0,12], table: { headerRows: 1, widths: ['*','auto','auto','auto'], body: [
      ['Layanan','Jumlah','Harga (Rp)','Nilai (Rp)'], ...result.items.filter(i => i.is_active).map(i => [i.description,`${i.qty} ${i.unit_snapshot}`,i.unit_price.toLocaleString('id-ID'),i.amount.toLocaleString('id-ID')]),
    ] } },
    { text: `TOTAL Rp ${result.transaction.total.toLocaleString('id-ID')}`, bold: true, fontSize: 14 },
    ...result.payments.map(p => ({ text: `${p.payment_type} ${p.method}: Rp ${p.amount.toLocaleString('id-ID')} (${p.paid_at} WIB)` })),
    `Refund: Rp ${result.balance.refunded.toLocaleString('id-ID')}`,
    `Pembayaran bersih: Rp ${result.balance.net.toLocaleString('id-ID')}`,
    `Kembalian tunai: Rp ${result.payments.reduce((sum,p) => sum+(p.change_amount ?? 0),0).toLocaleString('id-ID')}`,
  ];
  pdf(res,`nota-${saleId}.pdf`,content);
});
reports.use(['/reports','/dashboard'],role('OWNER'));
reports.get('/reports/:code', async (req, res) => {
  const code = reportCode.parse(req.params['code']); const q = querySchema.parse(req.query); const range = period(q);
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
    data.length ? { fontSize: code === 'visits' ? 7 : 9, layout: 'lightHorizontalLines', table: {
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
    const sales = await one<{ sessions: number; sales: number }>(db,
      'SELECT COUNT(*) AS sessions,COALESCE(SUM(total),0) AS sales FROM transactions WHERE completed_at BETWEEN ? AND ?', [start,end]);
    const cashIn = await one<{ total: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE paid_at BETWEEN ? AND ?', [start,end]);
    const cashOut = await one<{ total: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS total FROM refunds WHERE refunded_at BETWEEN ? AND ?', [start,end]);
    const retained = await one<{ total: number }>(db, `SELECT COALESCE(SUM(p.amount),0) AS total FROM payments p JOIN transactions t ON t.id=p.transaction_id
      WHERE t.cancelled_at IS NOT NULL AND p.paid_at BETWEEN ? AND ?`, [start,end]);
    const cancelledRefund = await one<{ total: number }>(db, `SELECT COALESCE(SUM(r.amount),0) AS total FROM refunds r JOIN transactions t ON t.id=r.transaction_id
      WHERE t.cancelled_at IS NOT NULL AND r.refunded_at BETWEEN ? AND ?`, [start,end]);
    return { ...range, ...sales, cash_in: Number(cashIn.total), refunds: Number(cashOut.total),
      net_cash: Number(cashIn.total)-Number(cashOut.total), cancelled_net_cash: Number(retained.total)-Number(cancelledRefund.total),
      packages: await report(db,'packages',range.from,range.to),
      visits_by_status: await rows(db, 'SELECT status,COUNT(*) AS count FROM visits WHERE service_date BETWEEN ? AND ? GROUP BY status', [range.from,range.to]) };
  }));
});
