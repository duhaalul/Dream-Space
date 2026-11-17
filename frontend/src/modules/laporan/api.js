// Modul Dashboard dan Laporan — docs/API.md bagian Dashboard dan laporan Owner.
// params: { period: 'today' | 'week' | 'month' | 'custom', from?, to? }
// from/to (YYYY-MM-DD) hanya untuk period 'custom'.
import { api } from '@/shared/api/client'

// L-03 Penerimaan Uang dihapus (17 Nov 2026): cukup penjualan dan penjualan per paket.
export const REPORT_CODES = {
  sales: 'L-01 Penjualan',
  packages: 'L-02 Penjualan per Paket',
}

// → { from, to, sessions, sales, methods: [{ method, amount }], packages, visits_by_status }
export const getDashboard = (params) => api.get('/dashboard', { query: params })

export const getReport = (code, params) => api.get(`/reports/${code}`, { query: { ...params, format: 'json' } })

// format: 'pdf' | 'xlsx'. Simpan hasilnya dengan saveBlob().
export const downloadReport = (code, format, params) => api.download(`/reports/${code}`, { ...params, format })
