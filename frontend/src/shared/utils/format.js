const thousands = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

// 150000 → "Rp150.000", -50000 → "-Rp50.000" (format sesuai desain)
export function formatRupiah(amount) {
  const value = Number(amount ?? 0)
  return `${value < 0 ? '-' : ''}Rp${thousands.format(Math.abs(value))}`
}

// Backend mengirim waktu WIB "YYYY-MM-DD HH:mm:ss" (kadang dengan ".000").
function parseBackendDate(value) {
  if (!value) return null
  const [datePart, timePart = '00:00:00'] = String(value).split(' ')
  return new Date(`${datePart}T${timePart.slice(0, 8)}+07:00`)
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

// "2026-11-14" → "14 November 2026"
export function formatDate(value) {
  const date = parseBackendDate(value)
  return date ? dateFormatter.format(date) : '-'
}

// "2026-11-14 14:05:00" → "14.05"
export function formatTime(value) {
  const date = parseBackendDate(value)
  return date ? timeFormatter.format(date) : '-'
}

// "2026-11-14 14:05:00" → "14 November 2026, 14.05"
export function formatDateTime(value) {
  const date = parseBackendDate(value)
  return date ? `${dateFormatter.format(date)}, ${timeFormatter.format(date)}` : '-'
}

// Tanggal hari ini di WIB dalam format backend "YYYY-MM-DD".
export function todayWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}
