// Modul Antrean Layanan — docs/API.md bagian Kunjungan, antrean, dan riwayat.
// Detail & hasil mutasi: { visit, transaction, balance, items, payments, refunds, events }.
// Simpan visit.version terbaru untuk request berikutnya.
import { api } from '@/shared/api/client'

// params: { date, history, page, search, from, to }
export const getVisits = (params) => api.get('/visits', { query: params })

export const getVisit = (id) => api.get(`/visits/${id}`)

// Kondisi tiap ruangan paket dan pelanggan yang dipanggil/sedang foto.
export const getQueueRooms = () => api.get('/queue/rooms')

// Admin. Reservasi WhatsApp atau datang langsung, boleh sekaligus DP/pembayaran.
// data wajib berisi client_request_id dari newRequestId() (sekali per tindakan).
export const createVisit = (data) => api.post('/visits', data)

// Admin. data: { version, package_id, background_id, persons, reason }
export const updateVisitSelection = (id, data) => api.put(`/visits/${id}/selection`, data)

// Admin. data: { version, action, reason?, priority? }
// action: CONFIRM | CALL | START | SKIP | RETURN | CANCEL (lihat VISIT_ACTIONS)
export const runVisitAction = (id, data) => api.post(`/visits/${id}/actions`, data)
