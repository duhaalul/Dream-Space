import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Alert, Badge, Button, Modal } from '@/shared/components/ui'
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { openBlob } from '@/shared/utils/download'
import { formatDateTime, formatRupiah } from '@/shared/utils/format'
import { downloadReceipt, getAudit, getCashierDetail } from '../api'
import { activeItems, corrections, itemLabel } from '../cashier'
import AuditList from './AuditList'

function Row({ label, value, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <span>{label}</span>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  )
}

// Detail transaksi di Riwayat (Admin & Owner): rincian, pembayaran, cetak ulang nota, riwayat koreksi.
// Pasang dengan key = visitId.
export default function TransactionDetailModal({ visitId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [audit, setAudit] = useState([])
  const [error, setError] = useState(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    getCashierDetail(visitId)
      .then(async (data) => {
        setDetail(data)
        setAudit(await getAudit(data.transaction.id))
      })
      .catch(setError)
  }, [visitId])

  async function print() {
    setPrinting(true)
    setError(null)
    try {
      openBlob(await downloadReceipt(detail.transaction.id))
    } catch (err) {
      setError(err)
    } finally {
      setPrinting(false)
    }
  }

  let body = <p className="text-sm text-slate-500">Memuat detail transaksi…</p>
  if (detail) {
    const { visit, transaction, balance, payments, refunds } = detail
    body = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-slate-800">{visit.customer_name}</p>
          <Badge tone={VISIT_STATUS_TONES[visit.status]}>{VISIT_STATUS_LABELS[visit.status]}</Badge>
          {queueLabel(visit) && <Badge tone="gray">{queueLabel(visit)}</Badge>}
        </div>
        <p className="-mt-3 text-sm text-slate-500">
          {transaction.transaction_no}
          {transaction.completed_at && ` · Selesai ${formatDateTime(transaction.completed_at)} WIB`}
          {transaction.cancelled_at && ` · Dibatalkan ${formatDateTime(transaction.cancelled_at)} WIB`}
        </p>
        {visit.cancel_reason && <Alert variant="warning">Alasan batal: {visit.cancel_reason}. Uang yang sudah dibayar tidak dikembalikan.</Alert>}
        {error && (
          <Alert variant="error" requestId={error.requestId}>
            {error.message}
          </Alert>
        )}

        <div className="space-y-2 text-sm text-slate-700">
          {activeItems(detail).map((item) => (
            <Row key={item.id} label={itemLabel(item, transaction)} value={formatRupiah(item.amount)} />
          ))}
          <Row className="border-t border-slate-100 pt-2 font-bold text-slate-800" label="Total" value={formatRupiah(transaction.total)} />
          <Row className="text-emerald-700" label="Diterima bersih" value={formatRupiah(balance.net)} />
        </div>

        {(payments.length > 0 || refunds.length > 0) && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Pembayaran</p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {payments.map((payment) => (
                <li key={`p-${payment.id}`} className="flex justify-between gap-3">
                  <span>
                    {PAYMENT_TYPE_LABELS[payment.payment_type]} · {PAYMENT_METHOD_LABELS[payment.method]} · {formatDateTime(payment.paid_at)}
                    {payment.reference && ` · ref ${payment.reference}`}
                  </span>
                  <span className="shrink-0 font-semibold text-emerald-700">{formatRupiah(payment.amount)}</span>
                </li>
              ))}
              {refunds.map((refund) => (
                <li key={`r-${refund.id}`} className="flex justify-between gap-3">
                  <span>Refund · {PAYMENT_METHOD_LABELS[refund.method]}</span>
                  <span className="shrink-0 font-semibold text-slate-500">{formatRupiah(-refund.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Riwayat Koreksi</p>
          <AuditList entries={corrections(audit)} />
        </div>
      </div>
    )
  } else if (error) {
    body = (
      <Alert variant="error" requestId={error.requestId}>
        Detail gagal dimuat. {error.message}
      </Alert>
    )
  }

  return (
    <Modal
      open
      size="lg"
      title="Detail Transaksi"
      onClose={onClose}
      footer={
        detail?.visit.status === 'SELESAI' && (
          <Button variant="success" loading={printing} onClick={print}>
            <Printer aria-hidden="true" className="h-4 w-4" /> Cetak Ulang Nota PDF
          </Button>
        )
      }
    >
      {body}
    </Modal>
  )
}
