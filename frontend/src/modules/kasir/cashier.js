// Logika Pendaftaran & Riwayat (tanpa komponen). Total resmi selalu dari backend;
// perhitungan di sini hanya untuk tampilan sebelum dikirim.
import { estimateTotal } from '@/modules/antrean/visitForm'
import { formatRupiah } from '@/shared/utils/format'

export const PAYMENT_METHODS = [
  { value: 'TUNAI', label: 'Tunai' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'QRIS', label: 'QRIS' },
]

// Rincian tagihan sebelum disimpan: paket, tambahan orang, tambahan layanan.
// addons: [{ addon, qty }] (qty > 0). → { lines: [{ key, label, amount }], total } | null
export function billPreview(pkg, persons, addons) {
  const estimate = estimateTotal(pkg, persons)
  if (!estimate) return null
  const lines = [{ key: 'paket', label: estimate.baseQty > 1 ? `${pkg.name} ×${estimate.baseQty}` : pkg.name, amount: estimate.baseQty * estimate.price }]
  if (estimate.extraQty > 0) lines.push({ key: 'orang', label: `Tambah orang ×${estimate.extraQty}`, amount: estimate.extraQty * estimate.extraPrice })
  for (const { addon, qty } of addons) lines.push({ key: `addon-${addon.id}`, label: `${addon.name} ×${qty}`, amount: Number(addon.price) * qty })
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) }
}

// Urutan tampil rincian tersimpan: paket, tambahan orang, lalu tambahan layanan.
const ITEM_ORDER = { PAKET: 0, TAMBAH_ORANG: 1, TAMBAHAN: 2 }

export function activeItems(detail) {
  return detail.items
    .filter((item) => Number(item.is_active) === 1)
    .sort((a, b) => (ITEM_ORDER[a.item_type] ?? 9) - (ITEM_ORDER[b.item_type] ?? 9) || a.id - b.id)
}

// Label rincian tersimpan, ringkas: "Reguler Studio", "Tambah orang ×1", "Tambah waktu ×2".
export function itemLabel(item) {
  if (item.item_type === 'PAKET') return item.qty > 1 ? `${item.description} ×${item.qty}` : item.description
  if (item.item_type === 'TAMBAH_ORANG') return `Tambah orang ×${item.qty}`
  return `${item.description} ×${item.qty}`
}

// Kembalian tunai tersimpan (jumlah dari semua pembayaran).
export function totalChange(detail) {
  return detail.payments.reduce((sum, payment) => sum + Number(payment.change_amount ?? 0), 0)
}

export const methodLabel = (method) => PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method
export const rupiah = formatRupiah
