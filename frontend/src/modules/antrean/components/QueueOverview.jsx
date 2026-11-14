import { TodoCard } from '@/shared/components/ui'

// Tab "Ringkasan" di halaman Antrean.
// Admin: mencatat tindakan. Owner: hanya melihat (pakai useAuth untuk cek peran).
export default function QueueOverview() {
  return (
    <TodoCard
      title="Ringkasan antrean hari ini"
      items={[
        'Reservasi hari ini yang belum datang: getVisits({ date: todayWib() }), status RESERVASI.',
        'Tombol "Sudah datang" → runVisitAction({ action: CONFIRM, priority: true }); antrean biasa: priority false + alasan.',
        'Ringkasan tiap paket: yang sedang foto dan jumlah yang menunggu (getQueueRooms()).',
        'Ruangan ditutup sementara + tombol buka/tutup: RoomAvailabilityToggle dari @/modules/paket/components (Admin).',
        'Ubah/batalkan kunjungan: buka VisitDetailModal.',
      ]}
    />
  )
}
