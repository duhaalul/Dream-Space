// Logika bersama form Pendaftaran (datang langsung & reservasi).
// Aturan di sini meniru backend supaya kesalahan terlihat sebelum dikirim;
// keputusan akhir tetap di backend (backend/src/catalog.ts validateSelection,
// backend/src/core.ts priceLines, backend/src/operations.ts POST /visits).
import { newRequestId } from '@/shared/utils/requestId'

export const EMPTY_SELECTION = { package_id: '', background_id: '', persons: '' }

// Pilihan jam reservasi (13.15–20.45 per 15 menit, belum lewat, tidak bentrok) dihitung backend:
// GET /reservations/availability → kasir/useReservationSlots.js.

// Satu set request ID per pengisian form (kunjungan + DP). Dipakai ulang saat
// simpan ulang setelah gagal, diganti setelah sukses (NFR-02).
export function newRequestIds() {
  return { visit: newRequestId(), payment: newRequestId() }
}

const toNumber = (value) => (value === null || value === undefined ? null : Number(value))

export function activePackages(packages = []) {
  return packages.filter((pkg) => Number(pkg.is_active) === 1)
}

export function activeBackgrounds(backgrounds = [], packageId) {
  return backgrounds.filter(
    (background) => String(background.package_id) === String(packageId) && Number(background.is_active) === 1,
  )
}

export function packageLabel(pkg) {
  const closed = Number(pkg.is_open) === 1 ? '' : ' · ditutup'
  return `${pkg.name} (${pkg.queue_code})${closed}`
}

export function backgroundLabel(background) {
  return background.max_persons == null ? background.name : `${background.name} (Maks ${background.max_persons} org)`
}

// Batas jumlah orang gabungan paket + latar. max null = tanpa batas.
export function personLimits(pkg, background) {
  const min = toNumber(pkg?.min_persons) ?? 1
  const maxes = [toNumber(pkg?.max_persons), toNumber(background?.max_persons)].filter((value) => value !== null)
  return { min, max: maxes.length ? Math.min(...maxes) : null }
}

// Info "Kapasitas Ruangan" (hanya tampilan, bukan isian).
// → null bila paket belum dipilih; isOpen = ruangan tidak sedang ditutup Admin
//   (bukan berarti ruangan sedang kosong).
export function capacityInfo(pkg, background) {
  if (!pkg) return null
  const { min, max } = personLimits(pkg, background)
  let limitText = 'Tanpa batas orang'
  if (max !== null) limitText = min > 1 ? `${min}–${max} orang` : `Maks ${max} orang`
  else if (min > 1) limitText = `Minimal ${min} orang`
  return {
    limitText,
    isOpen: Number(pkg.is_open) === 1,
    sourceText: background ? `Latar ${background.name} · ${pkg.name}` : pkg.name,
  }
}

// Sama dengan priceLines di backend/src/core.ts.
export function estimateTotal(pkg, persons) {
  const count = Number(persons)
  if (!pkg || !Number.isInteger(count) || count < 1) return null
  const price = Number(pkg.price)
  const included = toNumber(pkg.included_persons)
  const extraPrice = toNumber(pkg.extra_person_price) ?? 0
  const baseQty = pkg.price_type === 'PER_ORANG' ? count : 1
  const extraQty = pkg.price_type === 'PER_ORANG' || included === null ? 0 : Math.max(count - included, 0)
  return { total: baseQty * price + extraQty * extraPrice, baseQty, extraQty, price, extraPrice }
}

// Validasi pilihan paket/latar/jumlah orang. required=false untuk reservasi
// (paket boleh menyusul): bila paket kosong, latar & jumlah orang diabaikan.
export function validateSelection(catalog, selection, { required }) {
  const errors = {}
  if (!selection.package_id) {
    if (required) errors.package_id = 'Pilih paket.'
    return errors
  }
  const pkg = catalog.packages.find((item) => String(item.id) === String(selection.package_id))
  if (!pkg) {
    errors.package_id = 'Paket tidak ditemukan. Muat ulang halaman.'
    return errors
  }
  const backgrounds = activeBackgrounds(catalog.backgrounds, pkg.id)
  const background = backgrounds.find((item) => String(item.id) === String(selection.background_id)) ?? null
  if (backgrounds.length > 0 && !background) errors.background_id = 'Pilih latar.'

  const persons = Number(selection.persons)
  const { min, max } = personLimits(pkg, null)
  if (selection.persons === '' || !Number.isInteger(persons) || persons < 1) {
    errors.persons = 'Isi jumlah orang (angka bulat, minimal 1).'
  } else if (persons < min || (max !== null && persons > max)) {
    errors.persons =
      max === null ? `Paket ini minimal ${min} orang.` : `Paket ini untuk ${min === max ? min : `${min}–${max}`} orang.`
  } else if (background?.max_persons != null && persons > Number(background.max_persons)) {
    errors.persons = `Latar ${background.name} maksimal ${background.max_persons} orang.`
  } else if (persons > 1000) {
    errors.persons = 'Jumlah orang maksimal 1000.'
  }
  return errors
}

