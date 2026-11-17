// Modul Paket dan Harga — docs/API.md bagian Katalog.
// Tidak ada endpoint hapus: paket/latar/tambahan dinonaktifkan dengan is_active=false.
import { api } from '@/shared/api/client'

// → { packages, backgrounds, allowed_addons }
export const getPackages = () => api.get('/packages')

export const getAddons = () => api.get('/addons')

// Owner. Kirim body lengkap: { name, queue_code, price_type, price, included_persons, extra_person_price,
//   min_persons, max_persons, duration_minutes, description, is_active }. Dipakai tombol Aktifkan/Nonaktifkan.
// Paket yang masih dipakai tidak bisa dinonaktifkan (409 PACKAGE_IN_USE).
export const updatePackage = (id, data) => api.put(`/packages/${id}`, data)

// Admin. Tutup/buka ruangan paket sementara; reason wajib saat menutup.
export const setPackageAvailability = (id, isOpen, reason) =>
  api.patch(`/packages/${id}/availability`, { is_open: isOpen, reason })

// Owner. data: { name, price, unit, extra_minutes, is_active }
export const createAddon = (data) => api.post('/addons', data)
export const updateAddon = (id, data) => api.put(`/addons/${id}`, data)
// Owner. Hapus tambahan: dilepas dari semua paket; yang sudah pernah dipakai transaksi diarsipkan
// (disembunyikan, riwayat tetap utuh). → { id, archived }
export const deleteAddon = (id) => api.delete(`/addons/${id}`)

// Owner. Pop-up Kelola Paket: info paket + latar + tambahan tersedia disimpan sekaligus
// (satu transaksi: semua tersimpan atau tidak sama sekali). Menggantikan simpan per bagian
// (POST /packages, /packages/:id/backgrounds, PUT /backgrounds/:id, /packages/:id/addons; endpoint-nya tetap ada di backend).
// data: { package: { ...body updatePackage }, backgrounds: [{ id?, name, max_persons, is_active }], addon_ids: [] }
// Latar dengan id = ubah, tanpa id = tambah. → { id, ...package }
export const createPackageSetup = (data) => api.post('/packages/setup', data)
export const updatePackageSetup = (id, data) => api.put(`/packages/${id}/setup`, data)
