// Logika Kasir (tanpa komponen). Angka tagihan selalu dari backend (detail.balance),
// frontend hanya menampilkan dan memeriksa isian sebelum dikirim.
import { formatRupiah } from '@/shared/utils/format'

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