export function selectionPayload(selection) {
  if (!selection.package_id) return { package_id: null, background_id: null, persons: null }
  return {
    package_id: Number(selection.package_id),
    background_id: selection.background_id ? Number(selection.background_id) : null,
    persons: Number(selection.persons),
  }
}

// Kode error backend → kolom form yang ditandai (README modul antrean).
const FIELD_BY_CODE = {
  PACKAGE_REQUIRED: 'package_id',
  PACKAGE_INACTIVE: 'package_id',
  PERSONS_REQUIRED: 'persons',
  PERSONS_LIMIT: 'persons',
  BACKGROUND_REQUIRED: 'background_id',
  BACKGROUND_CAPACITY: 'persons',
  PAST_APPOINTMENT: 'date',
  APPOINTMENT_INVALID: 'time',
  REFERENCE_REQUIRED: 'reference',
  DUPLICATE_VALUE: 'reference',
  EXCESS_NONCASH: 'amount',
  AMOUNT_LIMIT: 'amount',
  PAYMENT_NOT_SETTLED: 'amount',
  PAYMENT_REQUIRED: 'amount',
  DP_TOO_LARGE: 'amount',
  DP_EXCEEDS_TOTAL: 'package_id',
  RESERVATION_CLASH: 'time',
}

const MESSAGE_BY_CODE = {
  DUPLICATE_VALUE: 'Referensi ini sudah pernah dipakai untuk pembayaran lain.',
  EXCESS_NONCASH: 'Transfer/QRIS tidak boleh melebihi sisa tagihan.',
}

// Kolom dari VALIDATION_ERROR (details = zod issues, path mis. ["payment","reference"]).
const FIELD_BY_PATH = {
  customer_name: 'customer_name',
  phone: 'phone',
  appointment_at: 'time',
  package_id: 'package_id',
  background_id: 'background_id',
  persons: 'persons',
  reference: 'reference',
  amount: 'amount',
  method: 'method',
}

// ApiError → { fields: {kolom: pesan}, alert: { message, requestId } | null, resetRequest }
export function interpretSaveError(error) {
  if (error?.code === 'NETWORK_ERROR') {
    return {
      fields: {},
      alert: { message: 'Koneksi ke server terputus. Tekan simpan lagi, data tidak akan tercatat dua kali.' },
      resetRequest: false,
    }
  }
  if (error?.code === 'IDEMPOTENCY_CONFLICT') {
    return {
      fields: {},
      alert: {
        message:
          'Pendaftaran sebelumnya ternyata sudah tersimpan dengan isian berbeda. Cek Antrean dulu agar tidak dobel; tekan simpan lagi bila memang ingin mendaftarkan data baru.',
        requestId: error.requestId,
      },
      resetRequest: true,
    }
  }
  const field = FIELD_BY_CODE[error?.code]
  if (field) {
    return { fields: { [field]: MESSAGE_BY_CODE[error.code] ?? error.message }, alert: null, resetRequest: false }
  }
  if (error?.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const fields = {}
    for (const issue of error.details) {
      const key = [...(issue.path ?? [])].reverse().find((part) => FIELD_BY_PATH[part])
      if (key && !fields[FIELD_BY_PATH[key]]) fields[FIELD_BY_PATH[key]] = 'Isian tidak valid.'
    }
    if (Object.keys(fields).length) return { fields, alert: null, resetRequest: false }
  }
  return {
    fields: {},
    alert: { message: error?.message ?? 'Gagal menyimpan. Coba lagi.', requestId: error?.requestId },
    resetRequest: false,
  }
}
