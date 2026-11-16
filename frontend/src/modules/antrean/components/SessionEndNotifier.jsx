import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, BellRing, X } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { getQueueRooms } from '../api'
import { formatQueueNumber, sessionTimer } from '../queue'
import { useNow } from '../useNow'
import { QUEUE_CHANGED_EVENT } from '../useVisitActions'

const REFRESH_MS = 15_000
const STORAGE_KEY = 'dreamspace:dismissed-session-alerts'

function loadDismissed() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

// Notifikasi kecil di kanan bawah saat waktu sesi foto habis. Admin, tampil di semua halaman.
// Hilang bila ditutup (X) atau sesinya diselesaikan.
export default function SessionEndNotifier() {
  const navigate = useNavigate()
  const now = useNow(1000)
  const [rooms, setRooms] = useState([])
  const [dismissed, setDismissed] = useState(loadDismissed)

  const load = useCallback(() => {
    getQueueRooms()
      .then((rows) => setRooms(Array.isArray(rows) ? rows : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (!document.hidden) load()
    }, REFRESH_MS)
    window.addEventListener(QUEUE_CHANGED_EVENT, load)
    return () => {
      clearInterval(timer)
      window.removeEventListener(QUEUE_CHANGED_EVENT, load)
    }
  }, [load])

  function dismiss(visitId) {
    const next = new Set(dismissed).add(visitId)
    setDismissed(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      // Penyimpanan browser tidak tersedia: cukup disembunyikan selama halaman terbuka.
    }
  }

  const due = rooms
    .filter((room) => room.active_visit_id && !dismissed.has(room.active_visit_id))
    .map((room) => ({ room, timer: sessionTimer(room, now) }))
    .filter(({ timer }) => timer?.overtime)
  if (!due.length) return null

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {due.map(({ room, timer }) => (
        <div key={room.active_visit_id} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-red-200 bg-white p-3 shadow-lg shadow-slate-900/10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <BellRing aria-hidden="true" className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">
              {formatQueueNumber(room.queue_code_snapshot, room.queue_number)} · {room.customer_name}
            </p>
            <p className="text-xs font-semibold text-red-600 tabular-nums">Waktu habis · lewat {timer.label}</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => navigate(`/antrean?paket=${encodeURIComponent(room.queue_code_snapshot ?? '')}`)}>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /> Lihat
          </Button>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => dismiss(room.active_visit_id)}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
