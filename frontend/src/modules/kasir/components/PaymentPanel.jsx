import { useState } from 'react'
import { ArrowRight, Printer } from 'lucide-react'
import { Alert, Button, Card, Input, SegmentedControl, Select } from '@/shared/components/ui'
import { PAYMENT_METHOD_LABELS } from '@/shared/utils/constants'
import { openBlob } from '@/shared/utils/download'
import { formatRupiah } from '@/shared/utils/format'
import { newRequestId } from '@/shared/utils/requestId'
import { addPayment, addRefund, downloadReceipt, finishVisit } from '../api'
import { activeItems, canReceivePayment, cashierError, finishBlocker, paymentTypeFor } from '../cashier'

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))

// Kolom "Pembayaran" (desain 05_Kasir_Admin). Pasang dengan key = id kunjungan.
// onUpdated(detail) dipanggil dengan detail terbaru dari backend; onReload() memuat ulang.
export default function PaymentPanel({ detail, onUpdated, onReload }) {
  const { visit, transaction, balance } = detail
  const [method, setMethod] = useState('TUNAI')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [refundMethod, setRefundMethod] = useState('TUNAI')
  const [refundReason, setRefundReason] = useState('')
  // Satu request ID per pembayaran/refund; dipakai ulang saat diulang setelah gagal (NFR-02).
  const [paymentId, setPaymentId] = useState(newRequestId)
  const [refundId, setRefundId] = useState(newRequestId)
  const [busy, setBusy] = useState(null) // 'pay' | 'refund' | 'finish' | 'receipt'
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)

  const paymentType = paymentTypeFor(visit)
  const canPay = canReceivePayment(detail)
  const blocker = finishBlocker(detail)
  const cash = method === 'TUNAI'
  const value = Number(amount)
  const change = cash && balance.due > 0 && value > balance.due ? value - balance.due : 0
  const referenceRequired = !cash && paymentType === 'DP'

  function fail(error, kind) {
    const outcome = cashierError(error)
    setErrors(outcome.field ? { [outcome.field]: outcome.message } : {})
    setFeedback(outcome.field ? null : outcome)
    if (outcome.resetRequest) (kind === 'refund' ? setRefundId : setPaymentId)(newRequestId())
    if (outcome.reload) onReload()
  }

  async function pay(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!Number.isInteger(value) || value < 1) nextErrors.amount = 'Isi nominal (angka bulat, minimal Rp1).'
    else if (!cash && balance.due > 0 && value > balance.due) nextErrors.amount = `Transfer/QRIS tidak boleh melebihi sisa tagihan ${formatRupiah(balance.due)}.`
    if (referenceRequired && !reference.trim()) nextErrors.reference = 'DP nontunai wajib mencantumkan referensi.'
    setErrors(nextErrors)
    setFeedback(null)
    if (Object.keys(nextErrors).length) return

    setBusy('pay')
    try {
      const result = await addPayment(transaction.id, {
        client_request_id: paymentId,
        payment_type: paymentType,
        method,
        amount: value,
        reference: cash ? null : reference.trim() || null,
      })
      const received = result.payments.reduce((latest, payment) => (payment.id > latest.id ? payment : latest))
      setPaymentId(newRequestId())
      setAmount('')
      setReference('')
      const changeText = Number(received.change_amount) > 0 ? ` Kembalian ${formatRupiah(received.change_amount)}.` : ''
      setFeedback({ variant: 'success', message: `Pembayaran ${formatRupiah(received.amount)} (${PAYMENT_METHOD_LABELS[method]}) diterima.${changeText}` })
      onUpdated(result)
    } catch (error) {
      fail(error, 'pay')
    } finally {
      setBusy(null)
    }
  }

  async function refund() {
    if (refundReason.trim().length < 3) {
      setErrors({ refund: 'Alasan refund wajib diisi, minimal 3 karakter.' })
      return
    }
    setErrors({})
    setFeedback(null)
    setBusy('refund')
    try {
      const result = await addRefund(transaction.id, {
        client_request_id: refundId,
        amount: balance.surplus,
        method: refundMethod,
        reason: refundReason.trim(),
      })
      setRefundId(newRequestId())
      setRefundReason('')
      setFeedback({ variant: 'success', message: `Kelebihan bayar ${formatRupiah(balance.surplus)} dikembalikan (${PAYMENT_METHOD_LABELS[refundMethod]}).` })
      onUpdated(result)
    } catch (error) {
      fail(error, 'refund')
    } finally {
      setBusy(null)
    }
  }

  async function printReceipt() {
    setBusy('receipt')
    try {
      openBlob(await downloadReceipt(transaction.id))
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  async function finish() {
    setFeedback(null)
    setBusy('finish')
    try {
      // Konfirmasi akhir: jumlah orang & SELURUH tambahan saat ini (array kosong bila tidak ada).
      const addons = activeItems(detail)
        .filter((item) => item.item_type === 'TAMBAHAN')
        .map((item) => ({ addon_id: item.addon_id, qty: item.qty }))
      const result = await finishVisit(visit.id, {
        version: visit.version,
        transaction_version: transaction.version,
        persons: visit.persons,
        addons,
      })
      onUpdated(result)
      setFeedback({ variant: 'success', message: 'Sesi selesai. Nota PDF dibuka di tab baru untuk dicetak.' })
      openBlob(await downloadReceipt(result.transaction.id))
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  const status = (
    <>
      {feedback && (
        <Alert variant={feedback.variant} requestId={feedback.requestId}>
          {feedback.message}
        </Alert>
      )}
    </>
  )

  if (visit.status === 'SELESAI') {
    return (
      <Card title="Pembayaran">
        <div className="space-y-4">
          {status}
          <p className="text-sm text-slate-600">Transaksi sudah selesai dan lunas. Nota bisa dicetak ulang kapan saja (juga dari menu Riwayat).</p>
          <Button size="lg" variant="success" className="w-full" loading={busy === 'receipt'} onClick={printReceipt}>
            <Printer aria-hidden="true" className="h-4 w-4" /> Cetak Ulang Nota PDF
          </Button>
        </div>
      </Card>
    )
  }

  if (visit.status === 'DIBATALKAN') {
    return (
      <Card title="Pembayaran">
        <p className="text-sm text-slate-600">Kunjungan ini dibatalkan. Uang yang sudah dibayar tidak dikembalikan; perbaikan data lewat koreksi di Riwayat.</p>
      </Card>
    )
  }

  return (
    <Card title="Pembayaran">
      <div className="space-y-4">
        {status}

        <form noValidate className="space-y-4" onSubmit={pay}>
          <SegmentedControl
            label="Metode pembayaran"
            tone="brand"
            className="w-full [&>button]:flex-1"
            options={METHOD_OPTIONS}
            value={method}
            onChange={(next) => {
              setMethod(next)
              setErrors({})
            }}
          />
          <Input
            label={cash ? 'Uang Diterima (Rp)' : 'Nominal Diterima (Rp)'}
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            placeholder={balance.due > 0 ? String(balance.due) : 'Nominal DP'}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={errors.amount}
            hint={value > 0 ? formatRupiah(value) : paymentType === 'DP' ? 'Dicatat sebagai DP reservasi.' : undefined}
            disabled={!canPay}
          />
          {balance.due > 0 && (
            <Button size="sm" variant="ghost" className="-mt-2" onClick={() => setAmount(String(balance.due))}>
              Uang pas ({formatRupiah(balance.due)})
            </Button>
          )}
          {!cash && (
            <Input
              label={referenceRequired ? 'Referensi Transfer/QRIS *' : 'Referensi (opsional)'}
              placeholder="Mis. kode transaksi di mutasi bank"
              maxLength={100}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              error={errors.reference}
              disabled={!canPay}
            />
          )}
          {cash && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3">
              <p className="text-sm text-brand-600">Kembalian Tunai:</p>
              <p className="text-2xl font-bold text-brand-600">{formatRupiah(change)}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={busy === 'pay'} disabled={!canPay || busy !== null}>
            Terima Pembayaran <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Button>
          {!canPay && <p className="-mt-2 text-center text-xs text-slate-500">Tidak ada sisa tagihan yang perlu dibayar.</p>}
        </form>

        <div className="rounded-2xl border border-slate-200 px-5 py-4">
          <p className="text-sm font-semibold text-slate-700">Kelebihan Bayar: {formatRupiah(balance.surplus)}</p>
          {balance.surplus > 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-500">Kembalikan dulu sebelum foto dimulai atau sesi diselesaikan.</p>
              <Select label="Metode pengembalian" options={METHOD_OPTIONS} value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} />
              <Input
                label="Alasan *"
                placeholder="Mis. pindah ke paket lebih murah"
                maxLength={500}
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                error={errors.refund}
              />
              <Button variant="danger" className="w-full" loading={busy === 'refund'} disabled={busy !== null} onClick={refund}>
                Kembalikan {formatRupiah(balance.surplus)}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Otomatis dihitung jika pelanggan pindah ke paket yang lebih murah.</p>
          )}
        </div>

        <div>
          <Button
            size="lg"
            variant={blocker ? 'neutral' : 'success'}
            className="w-full"
            loading={busy === 'finish'}
            disabled={!!blocker || busy !== null}
            onClick={finish}
          >
            Selesaikan &amp; Cetak Nota PDF
          </Button>
          {blocker && <p className="mt-2 text-center text-xs text-slate-500">{blocker}</p>}
        </div>
      </div>
    </Card>
  )
}
