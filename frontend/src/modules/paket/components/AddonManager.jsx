import { TodoCard } from '@/shared/components/ui'

// Kelola tambahan layanan (UC-05), Owner saja.
// Dipakai di halaman Kelola Paket.
export default function AddonManager() {
  return (
    <TodoCard
      title="Tambahan layanan"
      items={[
        'Daftar tambahan dari getAddons(): nama, harga, satuan, aktif/nonaktif.',
        'Tambah dengan createAddon(), ubah dengan updateAddon(). Tidak ada hapus.',
        'Contoh: Tambah waktu Rp20.000 per 5 menit.',
      ]}
    />
  )
}
