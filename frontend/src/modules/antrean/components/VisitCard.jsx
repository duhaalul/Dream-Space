import { Badge } from '@/shared/components/ui'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '@/shared/utils/constants'
import SessionTimer from './SessionTimer'

// Warna kotak nomor antrean sesuai desain (03_Antrean).
const TICKET_TONES = {
  serving: 'bg-brand-50 text-brand-600', // Sedang foto
  called: 'bg-linear-to-br from-amber-500 to-red-500 text-white', // Dipanggil
  normal: 'bg-slate-100 text-slate-700', // Urutan #n
  muted: 'bg-slate-100 text-slate-400', // Dilewati
  reservation: 'bg-brand-50 text-brand-600', // Reservasi
}

// Kartu satu pelanggan di papan antrean. Pelanggan sudah lunas saat masuk antrean,
// jadi status bayar hanya ditampilkan bila BELUM lunas (pengecualian yang perlu perhatian).
// ticket: { code, caption, tone }, actions: tombol, stacked: tombol di bawah (grid 2 kolom).
// badge: { tone, label } mengganti badge bayar bawaan (kartu reservasi: "DP" / "Lunas").
export default function VisitCard({ visit, ticket, title, meta, note, badge, actions, stacked = false }) {
  const unpaid = visit.payment_status && !['LUNAS', 'TIDAK_ADA_TAGIHAN'].includes(visit.payment_status)
  const shownBadge =
    badge ?? (unpaid ? { tone: PAYMENT_STATUS_TONES[visit.payment_status] ?? 'gray', label: PAYMENT_STATUS_LABELS[visit.payment_status] ?? visit.payment_status } : null)

  return (
    <article
      className={`flex gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${
        stacked ? 'flex-col' : 'flex-col lg:flex-row lg:items-center'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={`flex w-24 shrink-0 flex-col items-center justify-center rounded-2xl px-2 py-3 text-center ${TICKET_TONES[ticket.tone]}`}
        >
          <span className="text-lg leading-tight font-bold">{ticket.code}</span>
          <span className="mt-0.5 text-[11px] font-semibold">{ticket.caption}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-bold text-slate-800">{title}</p>
            <SessionTimer visit={visit} />
          </div>
          {meta && <p className="mt-0.5 text-sm text-slate-500">{meta}</p>}
          {note && <p className="mt-0.5 text-xs text-slate-400">{note}</p>}
          {shownBadge && (
            <Badge tone={shownBadge.tone} className="mt-2">
              {shownBadge.label}
            </Badge>
          )}
        </div>
      </div>
      {actions && <div className={`flex flex-wrap gap-2 ${stacked ? '' : 'lg:justify-end'}`}>{actions}</div>}
    </article>
  )
}
