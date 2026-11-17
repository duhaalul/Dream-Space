import { formatRupiah } from '@/shared/utils/format'

// Satu baris label ··· nilai (rincian tagihan, kembalian, ringkasan pop-up).
export function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'text-base font-bold text-slate-800' : 'text-sm text-slate-600'}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  )
}

// Rincian tagihan + Total. Bila sudah ada uang masuk (DP reservasi): "Sudah dibayar" dan "Sisa".
// bill: { lines, total } | null (paket belum dipilih) — dari billPreview() atau billFromDetail().
// dueLabel: label baris sisa (mis. "Sisa dibayar saat datang"). Kelebihan bayar ditampilkan pemanggil (refund).
export default function BillSummary({ bill, paid = 0, emptyLabel = 'Pilih paket', dueLabel = 'Sisa' }) {
  const total = bill?.total ?? 0
  return (
    <div className="space-y-1.5">
      {bill ? (
        bill.lines.map((line) => <SummaryRow key={line.key} label={line.label} value={formatRupiah(line.amount)} />)
      ) : (
        <SummaryRow label={emptyLabel} value="—" />
      )}
      <div className="space-y-1.5 border-t border-slate-100 pt-2">
        <SummaryRow strong label="Total" value={formatRupiah(total)} />
        {paid > 0 && <SummaryRow label="Sudah dibayar" value={`−${formatRupiah(paid)}`} />}
        {paid > 0 && bill && total >= paid && <SummaryRow strong label={dueLabel} value={formatRupiah(total - paid)} />}
      </div>
    </div>
  )
}
