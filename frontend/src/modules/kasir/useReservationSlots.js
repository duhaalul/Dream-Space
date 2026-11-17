import { useEffect, useState } from 'react'
import { todayWib } from '@/shared/utils/format'
import { getReservationSlots } from './api'
import { bookingMinutes } from './cashier'

// Jam reservasi yang masih bisa dipilih, dari backend (belum lewat & tidak bentrok di paket yang sama).
// params: { date, package_id, minutes[, visit_id] } atau { date, visit_id }; null = isian belum lengkap.
// refresh: ganti angkanya untuk memuat ulang (mis. setelah reservasi tersimpan).
// → { slots: ['13:15', …], loading, error }
export function useReservationSlots(params, refresh = 0) {
  const query = params ? JSON.stringify(params) : null
  const key = query ? `${query}|${refresh}` : null
  const [state, setState] = useState(null) // { key, slots, error }

  useEffect(() => {
    if (!query) return undefined
    let active = true
    getReservationSlots(JSON.parse(query))
      .then((result) => {
        if (active) setState({ key, slots: result?.slots ?? [], error: null })
      })
      .catch((error) => {
        if (active) setState({ key, slots: [], error })
      })
    return () => {
      active = false
    }
  }, [query, key])

  if (!key) return { slots: [], loading: false, error: null }
  if (state?.key !== key) return { slots: [], loading: true, error: null }
  return { slots: state.slots, loading: false, error: state.error }
}

// Pilihan Jam untuk isian reservasi: memuat jam kosong sesuai paket + tambahan (lama pemakaian) dan tanggal.
// visitId (Ubah Reservasi): reservasi itu sendiri tidak dihitung bentrok.
// original { date, time } (Ubah Reservasi): jam semula boleh dipertahankan walau sudah lewat; bentroknya dicek backend saat simpan.
// → { slots, loading, taken, options, placeholder, disabled }
export function useReservationTime({ form, pkg, chosen, visitId = null, original = null, refresh = 0 }) {
  const today = todayWib()
  const params =
    form.date && form.date >= today && pkg
      ? { date: form.date, package_id: pkg.id, minutes: bookingMinutes(pkg, chosen), ...(visitId ? { visit_id: visitId } : {}) }
      : null
  const { slots, loading } = useReservationSlots(params, refresh)
  const keepOriginal = Boolean(original && form.date === original.date && form.time === original.time)
  const missing = Boolean(form.time && params && !loading && !slots.includes(form.time))
  const taken = missing && !keepOriginal

  let placeholder = 'Pilih jam'
  if (!pkg) placeholder = 'Pilih paket dulu'
  else if (!form.date) placeholder = 'Pilih tanggal dulu'
  else if (loading) placeholder = 'Memuat…'
  else if (!slots.length) placeholder = 'Tidak ada jam kosong'

  // Jam yang sudah dipilih tapi tidak ada di daftar tetap tampil (ditandai "terisi" bila bentrok/lewat).
  const options = [...slots, ...(missing ? [form.time] : [])].sort().map((slot) => ({
    value: slot,
    label: slot === form.time && taken ? `${slot.replace(':', '.')} (terisi)` : slot.replace(':', '.'),
  }))

  return { slots, loading, taken, options, placeholder, disabled: !pkg || !form.date }
}
