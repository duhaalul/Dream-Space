// Modul Pendaftaran & Riwayat (menu "Pendaftaran": tab Di Tempat dan Reservasi) — docs/API.md.
// Pembayaran wajib membawa client_request_id dari newRequestId().
import { api } from '@/shared/api/client'

// Tab Di Tempat: daftar + tambahan + bayar LUNAS dalam satu permintaan.
// data: { client_request_id, customer_name, package_id, background_id, persons,
//         addons: [{ addon_id, qty }], payment: { client_request_id, method, amount, reference } }
// Tunai: amount = uang yang diserahkan (kembalian dihitung backend). Kurang bayar → PAYMENT_NOT_SETTLED.
// → { visit, transaction, balance, items, payments, refunds, events }
export const registerWalkIn = (data) => api.post('/visits/walk-in', data)

// Tab Reservasi: jadwal + paket (opsional) + tambahan + bayar DP atau LUNAS lewat Transfer/QRIS.
// data: { client_request_id, customer_name, phone, appointment_at: 'YYYY-MM-DD HH:mm:00',
//         package_id, background_id, persons, addons,
//         payment: { client_request_id, type: 'DP' | 'LUNAS', method: 'TRANSFER' | 'QRIS', amount, reference } }
// DP harus < total bila paket dipilih (DP_TOO_LARGE); LUNAS wajib paket dan pas lunas.
export const registerReservation = (data) => api.post('/visits/reservation', data)

// "Sudah Datang" (Antrean › Reservasi): lengkapi paket bila belum, lunasi sisa, lalu masuk Menunggu
// dengan nomor RG-R001 dan urutan sesuai jam reservasi. Hanya pada tanggal reservasi.
// data: { version, package_id?, background_id?, persons?, addons?, payment?: { client_request_id, method, amount, reference } }
// Paket yang sudah dipilih saat reservasi terkunci (PACKAGE_LOCKED).
export const checkInReservation = (visitId, data) => api.post(`/visits/${visitId}/check-in`, data)

// Jam reservasi yang masih bisa dipilih (belum lewat & tidak bentrok di paket yang sama) → { slots: ['13:15', …] }.
// Reservasi baru: { date, package_id, minutes } (minutes = durasi paket + tambah waktu yang dipilih).
// Ubah Reservasi: { date, visit_id, package_id, minutes } (reservasi itu sendiri tidak dihitung bentrok).
export const getReservationSlots = (params) => api.get('/reservations/availability', { query: params })

// Ubah Reservasi sebelum datang: nama, No. WA, jadwal, paket, latar, orang, tambahan (satu simpan).
// data: { version, customer_name, phone, appointment_at, package_id, background_id, persons, addons,
//         refund?: { client_request_id, method: 'TUNAI' | 'TRANSFER' } }
// Uang lebih dari total baru → refund WAJIB (REFUND_REQUIRED); kurang → dibayar saat datang.
export const updateReservation = (visitId, data) => api.put(`/visits/${visitId}/reservation`, data)

// Detail satu kunjungan/transaksi (Riwayat).
export const getTransactionDetail = (visitId) => api.get(`/visits/${visitId}`)

// Riwayat (T-06): sesi Selesai dan Dibatalkan. params: { page, search, from, to }
export const getHistory = (params) => api.get('/visits', { query: { ...params, history: 'true' } })

// Nota PDF, tersedia sejak transaksi lunas. Pakai openBlob() untuk mencetak.
export const downloadReceipt = (transactionId) => api.download(`/transactions/${transactionId}/receipt.pdf`)

// Pembayaran terpisah (belum dipakai tampilan).
// data: { client_request_id, payment_type, method, amount, reference? }
export const addPayment = (transactionId, data) => api.post(`/transactions/${transactionId}/payments`, data)
