import { RefreshCw } from 'lucide-react'
import { Alert, Button, Card } from '@/shared/components/ui'
import ReasonDialog from './ReasonDialog'

// Bagian-bagian kecil yang dipakai bersama papan Per Paket dan Ringkasan.

const clock = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })

// "Diperbarui 15.22.03" — klik untuk memuat ulang sekarang.
export function RefreshButton({ loadedAt, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
    >
      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
      Diperbarui {clock.format(loadedAt)}
    </button>
  )
}

// Tampilan sebelum data pertama tersedia (memuat / gagal + coba lagi).
export function QueueLoading({ error, onRetry }) {
  return error ? (
    <Card>
      <Alert variant="error" requestId={error.requestId}>
        Data antrean gagal dimuat. {error.message}
      </Alert>
      <Button variant="soft" className="mt-4" onClick={onRetry}>
        Coba lagi
      </Button>
    </Card>
  ) : (
    <Card>
      <p className="text-sm text-slate-500">Memuat antrean…</p>
    </Card>
  )
}

export function Section({ title, hint, aside, children }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-800">{title}</h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function EmptyNote({ children }) {
  return (
    <p className="rounded-3xl border border-dashed border-slate-200 bg-white/60 px-5 py-4 text-sm text-slate-500">{children}</p>
  )
}

// Pesan hasil tindakan (sukses/gagal) dan dialog alasan. actions = hasil useVisitActions().
export function ActionFeedback({ actions }) {
  const { notice, dialog } = actions
  return (
    <>
      {notice && (
        <Alert variant={notice.variant} requestId={notice.requestId}>
          {notice.message}
        </Alert>
      )}
      {dialog && (
        <ReasonDialog
          key={`${dialog.visit.id}-${dialog.action}`}
          config={dialog}
          busy={actions.busyId === dialog.visit.id}
          onCancel={actions.closeDialog}
          onConfirm={(reason) => actions.run(dialog.visit, dialog.action, { reason })}
        />
      )}
    </>
  )
}
