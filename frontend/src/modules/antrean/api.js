// Modul Antrean Layanan — docs/API.md bagian Kunjungan, antrean, dan riwayat.
// Detail & hasil mutasi: { visit, transaction, balance, items, payments, refunds, events }.
// Simpan visit.version terbaru untuk request berikutnya.
// Reservasi (daftar, Sudah Datang, Ubah Reservasi) ada di kasir/api.js.
import { api } from '@/shared/api/client'

// params: { date, history, page, search, from, to }
export const getVisits = (params) => api.get('/visits', { query: params })

export const getVisit = (id) => api.get(`/visits/${id}`)

// Kondisi tiap ruangan paket dan pelanggan yang dipanggil/sedang foto.
export const getQueueRooms = () => api.get('/queue/rooms')

// Admin. data: { version, package_id, background_id, persons, reason } (belum dipakai tampilan; nanti untuk koreksi)
export const updateVisitSelection = (id, data) => api.put(`/visits/${id}/selection`, data)

// Admin. data: { version, action, reason? }
// action: CALL | UNCALL (Kembali ke Antrean) | START | RETURN (data lama Dilewati) | CANCEL | FINISH (lihat VISIT_ACTIONS)
export const runVisitAction = (id, data) => api.post(`/visits/${id}/actions`, data)
