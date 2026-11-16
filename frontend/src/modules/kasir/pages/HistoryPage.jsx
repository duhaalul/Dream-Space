import { useCallback, useEffect, useState } from 'react'
import { getPackages } from '@/modules/paket/api'
import { Alert, Input, PageHeader, StatCard } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { getHistory } from '../api'
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
  // Terbaru di atas.
  return rows.sort((a, b) => String(b.finished_at ?? b.updated_at).localeCompare(String(a.finished_at ?? a.updated_at)))
}

// T-06 Riwayat: sesi yang sudah berakhir (Selesai & Dibatalkan). Admin & Owner.
export default function HistoryPage() {
  const today = todayWib()
  const [range, setRange] = useState({ from: today, to: today })
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [packages, setPackages] = useState(new Map())

  const rangeError =
    range.from > range.to
      ? 'Tanggal awal setelah tanggal akhir.'
      : (new Date(range.to) - new Date(range.from)) / 86_400_000 > MAX_DAYS
        ? 'Rentang maksimal 367 hari.'
        : null

  const load = useCallback(() => {
    if (rangeError) return Promise.resolve()
    return fetchHistory(range.from, range.to)
      .then((list) => {
        setRows(list)
        setLoadError(null)
      })
      .catch(setLoadError)
  }, [range.from, range.to, rangeError])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getPackages()
      .then((data) => setPackages(new Map((data?.packages ?? []).map((pkg) => [pkg.id, pkg]))))
      .catch(() => {})
  }, [])

  const list = rows ?? []
  const finished = list.filter((row) => row.status === 'SELESAI').length

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

      {(rangeError || loadError) && (
        <Alert variant="error" className="mb-4" requestId={loadError?.requestId}>
          {rangeError ?? loadError.message}
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Sesi" value={list.length} />
        <StatCard tone="green" label="Selesai" value={finished} />
        <StatCard label="Dibatalkan" value={list.length - finished} />
      </div>

      <HistoryList
        rows={list}
        packages={packages}
        search={search}
        onSearch={setSearch}
        onOpen={(row) => setOpenId(row.id)}
        loading={rows === null && !loadError}
      />

      {openId && <TransactionDetailModal key={openId} visitId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
