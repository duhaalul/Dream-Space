import { TodoCard } from '@/shared/components/ui'

// Tutup/buka ruangan paket sementara (UC-06), Admin saja.
// Dipakai di halaman Antrean (modul antrean) pada tab tiap paket.
// Props yang disarankan: { packageId, isOpen, onChanged }
export default function RoomAvailabilityToggle() {
  return (
    <TodoCard
      title="Tutup/buka ruangan"
      items={[
        'Tombol tutup/buka memanggil setPackageAvailability(packageId, isOpen, reason).',
        'Alasan wajib saat menutup (mis. alat rusak).',
        'Tidak bisa ditutup saat ada sesi yang sedang berjalan (backend menolak).',
      ]}
    />
  )
}
