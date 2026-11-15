import { Search } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Badge, Card } from '@/shared/components/ui'
import { FIELD_CLASS } from '@/shared/components/ui/fieldClass'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { formatRupiah, formatTime } from '@/shared/utils/format'

function meta(row, pkg) {
  const parts = [pkg?.name ?? 'Tanpa paket']
  if (row.status === 'SELESAI') {
    if (row.persons) parts.push(`${row.persons} org`)
    parts.push(formatTime(row.finished_at))
  } else {
    parts.push(`Batal sebelum foto · ${formatTime(row.updated_at)}`)
  }
  return parts.join(' · ')
}

// "Daftar Transaksi Selesai & Dibatalkan" (desain 06). Klik baris → detail transaksi.
export default function HistoryList({ rows, packages, search, onSearch, onOpen, loading, correctionCount }) {
  const keyword = search.trim().toLowerCase()
  const shown = rows.filter((row) => {
    if (!keyword) return true
    return [queueLabel(row), row.customer_name, packages.get(row.package_id)?.name, row.transaction_no].some((text) =>
      text?.toLowerCase().includes(keyword),
    )
  })

  return (
    <Card title="Daftar Transaksi Selesai & Dibatalkan">
      <div className="relative mb-2">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Cari transaksi"
          placeholder="Cari no antrean, nama, atau paket…"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className={`${FIELD_CLASS} border-slate-200 pl-10`}
        />
      </div>

      {loading ? (
        <p className="py-4 text-sm text-slate-500">Memuat riwayat…</p>
      ) : shown.length ? (
        <ul className="divide-y divide-slate-100">
          {shown.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto]"
              >
                <span className="font-bold text-brand-600">{queueLabel(row) ?? '—'}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{row.customer_name}</span>
                  <span className="block truncate text-xs text-slate-500">{meta(row, packages.get(row.package_id))}</span>
                </span>
                <span className="text-right font-bold text-slate-800">{formatRupiah(row.total)}</span>
                <span className="col-start-3 flex flex-col items-end gap-1 sm:col-start-auto">
                  <Badge tone={VISIT_STATUS_TONES[row.status]}>{VISIT_STATUS_LABELS[row.status]}</Badge>
                  {correctionCount(row) > 0 && <span className="text-[11px] text-slate-500">{correctionCount(row)}× dikoreksi</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-slate-500">{keyword ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi selesai atau dibatalkan pada periode ini.'}</p>
      )}
    </Card>
  )
}
