// Modul Dashboard dan Laporan — docs/API.md bagian Dashboard dan laporan Owner.
// params: { period: 'today' | 'week' | 'month' | 'custom', from?, to? }
// from/to (YYYY-MM-DD) hanya untuk period 'custom'.
import { api } from '@/shared/api/client'

export const REPORT_CODES = {
  sales: 'L-01 Penjualan',
  packages: 'L-02 Penjualan per paket',
  cash: 'L-03 Penerimaan uang',
  visits: 'L-04 Rekap kunjungan',
}

export const getDashboard = (params) => api.get('/dashboard', { query: params })

export const getReport = (code, params) => api.get(`/reports/${code}`, { query: { ...params, format: 'json' } })

// format: 'pdf' | 'xlsx'. Simpan hasilnya dengan saveBlob().
export const downloadReport = (code, format, params) => api.download(`/reports/${code}`, { ...params, format })
