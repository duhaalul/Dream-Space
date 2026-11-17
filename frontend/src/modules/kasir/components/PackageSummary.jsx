import { Hash, Timer, UsersRound } from 'lucide-react'
import { packageQueue } from '@/modules/antrean/queue'
import { capacityInfo } from '@/modules/antrean/visitForm'
import { Badge } from '@/shared/components/ui'

const ROOM = {
  free: { tone: 'green', label: 'Kosong' },
  called: { tone: 'amber', label: 'Dipanggil' },
  busy: { tone: 'blue', label: 'Sedang foto' },
  closed: { tone: 'red', label: 'Ditutup' },
}

// Info kecil berbentuk pil (bukan kolom isian). Dipakai juga di pop-up Sudah Datang.
export function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold whitespace-nowrap text-slate-700">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-brand-500" />
      {children}
    </span>
  )
}

// Satu baris info setelah paket dipilih: kapasitas · durasi · urutan · kondisi ruangan.
// minutes = durasi paket + tambah waktu (null bila paket tanpa durasi).
// data = hasil useDayVisits(hari ini); tanpa data (reservasi) → hanya kapasitas & durasi.
export default function PackageSummary({ pkg, background, minutes, data }) {
  if (!pkg) return null
  const capacity = capacityInfo(pkg, background)
  const queue = data ? packageQueue(data, pkg) : null
  const room = queue ? ROOM[queue.roomState] : null
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Info paket">
      <Chip icon={UsersRound}>{capacity.limitText}</Chip>
      {minutes ? <Chip icon={Timer}>{minutes} menit</Chip> : null}
      {queue && <Chip icon={Hash}>Urutan ke-{queue.waiting.length + 1}</Chip>}
      {room && (
        <Badge tone={room.tone} className="px-3 py-1">
          {room.label}
        </Badge>
      )}
    </div>
  )
}
