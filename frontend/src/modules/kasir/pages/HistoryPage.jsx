import { useCallback, useEffect, useState } from 'react'
import { getPackages } from '@/modules/paket/api'
import { Alert, Input, PageHeader, StatCard } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { getHistory } from '../api'
import HistoryList from '../components/HistoryList'
import TransactionDetailModal from '../components/TransactionDetailModal'

async function fetchHistory(date) {
  const rows = []
  for (let page = 1; page <= 50; page += 1) {
    const batch = await getHistory({ date, page })
    rows.push(...batch)
    if (batch.length < 100) break
  }
  // Terbaru di atas.
  return rows.sort((a, b) => String(b.finished_at ?? b.updated_at).localeCompare(String(a.finished_at ?? a.updated_at)))
}

// T-06 Riwayat: sesi yang sudah berakhir (Selesai & Dibatalkan) pada satu tanggal. Admin & Owner memilih tanggal.
// Uang penjualan dilihat di menu Laporan (Admin: hari ini).
export default function HistoryPage() {
  const today = todayWib()
  const [date, setDate] = useState(today)
  const [state, setState] = useState(null) // { date, rows }
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [packages, setPackages] = useState(new Map())

  const load = useCallback(() => {
    if (!date) return Promise.resolve()
    return fetchHistory(date)
      .then((rows) => {
        setState({ date, rows })
        setLoadError(null)
      })
      .catch(setLoadError)
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    getPackages()
      .then((data) => setPackages(new Map((data?.packages ?? []).map((pkg) => [pkg.id, pkg]))))
      .catch(() => {})
  }, [])

  // Data tanggal sebelumnya tidak ditampilkan selama data tanggal baru dimuat.
  const rows = state?.date === date ? state.rows : null
  const list = rows ?? []
  const finished = list.filter((row) => row.status === 'SELESAI').length

  return (
    <>
      <PageHeader
        title="Riwayat"
        code="T-06"
        actions={<Input label="Tanggal" type="date" max={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />}
      />

      {loadError && (
        <Alert variant="error" className="mb-4" requestId={loadError.requestId}>
          {loadError.message}
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
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
