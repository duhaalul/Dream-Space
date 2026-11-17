import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Alert, Badge, Button, Modal } from '@/shared/components/ui'
import { VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from '@/shared/utils/constants'
import { openBlob } from '@/shared/utils/download'
import { formatDateTime, formatRupiah } from '@/shared/utils/format'
import { downloadReceipt, getTransactionDetail } from '../api'
import { activeItems, fullyPaid, itemLabel, itemsTotal, methodLabel, totalChange } from '../cashier'

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'font-bold text-slate-800' : 'text-sm text-slate-600'}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  )
}

// Nota & baris "Lunas": sesi Selesai, atau lunas penuh (uang menutup semua layanan; sama dengan syarat backend).
const canPrintReceipt = (detail) => detail.visit.status === 'SELESAI' || fullyPaid(detail)

// Detail sesi di Riwayat: rincian, Total (harga semua layanan), pembayaran, uang dikembalikan,
// uang ditahan (kunjungan batal), waktu lunas, alasan batal, cetak ulang nota. Pasang dengan key = visitId.
export default function TransactionDetailModal({ visitId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    getTransactionDetail(visitId).then(setDetail).catch(setError)
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
  if (detail) {
    const { visit, payments, refunds = [] } = detail
    const cancelled = visit.status === 'DIBATALKAN'
    const held = Number(detail.balance.net)
    const change = totalChange(detail)
    // Jam lunas hanya bila benar-benar lunas; data Selesai lama tanpa paid_off_at memakai pembayaran terakhir.
    const paidAt = fullyPaid(detail) ? detail.transaction.paid_off_at : visit.status === 'SELESAI' ? payments.at(-1)?.paid_at : null
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

        <div className="space-y-1.5">
          {activeItems(detail).map((item) => (
            <Row key={item.id} label={itemLabel(item)} value={formatRupiah(item.amount)} />
          ))}
          {/* Total = harga semua layanan (untuk kunjungan batal, transaction.total berisi uang yang ditahan). */}
          <div className="border-t border-slate-100 pt-2">
            <Row strong label="Total" value={formatRupiah(itemsTotal(detail))} />
          </div>
        </div>

        {payments.length > 0 && (
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            {payments.map((payment) => (
              <Row
                key={payment.id}
                label={`${payment.payment_type === 'DP' ? 'DP · ' : ''}${methodLabel(payment.method)}`}
                value={formatRupiah(payment.cash_received ?? payment.amount)}
              />
            ))}
            {/* Uang yang dikembalikan saat turun paket (Ubah Reservasi). */}
            {refunds.map((refund) => (
              <Row key={`refund-${refund.id}`} label={`Dikembalikan · ${methodLabel(refund.method)}`} value={formatRupiah(-refund.amount)} />
            ))}
            {change > 0 && <Row label="Kembalian" value={formatRupiah(change)} />}
            {/* Batal: uang yang sudah dibayar tidak dikembalikan (ditahan). */}
            {cancelled && held > 0 && <Row strong label="Uang ditahan (batal)" value={formatRupiah(held)} />}
            {paidAt && <Row label="Lunas" value={formatDateTime(paidAt)} />}
          </div>
        )}

        {visit.cancel_reason && <Alert variant="warning">Batal: {visit.cancel_reason}</Alert>}
      </div>
    )
  } else if (error) {
    body = (
      <Alert variant="error" requestId={error.requestId}>
        {error.message}
      </Alert>
    )
  }

  const canPrint = detail && canPrintReceipt(detail)
  return (
    <Modal
      open
      title="Detail"
      onClose={onClose}
      footer={
        canPrint && (
          <Button variant="success" loading={printing} onClick={print}>
            {!printing && <Printer aria-hidden="true" className="h-4 w-4" />} Cetak Ulang Nota
          </Button>
        )
      }
    >
      {body}
    </Modal>
  )
}
