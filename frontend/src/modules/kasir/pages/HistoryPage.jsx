import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/modules/akun/useAuth'
import { getPackages } from '@/modules/paket/api'
import { Alert, Input, PageHeader, StatCard } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import { formatDate, todayWib } from '@/shared/utils/format'
import { getAudit, getHistory } from '../api'
import { corrections } from '../cashier'
import CorrectionPanel from '../components/CorrectionPanel'
import HistoryList from '../components/HistoryList'
import TransactionDetailModal from '../components/TransactionDetailModal'

const MAX_DAYS = 366 // backend: rentang maksimal 367 hari

async function fetchHistory(from, to) {
  const rows = []
  for (let page = 1; page <= 50; page += 1) {
    const batch = await getHistory({ from, to, page })
    rows.push(...batch)
    if (batch.length < 100) break
  }
  // Terbaru di atas (selesai/batal paling akhir).
  return rows.sort((a, b) => String(b.finished_at ?? b.updated_at).localeCompare(String(a.finished_at ?? a.updated_at)))
}

// Jumlah koreksi per transaksi. Backend tidak punya daftar audit global,
// jadi audit diambil per transaksi yang tampil (sekali per pemuatan).
async function fetchCorrectionCounts(rows) {
  const entries = await Promise.all(
    rows.map((row) =>
      getAudit(row.transaction_id)
        .then((audit) => [row.transaction_id, corrections(audit).length])
        .catch(() => [row.transaction_id, 0]),
    ),
  )
  return Object.fromEntries(entries)
}

// T-06 Riwayat transaksi (desain 06_Riwayat_Transaksi_dan_Koreksi).
// Admin: lihat + koreksi. Owner: lihat (detail, riwayat koreksi, cetak ulang nota).
export default function HistoryPage() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const today = todayWib()
  const [range, setRange] = useState({ from: today, to: today })
  const [rows, setRows] = useState(null)
  const [counts, setCounts] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)

  const rangeError =
    range.from > range.to
      ? 'Tanggal awal tidak boleh setelah tanggal akhir.'
      : (new Date(range.to) - new Date(range.from)) / 86_400_000 > MAX_DAYS
        ? 'Rentang maksimal 367 hari.'
        : null

  const load = useCallback(() => {
    if (rangeError) return Promise.resolve()
    return fetchHistory(range.from, range.to)
      .then(async (list) => {
        setRows(list)
        setLoadError(null)
        setCounts(await fetchCorrectionCounts(list))
      })
      .catch(setLoadError)
  }, [range.from, range.to, rangeError])

  useEffect(() => {
    load()
  }, [load])

  const [packages, setPackages] = useState(new Map())
  useEffect(() => {
    getPackages()
      .then((data) => setPackages(new Map((data?.packages ?? []).map((pkg) => [pkg.id, pkg]))))
      .catch(() => {})
  }, [])

  const list = rows ?? []
  const finished = list.filter((row) => row.status === 'SELESAI').length
  const cancelled = list.filter((row) => row.status === 'DIBATALKAN').length
  const correctionTotal = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const periodLabel = range.from === today && range.to === today ? 'Hari ini' : `${formatDate(range.from)} – ${formatDate(range.to)}`

  return (
    <>
      <PageHeader
        title="Riwayat"
        code="T-06"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Dari" type="date" max={today} value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
            <Input label="Sampai" type="date" max={today} value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
          </div>
        }
      />

      {rangeError && <Alert variant="error" className="mb-4">{rangeError}</Alert>}
      {loadError && (
        <Alert variant="error" className="mb-4" requestId={loadError.requestId}>
          Riwayat gagal dimuat. {loadError.message}
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Transaksi" value={`${list.length} Transaksi`} hint={periodLabel} />
        <StatCard tone="green" label="Selesai Sukses" value={`${finished} Sesi`} hint="Lunas & cetak nota" />
        <StatCard label="Dibatalkan" value={`${cancelled} Sesi`} hint="DP tidak dikembalikan" />
        <StatCard label="Koreksi Data" value={`${correctionTotal} Log Audit`} hint="Tercatat lengkap" />
      </div>

      <div className={`grid items-start gap-6 ${isAdmin ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]' : ''}`}>
        <HistoryList
          rows={list}
          packages={packages}
          search={search}
          onSearch={setSearch}
          onOpen={(row) => setOpenId(row.id)}
          loading={rows === null && !loadError}
          correctionCount={(row) => counts[row.transaction_id] ?? 0}
        />
        {isAdmin && <CorrectionPanel rows={list} onCorrected={load} />}
      </div>

      {openId && <TransactionDetailModal key={openId} visitId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
