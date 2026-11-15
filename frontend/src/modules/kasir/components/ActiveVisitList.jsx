import { useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Card } from '@/shared/components/ui'
import { FIELD_CLASS } from '@/shared/components/ui/fieldClass'
import { VISIT_STATUS_LABELS } from '@/shared/utils/constants'
import { formatRupiah, formatTime } from '@/shared/utils/format'

// Yang paling perlu dilayani kasir di atas: sedang foto, dipanggil, menunggu, dilewati, reservasi.
const STATUS_ORDER = { SEDANG_DILAYANI: 0, DIPANGGIL: 1, MENUNGGU: 2, DILEWATI: 3, RESERVASI: 4 }

// Kolom "Pelanggan Aktif" (desain 05_Kasir_Admin). Klik pelanggan → /kasir/:id.
// visits: hasil GET /visits hari ini (aktif); packages: Map id → paket.
export default function ActiveVisitList({ visits, packages, selectedId, loading }) {
  const [search, setSearch] = useState('')
  const keyword = search.trim().toLowerCase()
  const shown = visits
    .filter((visit) => {
      if (!keyword) return true
      return [visit.customer_name, queueLabel(visit), visit.transaction_no].some((text) => text?.toLowerCase().includes(keyword))
    })
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  return (
    <Card title="Pelanggan Aktif">
      <div className="relative mb-4">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Cari pelanggan"
          placeholder="Cari nama / nomor antrean…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`${FIELD_CLASS} border-slate-200 pl-10`}
        />
      </div>

      {loading && !visits.length ? (
        <p className="text-sm text-slate-500">Memuat pelanggan…</p>
      ) : shown.length ? (
        <ul className="space-y-3">
          {shown.map((visit) => {
            const selected = String(visit.id) === String(selectedId)
            const pkg = packages.get(visit.package_id)
            const code = queueLabel(visit) ?? `Janji ${formatTime(visit.appointment_at)}`
            return (
              <li key={visit.id}>
                <Link
                  to={`/kasir/${visit.id}`}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                    selected ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-bold ${selected ? 'text-brand-600' : 'text-slate-800'}`}>{code}</p>
                    <p className="truncate text-xs text-slate-500">
                      {pkg?.name ?? 'Paket belum dipilih'} · {VISIT_STATUS_LABELS[visit.status]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-slate-800">{formatRupiah(visit.total)}</p>
                    <p className={`text-xs ${selected ? 'text-brand-600' : 'text-slate-500'}`}>{visit.customer_name}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{keyword ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada pelanggan aktif hari ini.'}</p>
      )}
    </Card>
  )
}
