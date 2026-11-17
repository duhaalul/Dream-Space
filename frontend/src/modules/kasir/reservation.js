// Logika bersama isian reservasi (tab Reservasi di Pendaftaran & pop-up Ubah Reservasi di Antrean).
import { selectionPayload, validateSelection } from '@/modules/antrean/visitForm'
import { todayWib } from '@/shared/utils/format'

// "0812-3456 7890" → "081234567890"; valid bila 8–15 angka (boleh diawali +). Sama dengan backend.
export const normalizePhone = (value) => value.trim().replace(/[\s-]/g, '')
export const validPhone = (value) => /^\+?\d{8,15}$/.test(normalizePhone(value))

export const TAKEN_MESSAGE = 'Jam ini sudah terisi reservasi lain atau sudah lewat. Pilih jam lain.'

// Pesan yang dicek langsung saat diketik: jumlah orang, No. WhatsApp, jam bentrok.
// time = hasil useReservationTime().
export function liveReservationErrors(catalog, form, pkg, time) {
  const errors = {}
  if (pkg && form.persons !== '') {
    const personsError = validateSelection(catalog, form, { required: true }).persons
    if (personsError) errors.persons = personsError
  }
  if (form.phone.trim() && !validPhone(form.phone)) errors.phone = 'Isi 8–15 angka.'
  if (time.taken) errors.time = TAKEN_MESSAGE
  return errors
}

// Validasi saat Simpan: nama, No. WA, paket/latar/orang, tanggal & jam.
export function validateReservation(catalog, form, time) {
  const errors = validateSelection(catalog, form, { required: true })
  if (!form.customer_name.trim()) errors.customer_name = 'Isi nama panggilan.'
  if (form.phone.trim() && !validPhone(form.phone)) errors.phone = 'Isi 8–15 angka.'
  if (!form.date) errors.date = 'Pilih tanggal.'
  else if (form.date < todayWib()) errors.date = 'Tanggal sudah lewat.'
  if (!form.time) errors.time = 'Pilih jam.'
  else if (time.loading) errors.time = 'Pilihan jam masih dimuat. Coba lagi.'
  else if (time.taken) errors.time = TAKEN_MESSAGE
  return errors
}

// Bagian body yang sama untuk POST /visits/reservation dan PUT /visits/:id/reservation.
export function reservationPayload(form, chosen) {
  return {
    customer_name: form.customer_name.trim(),
    phone: form.phone.trim() ? normalizePhone(form.phone) : null,
    appointment_at: `${form.date} ${form.time}:00`,
    ...selectionPayload(form),
    addons: chosen.map(({ addon, qty }) => ({ addon_id: addon.id, qty })),
  }
}
