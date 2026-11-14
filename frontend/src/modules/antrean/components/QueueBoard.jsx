import { TodoCard } from '@/shared/components/ui'

// Tab "Per Paket" di halaman Antrean: papan antrean tiap paket.
// Admin: tombol tindakan. Owner: hanya melihat (pakai useAuth untuk cek peran).
export default function QueueBoard() {
  return (
    <TodoCard
      title="Papan antrean per paket"
      items={[
        'Tab per paket (kode antrean: RG, WD, ...) dengan status ruangan dari getQueueRooms().',
        'Bagian: sedang di ruangan, urutan menunggu, pelanggan dilewati, reservasi hari ini yang belum datang.',
        'Tombol mengikuti status (runVisitAction): Menunggu → Panggil; Dipanggil → Mulai foto atau Lewati; Sedang dilayani → Selesaikan sesi (buka /kasir/:id); Dilewati → Kembalikan.',
        'Alasan wajib untuk Lewati, Kembalikan, Batalkan, dan panggil di luar urutan.',
        'Mulai foto ditolak bila tagihan belum lunas (PAYMENT_REQUIRED_BEFORE_START) → arahkan ke /kasir/:id.',
        'Kirim visit.version terbaru; bila STALE_VERSION muat ulang data.',
      ]}
    />
  )
}
