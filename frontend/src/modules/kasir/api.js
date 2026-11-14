// Modul Kasir dan Pembayaran — docs/API.md bagian Kasir.
// Pembayaran/refund wajib membawa client_request_id dari newRequestId().
import { api } from '@/shared/api/client'

// Rincian tagihan memakai detail kunjungan:
// → { visit, transaction, balance: { paid, refunded, net, due, surplus }, items, payments, refunds, events }
export const getCashierDetail = (visitId) => api.get(`/visits/${visitId}`)

// Daftar pelanggan aktif di Kasir (belum Selesai/Dibatalkan).
// params: { date, page, search }
export const getActiveVisits = (params) => api.get('/visits', { query: { ...params, history: 'false' } })

// Riwayat transaksi (T-06): hanya kunjungan Selesai dan Dibatalkan.
// params: { page, search, from, to }
export const getHistory = (params) => api.get('/visits', { query: { ...params, history: 'true' } })

// data: { version, addons: [{ addon_id, qty }], reason }
export const setTransactionAddons = (transactionId, data) => api.put(`/transactions/${transactionId}/addons`, data)

// data: { client_request_id, payment_type, method, amount, reference?, paid_at? }
// Tunai: amount = uang yang diserahkan; backend menghitung kembalian.
export const addPayment = (transactionId, data) => api.post(`/transactions/${transactionId}/payments`, data)

// data: { client_request_id, amount, method, reason }
export const addRefund = (transactionId, data) => api.post(`/transactions/${transactionId}/refunds`, data)

// data: { version, reason, customer_name?, payments?, items?, payment?, refund? }
export const addCorrection = (transactionId, data) => api.post(`/transactions/${transactionId}/corrections`, data)

export const getAudit = (transactionId) => api.get(`/transactions/${transactionId}/audit`)

// Konfirmasi akhir sesi + pelunasan (atomik).
// data: { version, transaction_version, persons, addons, reason?, payment?, refund? }
export const finishVisit = (visitId, data) => api.post(`/visits/${visitId}/finish`, data)

// Nota PDF, hanya setelah Selesai. Pakai openBlob() untuk mencetak.
export const downloadReceipt = (transactionId) => api.download(`/transactions/${transactionId}/receipt.pdf`)
