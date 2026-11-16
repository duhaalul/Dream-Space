// Modul Pendaftaran & Riwayat (menu "Pendaftaran" = daftar + bayar lunas di awal) — docs/API.md.
// Pembayaran wajib membawa client_request_id dari newRequestId().
import { api } from '@/shared/api/client'

// Pelanggan datang langsung: daftar + tambahan + bayar LUNAS dalam satu permintaan.
// data: { client_request_id, customer_name, package_id, background_id, persons,
//         addons: [{ addon_id, qty }], payment: { client_request_id, method, amount, reference } }
// Tunai: amount = uang yang diserahkan (kembalian dihitung backend). Kurang bayar → PAYMENT_NOT_SETTLED.
// → { visit, transaction, balance, items, payments, refunds, events }
export const registerWalkIn = (data) => api.post('/visits/walk-in', data)

// Detail satu kunjungan/transaksi (Riwayat).
export const getTransactionDetail = (visitId) => api.get(`/visits/${visitId}`)

// Riwayat (T-06): sesi Selesai dan Dibatalkan. params: { page, search, from, to }
export const getHistory = (params) => api.get('/visits', { query: { ...params, history: 'true' } })

// Nota PDF, tersedia sejak transaksi lunas. Pakai openBlob() untuk mencetak.
export const downloadReceipt = (transactionId) => api.download(`/transactions/${transactionId}/receipt.pdf`)

// Pembayaran terpisah (belum dipakai tampilan; disiapkan untuk pelunasan reservasi nanti).
// data: { client_request_id, payment_type, method, amount, reference? }
export const addPayment = (transactionId, data) => api.post(`/transactions/${transactionId}/payments`, data)
