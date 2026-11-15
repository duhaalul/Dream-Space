import { formatDateTime } from '@/shared/utils/format'

// visit_events.event_type → teks untuk Admin/Owner.
const EVENT_LABELS = {
  REGISTER: 'Didaftarkan',
  CONFIRM: 'Sudah datang, masuk antrean',
  CALL: 'Dipanggil',
  START: 'Mulai foto',
  SKIP: 'Dilewati',
  RETURN: 'Kembali ke antrean',
  CANCEL: 'Dibatalkan',
  FINISH: 'Selesai',
  MOVE_PACKAGE: 'Pindah paket',
}

const DOT = {
  CANCEL: 'bg-red-500',
  FINISH: 'bg-emerald-500',
  SKIP: 'bg-amber-500',
}

// Riwayat status kunjungan dari detail.events (urut lama → baru).
export default function VisitTimeline({ events }) {
  if (!events?.length) return <p className="text-sm text-slate-500">Belum ada riwayat.</p>
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[event.event_type] ?? 'bg-brand-500'}`} />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-slate-700">
              {EVENT_LABELS[event.event_type] ?? event.event_type}
              {event.queue_code_snapshot && event.queue_number
                ? ` · ${event.queue_code_snapshot}-${String(event.queue_number).padStart(3, '0')}`
                : ''}
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(event.created_at)} WIB</p>
            {event.reason && <p className="mt-0.5 text-xs text-slate-600">Alasan: {event.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
