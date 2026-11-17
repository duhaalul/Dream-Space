// Logika Pendaftaran, Reservasi & Riwayat (tanpa komponen). Total resmi selalu dari backend;
// perhitungan di sini hanya untuk tampilan sebelum dikirim.
import { queueLabel } from '@/modules/antrean/queue'
import { estimateTotal } from '@/modules/antrean/visitForm'
import { formatRupiah } from '@/shared/utils/format'

export const PAYMENT_METHODS = [
  { value: 'TUNAI', label: 'Tunai' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'QRIS', label: 'QRIS' },
]

// Saat reservasi (dari WhatsApp) pembayaran hanya lewat Transfer/QRIS.
export const RESERVATION_METHODS = PAYMENT_METHODS.filter((method) => method.value !== 'TUNAI')

export const EMPTY_PAYMENT = { method: 'TUNAI', amount: '', reference: '' }

// Tambahan yang boleh dipilih untuk paket ini (diizinkan paket & masih aktif).
export function addonOptionsFor(catalog, pkg) {
  if (!pkg) return []
  const allowed = new Set(catalog.allowedAddons.filter((row) => row.package_id === pkg.id).map((row) => row.addon_id))
  return catalog.addons.filter((addon) => allowed.has(addon.id) && Number(addon.is_active) === 1)
}

// value: { [addonId]: qty } → [{ addon, qty }] (qty > 0)
export function chosenAddons(options, value) {
  return options.filter((addon) => (value[addon.id] ?? 0) > 0).map((addon) => ({ addon, qty: value[addon.id] }))
}

// Durasi sesi = durasi paket + tambah waktu (sama dengan hitungan backend saat Mulai Foto). null = tanpa timer.
export function sessionMinutes(pkg, chosen) {
  if (!pkg?.duration_minutes) return null
  return Number(pkg.duration_minutes) + chosen.reduce((sum, { addon, qty }) => sum + (Number(addon.extra_minutes) || 0) * qty, 0)
}

// Lama pemakaian ruangan untuk cek bentrok reservasi: durasi paket (kosong → 15 menit) + tambah waktu.
// Sama dengan backend (operations.ts plannedMinutes). null bila paket belum dipilih.
export function bookingMinutes(pkg, chosen) {
  if (!pkg) return null
  return (Number(pkg.duration_minutes) || 15) + chosen.reduce((sum, { addon, qty }) => sum + (Number(addon.extra_minutes) || 0) * qty, 0)
}

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

// Perkiraan total setelah Ubah Reservasi, mengikuti aturan backend: paket tidak diganti → harga paket & tambahan
// yang sudah dipesan tetap harga saat reservasi; paket diganti / tambahan baru → harga katalog sekarang.
export function editBillPreview(detail, pkg, persons, chosen) {
  if (!pkg) return null
  const { visit, transaction } = detail
  const same = String(visit.package_id) === String(pkg.id) && transaction.price_type_snapshot
  const pricedPkg = same
    ? {
        ...pkg,
        price_type: transaction.price_type_snapshot,
        price: transaction.price_snapshot,
        included_persons: transaction.included_persons_snapshot,
        extra_person_price: transaction.extra_person_price_snapshot,
      }
    : pkg
  const booked = same ? activeItems(detail).filter((item) => item.item_type === 'TAMBAHAN') : []
  const priced = chosen.map(({ addon, qty }) => {
    const old = booked.find((item) => item.addon_id === addon.id)
    return { addon: old ? { ...addon, price: old.unit_price } : addon, qty }
  })
  return billPreview(pricedPkg, persons, priced)
}

// Rincian tersimpan (detail kunjungan) dalam bentuk yang sama dengan billPreview. null bila paket belum dipilih.
export function billFromDetail(detail) {
  if (detail.visit.package_id === null) return null
  const lines = activeItems(detail).map((item) => ({ key: item.id, label: itemLabel(item), amount: Number(item.amount) }))
  return { lines, total: Number(detail.transaction.total) }
}

// Uang yang dibayar sekarang untuk melunasi `due`. Tunai = uang diterima; Transfer/QRIS = pas sebesar `due`.
export function paymentAmount(payment, due) {
  return payment.method === 'TUNAI' ? Number(payment.amount) : due
}

// Pesan salah untuk uang tunai (dicek langsung saat diketik). → string | null
export function cashError(payment, due, { required = false } = {}) {
  if (payment.method !== 'TUNAI' || due <= 0) return null
  if (payment.amount === '') return required ? `Uang diterima minimal ${formatRupiah(due)}.` : null
  const amount = Number(payment.amount)
  if (!Number.isInteger(amount) || amount < 0) return 'Isi angka bulat.'
  if (amount < due) return `Kurang ${formatRupiah(due - amount)}.`
  return null
}

// Body payment untuk backend (Di Tempat & Sudah Datang).
export function paymentPayload(payment, due, clientRequestId) {
  return {
    client_request_id: clientRequestId,
    method: payment.method,
    amount: paymentAmount(payment, due),
    reference: payment.method === 'TRANSFER' ? payment.reference.trim() || null : null,
  }
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

// Harga semua layanan (rincian aktif). Untuk kunjungan batal, transaction.total sudah diganti uang yang ditahan,
// jadi total layanan diambil dari rincian.
export function itemsTotal(detail) {
  return activeItems(detail).reduce((sum, item) => sum + Number(item.amount), 0)
}

// Lunas penuh = pernah lunas (paid_off_at) DAN uang bersih menutup semua layanan.
// Sama dengan syarat nota di backend (reports.ts). paid_off_at saja tidak cukup: reservasi lunas yang naik paket
// jadi belum lunas lagi, dan saat batal total ditimpa uang yang ditahan.
export function fullyPaid(detail) {
  return Boolean(detail.transaction.paid_off_at) && Number(detail.balance.net) >= itemsTotal(detail)
}

// Kembalian tunai tersimpan (jumlah dari semua pembayaran).
export function totalChange(detail) {
  return detail.payments.reduce((sum, payment) => sum + Number(payment.change_amount ?? 0), 0)
}

export const methodLabel = (method) => PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method

// "QRIS, Tunai" — metode semua pembayaran tersimpan, tanpa dobel.
export function paidMethods(detail) {
  return [...new Set(detail.payments.map((payment) => methodLabel(payment.method)))].join(', ')
}

// Isi pop-up Berhasil (RegistrationSuccess) dari detail hasil backend.
export function successInfo(detail) {
  return {
    queue: queueLabel(detail.visit),
    name: detail.visit.customer_name,
    total: detail.transaction.total,
    methods: paidMethods(detail),
    cash: detail.payments.some((payment) => payment.method === 'TUNAI'),
    change: totalChange(detail),
    transactionId: detail.transaction.id,
  }
}

export const rupiah = formatRupiah
