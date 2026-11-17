import { Timer } from 'lucide-react'
import { sessionTimer } from '../queue'
import { useNow } from '../useNow'

// Pil sisa waktu sesi foto: "12:30", merah "Lewat 2:10" bila waktu habis. Kosong bila tanpa durasi.
export default function SessionTimer({ visit, className = '' }) {
  const now = useNow(1000)
  const timer = sessionTimer(visit, now)
  if (!timer) return null
  return (
    <span
      role="timer"
      aria-label={timer.overtime ? `Waktu lewat ${timer.label}` : `Sisa waktu ${timer.label}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap tabular-nums ${
        timer.overtime ? 'bg-red-100 text-red-700' : 'bg-brand-50 text-brand-600'
      } ${className}`}
    >
      <Timer aria-hidden="true" className="h-3.5 w-3.5" />
      {timer.overtime ? `Lewat ${timer.label}` : timer.label}
    </span>
  )
}
