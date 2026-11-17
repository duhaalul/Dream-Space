import { Info, UserCheck, XCircle } from 'lucide-react'
import { Alert, Button } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { ticketFor } from '../queue'
import { EmptyNote, Section } from './BoardParts'
import VisitCard from './VisitCard'

// "Reguler · 3 orang" atau "Belum pilih paket".
function reservationMeta(visit, packages) {
  const pkg = packages.find((item) => item.id === visit.package_id)
  if (!pkg) return 'Belum pilih paket'
  return [pkg.name, visit.persons && `${visit.persons} orang`].filter(Boolean).join(' · ')
}

// Bagian Reservasi di bawah papan Antrean: reservasi yang belum datang pada satu tanggal (semua paket), urut jam.
// Admin: Sudah Datang (hanya hari ini), Batalkan, Detail. Owner: Detail saja.
// data = visits[] dari useReservations(date) (null selama memuat).
export default function ReservationSection({ date, onDateChange, data, error, packages, isAdmin, busy, onCheckIn, onCancel, onDetail }) {
  const isToday = date === todayWib()

  let body
  if (error && !data) {
    body = (
      <Alert variant="warning" requestId={error.requestId}>
        Reservasi gagal dimuat ({error.message}).
      </Alert>
    )
  } else if (!data) {
    body = <EmptyNote>Memuat…</EmptyNote>
  } else if (!data.length) {
    body = <EmptyNote>Tidak ada reservasi.</EmptyNote>
  } else {
    body = (
      <div className="grid gap-4 xl:grid-cols-2">
        {data.map((visit) => {
          const paid = visit.payment_status === 'LUNAS'
          return (
            <VisitCard
              key={visit.id}
              visit={visit}
              ticket={ticketFor(visit)}
              title={visit.customer_name}
              meta={reservationMeta(visit, packages)}
              badge={paid ? { tone: 'green', label: 'Lunas' } : { tone: 'amber', label: 'DP' }}
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
          )
        })}
      </div>
    )
  }

  return (
    <Section
      title={data ? `Reservasi (${data.length})` : 'Reservasi'}
      aside={
        <input
          type="date"
          aria-label="Tanggal reservasi"
          value={date}
          onChange={(event) => event.target.value && onDateChange(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none"
        />
      }
    >
      {body}
    </Section>
  )
}
