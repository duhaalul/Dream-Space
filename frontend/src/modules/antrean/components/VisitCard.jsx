import { Badge } from '@/shared/components/ui'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'

// Warna kotak nomor antrean sesuai desain (03_Antrean, 02_State Antrean Admin).
const TICKET_TONES = {
  serving: 'bg-brand-50 text-brand-600', // Sedang Foto
  called: 'bg-linear-to-br from-amber-500 to-red-500 text-white', // Dipanggil
  priority: 'bg-amber-100 text-amber-800', // Prioritas (reservasi)
  normal: 'bg-slate-100 text-slate-700', // Urutan #n
  muted: 'bg-slate-100 text-slate-400', // Dilewati
  reservation: 'bg-brand-50 text-brand-600', // Reservasi belum datang
}

// Kartu satu pelanggan di papan antrean.
// ticket: { code, caption, tone }, actions: tombol (null untuk Owner),
// stacked: tombol di bawah (kartu sempit di grid 2 kolom).
export default function VisitCard({ visit, ticket, title, meta, note, actions, stacked = false }) {
  const hasBill = visit.payment_status && Number(visit.total) > 0

  return (
    <article
      className={`flex gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${
        stacked ? 'flex-col' : 'flex-col lg:flex-row lg:items-center'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div
          className={`flex w-24 shrink-0 flex-col items-center justify-center rounded-2xl px-2 py-3 text-center ${TICKET_TONES[ticket.tone]}`}
        >
          <span className="text-lg leading-tight font-bold">{ticket.code}</span>
          <span className="mt-0.5 text-[11px] font-semibold">{ticket.caption}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800">{title}</p>
          {meta && <p className="mt-0.5 text-sm text-slate-500">{meta}</p>}
          {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {visit.payment_status && (
              <Badge tone={PAYMENT_STATUS_TONES[visit.payment_status] ?? 'gray'}>
                {PAYMENT_STATUS_LABELS[visit.payment_status] ?? visit.payment_status}
              </Badge>
            )}
            {hasBill && <span className="text-sm text-slate-500">Total {formatRupiah(visit.total)}</span>}
          </div>
        </div>
      </div>
      {actions && <div className={`flex flex-wrap gap-2 ${stacked ? '' : 'lg:justify-end'}`}>{actions}</div>}
    </article>
  )
}
