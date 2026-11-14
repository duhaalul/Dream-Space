export function validatePeriodRange(period, from, to) {
  if (period !== 'custom') return null
  if (!from || !to) {
    return {
      code: 'DATE_RANGE_REQUIRED',
      message: 'Rentang tanggal belum lengkap. Pilih tanggal mulai dan tanggal akhir.',
    }
  }
  const startMs = new Date(`${from}T00:00:00Z`).getTime()
  const endMs = new Date(`${to}T00:00:00Z`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || from > to || endMs - startMs > 366 * 86_400_000) {
    return {
      code: 'INVALID_RANGE',
      message: 'Rentang tanggal harus berurutan dan maksimal 367 hari.',
    }
  }
  return null
}

export function buildPeriodQuery(period, from, to) {
  if (period === 'custom') {
    return { period: 'custom', from, to }
  }
  return { period }
}
