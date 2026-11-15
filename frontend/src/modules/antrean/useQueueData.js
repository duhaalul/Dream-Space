import { useCallback, useEffect, useRef, useState } from 'react'
import { getPackages } from '@/modules/paket/api'
import { todayWib } from '@/shared/utils/format'
import { getQueueRooms, getVisit, getVisits } from './api'

// Data papan antrean diperbarui otomatis supaya beberapa komputer Admin tetap sinkron.
const REFRESH_MS = 15_000
const PAGE_SIZE = 100 // batas backend per halaman GET /visits

const PREVIOUS_DAYS = 60 // rentang pencarian kunjungan hari sebelumnya yang belum ditutup

// params: { date } atau { from, to }. Hanya kunjungan aktif (bukan Selesai/Dibatalkan).
async function fetchActiveVisits(params) {
  const visits = []
  for (let page = 1; page <= 20; page += 1) {
    const rows = await getVisits({ ...params, page })
    visits.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return visits
}

// "2026-11-15" + (-1) → "2026-11-14" (kalender WIB)
function shiftDate(date, days) {
  const noon = new Date(`${date}T12:00:00+07:00`).getTime()
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(noon + days * 86_400_000))
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
  }
}

async function fetchQueue(includePrevious) {
  const today = todayWib()
  const [catalog, rooms, visits, previous] = await Promise.all([
    getPackages(),
    getQueueRooms(),
    fetchActiveVisits({ date: today }),
    includePrevious ? fetchActiveVisits({ from: shiftDate(today, -PREVIOUS_DAYS), to: shiftDate(today, -1) }) : [],
  ])
  // Pelanggan yang dipanggil/sedang foto sejak hari sebelumnya tidak ada di daftar hari ini.
  const known = new Set(visits.map((visit) => visit.id))
  const previousById = new Map(previous.map((visit) => [visit.id, visit]))
  const carried = rooms.filter((room) => room.active_visit_id && !known.has(room.active_visit_id))
  const extra = await Promise.all(
    carried.map((room) => previousById.get(room.active_visit_id) ?? getVisit(room.active_visit_id).then(rowFromDetail)),
  )
  return {
    today,
    packages: catalog?.packages ?? [],
    backgrounds: catalog?.backgrounds ?? [],
    visits: [...visits, ...extra],
    // Kunjungan aktif dari hari sebelumnya (hanya bila includePrevious) — untuk peringatan di Ringkasan.
    previous,
    loadedAt: new Date(),
  }
}

// → { data, error, reload }. data null selama pemuatan pertama.
// includePrevious: ikut memuat kunjungan aktif dari hari sebelumnya (Ringkasan).
export function useQueueData({ includePrevious = false } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const reload = useCallback(() => {
    // Hanya hasil permintaan terakhir yang dipakai (hindari data lama menimpa data baru).
    const ticket = ++latest.current
    return fetchQueue(includePrevious)
      .then((next) => {
        if (ticket !== latest.current) return
        setData(next)
        setError(null)
      })
      .catch((err) => {
        if (ticket === latest.current) setError(err)
      })
  }, [includePrevious])

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (!document.hidden) reload()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  return { data, error, reload }
}
