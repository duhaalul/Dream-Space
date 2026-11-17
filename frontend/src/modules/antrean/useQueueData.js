import { useCallback, useEffect, useRef, useState } from 'react'
import { getPackages } from '@/modules/paket/api'
import { todayWib } from '@/shared/utils/format'
import { getQueueRooms, getVisit, getVisits } from './api'

// Data papan antrean diperbarui otomatis supaya beberapa komputer Admin tetap sinkron.
const REFRESH_MS = 15_000
const PAGE_SIZE = 100 // batas backend per halaman GET /visits

// params: { date } atau { from, to }. Hanya kunjungan aktif (bukan Selesai/Dibatalkan).
export async function fetchActiveVisits(params) {
  const visits = []
  for (let page = 1; page <= 20; page += 1) {
    const rows = await getVisits({ ...params, page })
    visits.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return visits
}

// Bentuk baris detail (GET /visits/:id) disamakan dengan baris daftar GET /visits.
function rowFromDetail(detail) {
  return {
    ...detail.visit,
    transaction_id: detail.transaction.id,
    transaction_no: detail.transaction.transaction_no,
    total: detail.transaction.total,
    payment_status: detail.transaction.payment_status,
    transaction_version: detail.transaction.version,
    paid: detail.balance.net,
  }
}

// Tanggal WIB "YYYY-MM-DD" digeser n hari.
function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

async function fetchQueue() {
  const today = todayWib()
  const [catalog, rooms, visits] = await Promise.all([getPackages(), getQueueRooms(), fetchActiveVisits({ date: today })])
  // Pelanggan yang dipanggil/sedang foto sejak hari sebelumnya tidak ada di daftar hari ini
  // (backend menutupnya otomatis saat ganti hari; ini hanya jaga-jaga sebelum proses itu berjalan).
  const known = new Set(visits.map((visit) => visit.id))
  const carried = rooms.filter((room) => room.active_visit_id && !known.has(room.active_visit_id))
  const extra = await Promise.all(carried.map((room) => getVisit(room.active_visit_id).then(rowFromDetail)))
  return {
    today,
    packages: catalog?.packages ?? [],
    backgrounds: catalog?.backgrounds ?? [],
    visits: [...visits, ...extra],
    loadedAt: new Date(),
  }
}

// → { data, error, reload }. data null selama pemuatan pertama.
export function useQueueData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const reload = useCallback(() => {
    // Hanya hasil permintaan terakhir yang dipakai (hindari data lama menimpa data baru).
    const ticket = ++latest.current
    return fetchQueue()
      .then((next) => {
        if (ticket !== latest.current) return
        setData(next)
        setError(null)
      })
      .catch((err) => {
        if (ticket === latest.current) setError(err)
      })
  }, [])

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (!document.hidden) reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  return { data, error, reload }
}

// Reservasi yang belum datang pada satu tanggal (bagian Reservasi di Antrean), urut jam reservasi.
// Diperbarui otomatis seperti papan. → { data: visits[] | null, error, reload }
export function useReservations(date) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const reload = useCallback(() => {
    const ticket = ++latest.current
    return fetchActiveVisits({ date })
      .then((visits) => {
        if (ticket !== latest.current) return
        setState({ date, visits: visits.filter((visit) => visit.status === 'RESERVASI') })
        setError(null)
      })
      .catch((err) => {
        if (ticket === latest.current) setError(err)
      })
  }, [date])

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (!document.hidden) reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  return { data: state?.date === date ? state.visits : null, error, reload }
}

// Reservasi TERLEWAT: tanggalnya sudah lewat tapi pelanggan belum datang dan belum dibatalkan
// (tanda "Terlewat (N)" di bagian Reservasi). Rentang 1 tahun ke belakang (batas backend 367 hari), urut jadwal.
// Diperbarui otomatis seperti papan. → { data: visits[] | null, error, reload }
export function useOverdueReservations() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const reload = useCallback(() => {
    const ticket = ++latest.current
    const today = todayWib()
    return fetchActiveVisits({ from: shiftDate(today, -365), to: shiftDate(today, -1) })
      .then((visits) => {
        if (ticket !== latest.current) return
        setData(
          visits
            .filter((visit) => visit.status === 'RESERVASI')
            .sort((a, b) => String(a.appointment_at).localeCompare(String(b.appointment_at)) || a.id - b.id),
        )
        setError(null)
      })
      .catch((err) => {
        if (ticket === latest.current) setError(err)
      })
  }, [])

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (!document.hidden) reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  return { data, error, reload }
}

// Kunjungan aktif pada satu tanggal + kondisi ruangan (info "Urutan ke-N" di Pendaftaran).
// reload() dipanggil setelah pendaftaran berhasil supaya urutan langsung benar.
// date kosong → tidak memuat apa pun. → { data: { date, visits, rooms, loadedAt } | null, error }
export function useDayVisits(date) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const reload = useCallback(() => {
    if (!date) return Promise.resolve()
    const ticket = ++latest.current
    return Promise.all([fetchActiveVisits({ date }), getQueueRooms()])
      .then(([visits, rooms]) => {
        if (ticket !== latest.current) return
        setState({ date, visits, rooms, loadedAt: new Date() })
        setError(null)
      })
      .catch((err) => {
        if (ticket === latest.current) setError(err)
      })
  }, [date])

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (!document.hidden) reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  // Data tanggal lain (sebelum data baru tiba) tidak ditampilkan.
  return { data: state?.date === date ? state : null, error: date ? error : null, reload }
}
