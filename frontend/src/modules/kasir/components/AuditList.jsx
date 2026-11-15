import { formatDateTime } from '@/shared/utils/format'
import { correctionSummary } from '../cashier'

// Riwayat koreksi satu transaksi (entri audit CORRECTION). Dilihat Admin & Owner.
export default function AuditList({ entries }) {
  if (!entries.length) return <p className="text-sm text-slate-500">Belum pernah dikoreksi.</p>
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
          <p className="text-xs text-slate-500">{formatDateTime(entry.created_at)} WIB</p>
          <ul className="mt-1 space-y-0.5 font-medium text-slate-700">
            {correctionSummary(entry).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {entry.reason && <p className="mt-1 text-xs text-slate-600">Alasan: {entry.reason}</p>}
        </li>
      ))}
    </ol>
  )
}
