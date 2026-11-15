import RoomAvailabilityToggle from '@/modules/paket/components/RoomAvailabilityToggle'
import { formatTime } from '@/shared/utils/format'
import { queueLabel } from '../queue'

// Banner biru paket terpilih: kondisi ruangan + tombol Tutup/Buka Ruangan (Admin).
// Owner melihat label status saja. Tidak ada perkiraan waktu tunggu (aturan modul).
export default function RoomBanner({ room, isAdmin, onChanged }) {
  const { pkg, isOpen, inRoom } = room
  let title = 'Ruangan Kosong'
  let subtitle = room.waiting.length ? `${room.waiting.length} pelanggan menunggu` : 'Belum ada pelanggan menunggu'
  if (!isOpen) {
    title = 'Ruangan Ditutup Sementara'
    subtitle = pkg.closed_reason ? `Alasan: ${pkg.closed_reason}` : 'Pelanggan tidak bisa dipanggil sampai ruangan dibuka.'
  } else if (inRoom?.status === 'SEDANG_DILAYANI') {
    title = 'Ruangan Sedang Dipakai'
    subtitle = `${inRoom.customer_name} (${queueLabel(inRoom)}) · Mulai pukul ${formatTime(inRoom.started_at)}`
  } else if (inRoom) {
    title = 'Menunggu Pelanggan Dipanggil'
    subtitle = `${inRoom.customer_name} (${queueLabel(inRoom)}) dipanggil pukul ${formatTime(inRoom.called_at)}`
  }

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl px-5 py-4 text-white shadow-md sm:flex-row sm:items-center ${
        isOpen ? 'bg-linear-to-r from-brand-500 to-brand-600 shadow-brand-500/20' : 'bg-linear-to-r from-slate-500 to-slate-600'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="text-3xl font-black">{pkg.queue_code}</span>
        <div className="min-w-0">
          <p className="font-bold">
            {pkg.name} · {title}
          </p>
          <p className="text-sm text-white/80">{subtitle}</p>
        </div>
      </div>
      {isAdmin ? (
        <RoomAvailabilityToggle packageId={pkg.id} packageName={pkg.name} isOpen={isOpen} onChanged={onChanged} />
      ) : (
        <span className="self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-600 sm:self-auto">
          Status: {isOpen ? 'Aktif' : 'Ditutup'}
        </span>
      )}
    </div>
  )
}
