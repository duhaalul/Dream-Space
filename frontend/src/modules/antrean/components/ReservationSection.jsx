import { CalendarX, Info, UserCheck, XCircle } from 'lucide-react'
import { Alert, Button } from '@/shared/components/ui'
import { formatRupiah, formatTime, parseBackendDate, todayWib } from '@/shared/utils/format'
import { ticketFor } from '../queue'
import { EmptyNote, Section } from './BoardParts'
import VisitCard from './VisitCard'

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

// "Reguler · 3 orang" atau "Belum pilih paket".
function reservationMeta(visit, packages) {
  const pkg = packages.find((item) => item.id === visit.package_id)
  if (!pkg) return 'Belum pilih paket'
  return [pkg.name, visit.persons && `${visit.persons} orang`].filter(Boolean).join(' · ')
}

// Lunas → "Lunas"; belum lunas → "Sisa Rp…" (yang ditagih saat datang). Data lama tanpa paket (total belum ada) → "DP".
function paymentBadge(visit) {
  if (visit.payment_status === 'LUNAS') return { tone: 'green', label: 'Lunas' }
  const due = Number(visit.total) - Number(visit.paid ?? 0)
  if (visit.package_id === null || due <= 0) return { tone: 'amber', label: 'DP' }
  return { tone: 'amber', label: `Sisa ${formatRupiah(due)}` }
}

// Bagian Reservasi di bawah papan Antrean: reservasi yang belum datang pada satu tanggal (semua paket), urut jam.
// Admin: Sudah Datang (hanya hari ini), Batalkan, Detail. Owner: Detail saja.
// data = visits[] dari useReservations(date) (null selama memuat).
// Tombol "Terlewat (N)" (bila ada reservasi lewat tanggal yang belum datang/dibatalkan): menampilkan semuanya sekaligus,
// kotak jam memuat tanggalnya; tanpa Sudah Datang (pindahkan dulu lewat Detail › Ubah Reservasi, atau Batalkan).
export default function ReservationSection({
  date, onDateChange, data, error, overdue, showOverdue, onToggleOverdue, packages, isAdmin, busy, onCheckIn, onCancel, onDetail,
}) {
  const overdueCount = overdue?.length ?? 0
  const listing = showOverdue && overdueCount > 0
  const visits = listing ? overdue : data
  const isToday = !listing && date === todayWib()

  let body
  if (!listing && error && !data) {
    body = (
      <Alert variant="warning" requestId={error.requestId}>
        Reservasi gagal dimuat ({error.message}).
      </Alert>
    )
  } else if (!visits) {
    body = <EmptyNote>Memuat…</EmptyNote>
  } else if (!visits.length) {
    body = <EmptyNote>Tidak ada reservasi.</EmptyNote>
  } else {
    body = (
      <div className="grid gap-4 xl:grid-cols-2">
        {visits.map((visit) => (
          <VisitCard
            key={visit.id}
            visit={visit}
            ticket={
              listing
                ? { code: formatTime(visit.appointment_at), caption: shortDate.format(parseBackendDate(visit.appointment_at)), tone: 'reservation' }
                : ticketFor(visit)
            }
            title={visit.customer_name}
            meta={reservationMeta(visit, packages)}
            badge={paymentBadge(visit)}
            stacked
            actions={
              <>
                {isAdmin && isToday && (
                  <Button size="sm" variant="success" disabled={busy} onClick={() => onCheckIn(visit)}>
                    <UserCheck aria-hidden="true" className="h-3.5 w-3.5" /> Sudah Datang
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => onCancel(visit)}>
                    <XCircle aria-hidden="true" className="h-3.5 w-3.5" /> Batalkan
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onDetail(visit.id)}>
                  <Info aria-hidden="true" className="h-3.5 w-3.5" /> Detail
                </Button>
              </>
            }
          />
        ))}
      </div>
    )
  }

  let title = data ? `Reservasi (${data.length})` : 'Reservasi'
  if (listing) title = `Reservasi Terlewat (${overdueCount})`

  return (
    <Section
      title={title}
      aside={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {overdueCount > 0 && (
            <Button size="sm" variant={listing ? 'warning' : 'secondary'} aria-pressed={listing} onClick={onToggleOverdue}>
              <CalendarX aria-hidden="true" className={`h-3.5 w-3.5 ${listing ? '' : 'text-amber-600'}`} /> Terlewat ({overdueCount})
            </Button>
          )}
          <input
            type="date"
            aria-label="Tanggal reservasi"
            value={date}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
          />
        </div>
      }
    >
      {body}
    </Section>
  )
}
