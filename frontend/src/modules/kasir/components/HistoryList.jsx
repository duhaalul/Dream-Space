import { Search } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Badge, Card } from '@/shared/components/ui'
import { FIELD_CLASS } from '@/shared/components/ui/fieldClass'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { formatRupiah, formatTime, parseBackendDate } from '@/shared/utils/format'

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

// "Paket · 3 org · 10.25" (selesai) / "Paket · 10.25" (batal).
// Reservasi yang batal sebelum datang (tampil di tanggal batalnya): "Paket · Jadwal 25 Nov 14.00".
function meta(row, pkg) {
  const parts = [pkg?.name ?? '-']
  if (row.status === 'SELESAI' && row.persons) parts.push(`${row.persons} org`)
  if (row.customer_type === 'RESERVASI' && row.queue_number === null && row.appointment_at) {
    parts.push(`Jadwal ${shortDate.format(parseBackendDate(row.appointment_at))} ${formatTime(row.appointment_at)}`)
  } else {
    parts.push(formatTime(row.finished_at ?? row.updated_at))
  }
  return parts.join(' · ')
}

// Daftar sesi Selesai & Dibatalkan + pencarian. Klik baris → detail.
export default function HistoryList({ rows, packages, search, onSearch, onOpen, loading }) {
  const keyword = search.trim().toLowerCase()
  const shown = rows.filter((row) => {
    if (!keyword) return true
    return [queueLabel(row), row.customer_name, packages.get(row.package_id)?.name, row.transaction_no].some((text) =>
      text?.toLowerCase().includes(keyword),
    )
  })

  return (
    <Card>
      <div className="relative mb-2">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Cari"
          placeholder="Cari nomor, nama, atau paket…"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className={`${FIELD_CLASS} border-slate-200 pl-10`}
        />
      </div>

      {loading ? (
        <p className="py-4 text-sm text-slate-500">Memuat…</p>
      ) : shown.length ? (
        <ul className="divide-y divide-slate-100">
          {shown.map((row) => (
            <li key={row.id}>
              {/* Lebar kolom Nominal & Status tetap supaya angka rata kanan di satu garis dan badge sejajar,
                  berapa pun panjang tulisannya ("Selesai" vs "Dibatalkan"). Di HP: Nominal di atas Status, rata kanan. */}
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[5.5rem_minmax(0,1fr)_8rem_6.5rem] sm:gap-x-4"
              >
                <span className="col-span-2 text-xs font-bold text-brand-600 sm:col-span-1 sm:text-base">{queueLabel(row) ?? '—'}</span>
                <span className="min-w-0">
                  <span className="block max-sm:wrap-anywhere font-semibold text-slate-800 sm:truncate">{row.customer_name}</span>
                  <span className="block max-sm:wrap-anywhere text-xs text-slate-500 sm:truncate">{meta(row, packages.get(row.package_id))}</span>
                </span>
                <span className="text-right text-sm font-bold text-slate-800 max-sm:wrap-anywhere sm:text-base sm:whitespace-nowrap">{formatRupiah(row.total)}</span>
                <span className="col-start-2 justify-self-end sm:col-start-auto sm:justify-self-start">
                  <Badge tone={VISIT_STATUS_TONES[row.status]}>{VISIT_STATUS_LABELS[row.status]}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-slate-500">{keyword ? 'Tidak ada yang cocok.' : 'Belum ada sesi pada tanggal ini.'}</p>
      )}
    </Card>
  )
}
