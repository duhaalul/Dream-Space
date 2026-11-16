import { useEffect, useState } from 'react'
import { Printer, XCircle } from 'lucide-react'
import { downloadReceipt } from '@/modules/kasir/api'
import { Alert, Badge, Button, Modal } from '@/shared/components/ui'
import { PAYMENT_METHOD_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { openBlob } from '@/shared/utils/download'
import { formatRupiah, formatTime } from '@/shared/utils/format'
import { getVisit } from '../api'
import { queueLabel } from '../queue'

const ACTIVE = ['MENUNGGU', 'DIPANGGIL', 'DILEWATI']

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-800">{children}</dd>
    </div>
  )
}

// Detail kunjungan (tombol "Detail" di Antrean): ringkas, hanya yang penting.
// Admin bisa membatalkan (sebelum foto). onCancelVisit(visit) menutup modal lalu membuka dialog alasan.
export default function VisitDetailModal({ visitId, isAdmin, onClose, onCancelVisit }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    getVisit(visitId).then(setDetail).catch(setError)
  }, [visitId])

  async function print() {
    setPrinting(true)
    try {
      openBlob(await downloadReceipt(detail.transaction.id))
    } catch (err) {
      setError(err)
    } finally {
      setPrinting(false)
    }
  }

  let body = <p className="text-sm text-slate-500">Memuat…</p>
  let footer = null
  if (detail) {
    const { visit, transaction, balance, items, payments } = detail
    const active = items.filter((item) => Number(item.is_active) === 1)
    const pkgName = active.find((item) => item.item_type === 'PAKET')?.description
    const addons = active.filter((item) => item.item_type === 'TAMBAHAN').map((item) => `${item.description} ×${item.qty}`)
    const methods = [...new Set(payments.map((payment) => PAYMENT_METHOD_LABELS[payment.method]))].join(', ')
    const paid = Boolean(transaction.paid_off_at)

    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-slate-800">{visit.customer_name}</p>
          {queueLabel(visit) && <Badge tone="gray">{queueLabel(visit)}</Badge>}
          <Badge tone={VISIT_STATUS_TONES[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
        </div>
        {error && (
          <Alert variant="error" requestId={error.requestId}>
            {error.message}
          </Alert>
        )}
        <dl className="space-y-2.5">
          <Row label="Paket">{[pkgName ?? '-', transaction.background_snapshot, visit.persons && `${visit.persons} orang`].filter(Boolean).join(' · ')}</Row>
          {addons.length > 0 && <Row label="Tambahan">{addons.join(', ')}</Row>}
          <Row label="Pembayaran">
            {paid ? `Lunas ${formatRupiah(transaction.total)}${methods ? ` · ${methods}` : ''}` : `Belum lunas · sisa ${formatRupiah(balance.due)}`}
          </Row>
          <Row label="Daftar">{formatTime(visit.created_at)}</Row>
          {visit.cancel_reason && <Row label="Alasan batal">{visit.cancel_reason}</Row>}
        </dl>
      </div>
    )

    const canCancel = isAdmin && ACTIVE.includes(visit.status)
    if (paid || canCancel) {
      footer = (
        <>
          {canCancel && (
            <Button variant="danger" onClick={() => onCancelVisit(visit)}>
              <XCircle aria-hidden="true" className="h-4 w-4" /> Batalkan
            </Button>
          )}
          {paid && (
            <Button variant="success" loading={printing} onClick={print}>
              {!printing && <Printer aria-hidden="true" className="h-4 w-4" />} Cetak Nota
            </Button>
          )}
        </>
      )
    }
  } else if (error) {
    body = (
      <Alert variant="error" requestId={error.requestId}>
        {error.message}
      </Alert>
    )
  }

  return (
    <Modal open title="Detail" onClose={onClose} footer={footer}>
      {body}
    </Modal>
  )
}
