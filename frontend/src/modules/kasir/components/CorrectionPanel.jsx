import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { queueLabel } from '@/modules/antrean/queue'
import { Alert, Button, Card, Input, Select } from '@/shared/components/ui'
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'
import { addCorrection, getCashierDetail } from '../api'
import { cashierError, paymentCorrection } from '../cashier'

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))
const EMPTY = { field: '', name: '', method: '', reference: '', reason: '' }

// Panel "Koreksi Data Transaksi" (desain 06, Admin saja). Yang bisa dikoreksi di sini:
// nama pelanggan dan metode/referensi pembayaran. Nominal & harga tidak diubah di sini
// karena bisa membuat saldo transaksi tidak pas. Setiap koreksi wajib alasan dan tercatat di audit.
export default function CorrectionPanel({ rows, onCorrected }) {
  const [visitId, setVisitId] = useState('')
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  async function choose(id) {
    setVisitId(id)
    setDetail(null)
    setForm(EMPTY)
    setErrors({})
    setFeedback(null)
    if (!id) return
    try {
      setDetail(await getCashierDetail(id))
    } catch (error) {
      setFeedback(cashierError(error))
    }
  }

  const payment = form.field.startsWith('pay-') ? detail?.payments.find((item) => `pay-${item.id}` === form.field) : null
  const fieldOptions = detail
    ? [
        { value: 'name', label: `Nama pelanggan (${detail.visit.customer_name})` },
        ...detail.payments.map((item) => ({
          value: `pay-${item.id}`,
          label: `Metode bayar · ${PAYMENT_TYPE_LABELS[item.payment_type]} ${formatRupiah(item.amount)} (${PAYMENT_METHOD_LABELS[item.method]})`,
        })),
      ]
    : []

  function chooseField(field) {
    const target = detail.payments.find((item) => `pay-${item.id}` === field)
    setForm({ ...EMPTY, field, reason: form.reason, name: detail.visit.customer_name, method: target?.method ?? '', reference: target?.reference ?? '' })
    setErrors({})
    setFeedback(null)
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!form.field) nextErrors.field = 'Pilih data yang dikoreksi.'
    if (form.field === 'name' && !form.name.trim()) nextErrors.name = 'Isi nama yang benar.'
    if (form.field === 'name' && form.name.trim() === detail.visit.customer_name) nextErrors.name = 'Nama belum diubah.'
    if (payment) {
      const nonCash = form.method !== 'TUNAI'
      if (form.method === payment.method && (form.reference.trim() || null) === (payment.reference ?? null)) nextErrors.method = 'Metode/referensi belum diubah.'
      if (nonCash && payment.payment_type === 'DP' && !form.reference.trim()) nextErrors.reference = 'DP nontunai wajib mencantumkan referensi.'
    }
    if (form.reason.trim().length < 3) nextErrors.reason = 'Alasan koreksi wajib diisi, minimal 3 karakter.'
    setErrors(nextErrors)
    setFeedback(null)
    if (Object.keys(nextErrors).length) return

    const body = { version: detail.transaction.version, reason: form.reason.trim() }
    if (form.field === 'name') body.customer_name = form.name.trim()
    else body.payments = [paymentCorrection(payment, form.method, form.reference)]

    setSaving(true)
    try {
      const result = await addCorrection(detail.transaction.id, body)
      setDetail(result)
      setForm(EMPTY)
      setFeedback({ variant: 'success', message: 'Koreksi tersimpan dan tercatat di log audit.' })
      onCorrected()
    } catch (error) {
      const outcome = cashierError(error)
      setFeedback(outcome)
      if (outcome.reload) {
        try {
          setDetail(await getCashierDetail(visitId))
        } catch {
          /* pesan error di atas sudah cukup */
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Koreksi Data Transaksi" description="Koreksi kesalahan input data untuk transaksi selesai/dibatalkan">
      <form noValidate onSubmit={submit} className="space-y-4">
        {feedback && (
          <Alert variant={feedback.variant} requestId={feedback.requestId}>
            {feedback.message}
          </Alert>
        )}
        <Select
          label="Pilih Transaksi"
          placeholder={rows.length ? 'Pilih transaksi' : 'Belum ada transaksi di periode ini'}
          options={rows.map((row) => ({
            value: String(row.id),
            label: `${queueLabel(row) ?? row.transaction_no} · ${row.customer_name} (${formatRupiah(row.total)})`,
          }))}
          value={visitId}
          onChange={(event) => choose(event.target.value)}
        />
        {detail && (
          <Select
            label="Data yang Dikoreksi"
            placeholder="Pilih data"
            options={fieldOptions}
            value={form.field}
            onChange={(event) => chooseField(event.target.value)}
            error={errors.field}
          />
        )}
        {form.field === 'name' && (
          <Input label="Nama yang benar *" maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name} />
        )}
        {payment && (
          <>
            <Select
              label="Metode yang benar *"
              options={METHOD_OPTIONS}
              value={form.method}
              onChange={(event) => setForm({ ...form, method: event.target.value })}
              error={errors.method}
            />
            {form.method !== 'TUNAI' && (
              <Input
                label={payment.payment_type === 'DP' ? 'Referensi *' : 'Referensi (opsional)'}
                maxLength={100}
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                error={errors.reference}
              />
            )}
            <p className="text-xs text-slate-500">Nominal {formatRupiah(payment.amount)} dan waktu penerimaan tidak berubah.</p>
          </>
        )}
        {detail && (
          <Input
            label="Alasan Koreksi (wajib diisi) *"
            placeholder="Mis. salah pilih metode pembayaran di kasir"
            maxLength={500}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            error={errors.reason}
          />
        )}
        <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!detail}>
          Simpan Koreksi &amp; Catat Log <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
