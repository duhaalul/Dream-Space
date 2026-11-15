// Logika Kasir (tanpa komponen). Angka tagihan selalu dari backend (detail.balance),
// frontend hanya menampilkan dan memeriksa isian sebelum dikirim.
import { PAYMENT_METHOD_LABELS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'

// ---- Riwayat & koreksi -------------------------------------------------------

// Kolom JSON audit bisa datang sebagai objek atau teks.
const asObject = (value) => {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) ?? {}
    } catch {
      return {}
    }
  }
  return value
}

export function corrections(auditRows = []) {
  return auditRows.filter((row) => row.action === 'CORRECTION')
}

// Entri audit CORRECTION → daftar kalimat "Nama: Eko → Eka", "Pembayaran Rp150.000: QRIS → Tunai".
export function correctionSummary(entry) {
  const before = asObject(entry.old_values)
  const after = asObject(entry.new_values)
  const lines = []
  if (after.customer_name) lines.push(`Nama: ${before.customer_name ?? '-'} → ${after.customer_name}`)
  for (const payment of after.payments ?? []) {
    const old = (before.payments ?? []).find((item) => item.id === payment.id) ?? {}
    const parts = []
    if (old.method !== payment.method) parts.push(`${PAYMENT_METHOD_LABELS[old.method] ?? old.method ?? '-'} → ${PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}`)
    if ((old.reference ?? null) !== (payment.reference ?? null)) parts.push(`referensi ${old.reference ?? '-'} → ${payment.reference ?? '-'}`)
    if (Number(old.amount) !== Number(payment.amount)) parts.push(`nominal ${formatRupiah(old.amount)} → ${formatRupiah(payment.amount)}`)
    lines.push(`Pembayaran ${formatRupiah(payment.amount)}: ${parts.join(', ') || 'tanpa perubahan'}`)
  }
  for (const item of after.items ?? []) {
    const old = (before.items ?? []).find((row) => row.id === item.id) ?? {}
    lines.push(`Harga rincian: ${formatRupiah(old.unit_price)} → ${formatRupiah(item.unit_price)}`)
  }
  return lines.length ? lines : ['Koreksi data transaksi']
}

// Isi koreksi metode bayar satu pembayaran (nominal & waktu tetap).
// Tunai butuh cash_received ≥ nominal; nontunai cash_received = null (backend: INVALID_CASH).
export function paymentCorrection(payment, method, reference) {
  const cash = method === 'TUNAI'
  return {
    id: payment.id,
    method,
    amount: Number(payment.amount),
    cash_received: cash ? (payment.method === 'TUNAI' ? Number(payment.cash_received) : Number(payment.amount)) : null,
    paid_at: String(payment.paid_at).slice(0, 19),
    reference: cash ? null : reference.trim() || null,
  }
}

// ---- Kasir --------------------------------------------------------------------

export const TERMINAL = ['SELESAI', 'DIBATALKAN']

// Urutan tampil: paket, tambahan orang, lalu tambahan layanan (backend menulis ulang
// baris paket saat konfirmasi akhir, jadi urutan id tidak selalu sesuai).
const ITEM_ORDER = { PAKET: 0, TAMBAH_ORANG: 1, TAMBAHAN: 2 }

export function activeItems(detail) {
  return detail.items
    .filter((item) => Number(item.is_active) === 1)
    .sort((a, b) => (ITEM_ORDER[a.item_type] ?? 9) - (ITEM_ORDER[b.item_type] ?? 9) || a.id - b.id)
}

// "Reguler Studio (2 orang pertama)", "Tambahan 1 orang (+Rp30.000)", "Tambah waktu (2× 5 menit)"
export function itemLabel(item, transaction) {
  if (item.item_type === 'PAKET') {
    if (transaction.price_type_snapshot === 'PER_ORANG') return `${item.description} (${item.qty} orang × ${formatRupiah(item.unit_price)})`
    if (transaction.price_type_snapshot === 'PER_KELOMPOK' && transaction.included_persons_snapshot != null) {
      return `${item.description} (${transaction.included_persons_snapshot} orang pertama)`
    }
    return `${item.description} (per sesi)`
  }
  if (item.item_type === 'TAMBAH_ORANG') return `Tambahan ${item.qty} orang (+${formatRupiah(item.unit_price)})`
  return `${item.description} (${item.qty}× ${item.unit_snapshot})`
}

// DP hanya untuk reservasi yang belum datang; selain itu pembayaran biasa.
export function paymentTypeFor(visit) {
  return visit.status === 'RESERVASI' ? 'DP' : 'PEMBAYARAN'
}

// Reservasi tanpa paket boleh menerima DP walau due = 0 (due = 0 di sini bukan berarti lunas).
export function canReceivePayment(detail) {
  if (TERMINAL.includes(detail.visit.status)) return false
  const unallocated = detail.transaction.price_type_snapshot === null
  return detail.balance.due > 0 || (unallocated && detail.visit.status === 'RESERVASI')
}

// null = boleh diselesaikan; selain itu alasan tombol "Selesaikan & Cetak Nota" nonaktif.
export function finishBlocker(detail) {
  const { visit, transaction, balance } = detail
  if (visit.status !== 'SEDANG_DILAYANI') return 'Sesi bisa diselesaikan setelah foto dimulai (tombol Mulai Foto di Antrean).'
  if (transaction.price_type_snapshot === null) return 'Paket belum dipilih.'
  if (balance.due > 0) return `Lunasi sisa tagihan ${formatRupiah(balance.due)} dulu.`
  if (balance.surplus > 0) return `Kembalikan kelebihan bayar ${formatRupiah(balance.surplus)} dulu.`
  return null
}

const FIELD_BY_CODE = {
  EXCESS_NONCASH: 'amount',
  NO_OUTSTANDING: 'amount',
  INVALID_CASH: 'amount',
  AMOUNT_LIMIT: 'amount',
  FUTURE_PAYMENT: 'amount',
  UNALLOCATED_DP_ONLY: 'amount',
  REFERENCE_REQUIRED: 'reference',
  DUPLICATE_VALUE: 'reference',
  REFUND_EXCEEDS_SURPLUS: 'refund',
  REFUND_NOT_ALLOWED: 'refund',
}

const MESSAGE_BY_CODE = {
  DUPLICATE_VALUE: 'Referensi ini sudah dipakai pembayaran lain.',
}

// ApiError → { field?, message, variant, requestId?, resetRequest, reload }
export function cashierError(error) {
  if (error?.code === 'NETWORK_ERROR') {
    return { variant: 'error', message: 'Koneksi ke server terputus. Tekan lagi; data tidak akan tercatat dua kali.', resetRequest: false, reload: false }
  }
  if (error?.code === 'IDEMPOTENCY_CONFLICT') {
    return {
      variant: 'error',
      message: 'Permintaan sebelumnya ternyata sudah tercatat dengan isian berbeda. Periksa rincian tagihan, lalu ulangi bila memang perlu.',
      resetRequest: true,
      reload: true,
    }
  }
  if (error?.code === 'STALE_VERSION') {
    return { variant: 'warning', message: 'Data transaksi baru saja berubah di komputer lain. Tampilan sudah dimuat ulang; periksa lagi sebelum mengulang.', resetRequest: false, reload: true }
  }
  const field = FIELD_BY_CODE[error?.code]
  if (field) return { field, variant: 'error', message: MESSAGE_BY_CODE[error.code] ?? error.message, resetRequest: false, reload: false }
  return { variant: 'error', message: error?.message ?? 'Gagal menyimpan.', requestId: error?.requestId, resetRequest: false, reload: true }
}
