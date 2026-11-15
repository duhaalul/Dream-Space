import { useState } from 'react'
import { ArrowRight, Plus, X } from 'lucide-react'
import { Alert, Button, Card, Input, Select } from '@/shared/components/ui'
import { CUSTOMER_TYPES, PAYMENT_METHOD_LABELS } from '@/shared/utils/constants'
import { formatDateTime, formatRupiah, todayWib } from '@/shared/utils/format'
import { createVisit } from '../api'
import {
  EMPTY_SELECTION,
  availableSlots,
  estimateTotal,
  interpretSaveError,
  newRequestIds,
  selectionPayload,
  validateSelection,
} from '../visitForm'
import EstimateBox from './EstimateBox'
import PackageFields from './PackageFields'

const EMPTY_FORM = {
  customer_name: '',
  date: '',
  time: '',
  ...EMPTY_SELECTION,
  dp_amount: '',
  dp_method: '',
  dp_reference: '',
}

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))

// Kartu "Reservasi WhatsApp (Booking)" (UC-07): nama panggilan, tanggal & jam janji,
// paket/latar/jumlah orang bila sudah dipilih, dan DP bila ada.
// DP cukup nominal + metode (+ referensi untuk nontunai). Tanpa gambar QRIS,
// nomor rekening, atau unggah bukti transfer.
export default function ReservationForm({ catalog, autoFocus = false }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [withPackage, setWithPackage] = useState(false)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)
  const [requestIds, setRequestIds] = useState(newRequestIds)

  const today = todayWib()
  const slots = availableSlots(form.date, today)
  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const nonCash = form.dp_method !== '' && form.dp_method !== 'TUNAI'

  function change(next) {
    setForm(next)
    setErrors({})
    setSuccess(null)
  }

  function togglePackage(show) {
    setWithPackage(show)
    if (!show) change({ ...form, ...EMPTY_SELECTION })
  }

  function validate() {
    const nextErrors = validateSelection(catalog, form, { required: false })
    if (!form.customer_name.trim()) nextErrors.customer_name = 'Isi nama panggilan pelanggan.'

    if (!form.date) nextErrors.date = 'Pilih tanggal janji.'
    else if (form.date < today) nextErrors.date = 'Tanggal janji tidak boleh lewat.'
    if (!form.time) nextErrors.time = 'Pilih jam janji.'
    else if (form.date && !slots.includes(form.time)) nextErrors.time = 'Jam janji sudah lewat. Pilih jam lain.'

    const hasDp = form.dp_amount !== '' || form.dp_method !== ''
    if (hasDp) {
      const amount = Number(form.dp_amount)
      if (form.dp_amount === '' || !Number.isInteger(amount) || amount < 1) {
        nextErrors.amount = 'Isi nominal DP (angka bulat), atau kosongkan metode bila tidak ada DP.'
      } else if (amount > 1_000_000_000_000) {
        nextErrors.amount = 'Nominal DP terlalu besar.'
      }
      if (!form.dp_method) nextErrors.method = 'Pilih metode DP.'
      if (nonCash && !form.dp_reference.trim()) {
        nextErrors.reference = 'DP Transfer/QRIS wajib mencantumkan referensi.'
      }
      // Transfer/QRIS tidak boleh melebihi tagihan bila paket sudah dipilih (backend: EXCESS_NONCASH).
      const estimate = estimateTotal(pkg, form.persons)
      if (!nextErrors.amount && nonCash && estimate && amount > estimate.total) {
        nextErrors.amount = `DP Transfer/QRIS tidak boleh melebihi tagihan paket (${formatRupiah(estimate.total)}).`
      }
    }
    return nextErrors
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setAlert(null)
    setSuccess(null)
    if (Object.keys(nextErrors).length) return

    const hasDp = form.dp_amount !== ''
    setSaving(true)
    try {
      const result = await createVisit({
        client_request_id: requestIds.visit,
        customer_name: form.customer_name.trim(),
        customer_type: CUSTOMER_TYPES.RESERVASI,
        appointment_at: `${form.date} ${form.time}:00`,
        ...selectionPayload(form),
        ...(hasDp && {
          payment: {
            client_request_id: requestIds.payment,
            payment_type: 'DP',
            method: form.dp_method,
            amount: Number(form.dp_amount),
            reference: nonCash ? form.dp_reference.trim() : null,
          },
        }),
      })
      setRequestIds(newRequestIds())
      setForm(EMPTY_FORM)
      setWithPackage(false)
      const dpText = hasDp
        ? ` · DP ${formatRupiah(result.balance.paid)} (${PAYMENT_METHOD_LABELS[form.dp_method]})`
        : ''
      setSuccess(
        `Reservasi ${result.visit.customer_name} tersimpan untuk ${formatDateTime(result.visit.appointment_at)} WIB${dpText}.`,
      )
    } catch (error) {
      const outcome = interpretSaveError(error)
      setErrors(outcome.fields)
      setAlert(outcome.alert)
      if (outcome.resetRequest) setRequestIds(newRequestIds())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Reservasi WhatsApp (Booking)" description="Catat jadwal janji dan DP bila ada">
      <form noValidate className="space-y-4" onSubmit={submit}>
        {success && <Alert variant="success">{success}</Alert>}
        {alert && (
          <Alert variant="error" requestId={alert.requestId}>
            {alert.message}
          </Alert>
        )}

        <Input
          label="Nama Panggilan Pelanggan *"
          placeholder="Contoh: Citra"
          autoFocus={autoFocus}
          maxLength={100}
          autoComplete="off"
          value={form.customer_name}
          onChange={(event) => change({ ...form, customer_name: event.target.value })}
          error={errors.customer_name}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tanggal Janji *"
            type="date"
            min={today}
            value={form.date}
            onChange={(event) => {
              const date = event.target.value
              // Jam yang sudah lewat untuk tanggal baru dikosongkan.
              const time = availableSlots(date, today).includes(form.time) ? form.time : ''
              change({ ...form, date, time })
            }}
            error={errors.date}
          />
          <Select
            label="Jam Janji *"
            placeholder={slots.length ? 'Pilih jam' : 'Tidak ada jam tersisa hari ini'}
            options={slots.map((slot) => ({ value: slot, label: `${slot} WIB` }))}
            value={form.time}
            onChange={(event) => change({ ...form, time: event.target.value })}
            error={errors.time}
          />
        </div>

        {withPackage ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Paket (opsional)</p>
              <Button variant="ghost" size="sm" onClick={() => togglePackage(false)}>
                <X aria-hidden="true" className="h-3.5 w-3.5" /> Kosongkan paket
              </Button>
            </div>
            <PackageFields catalog={catalog} value={form} onChange={change} errors={errors} optional />
            {pkg && <EstimateBox pkg={pkg} persons={form.persons} />}
          </div>
        ) : (
          <Button variant="soft" size="sm" onClick={() => togglePackage(true)}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Pilih paket sekarang (opsional)
          </Button>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nominal DP (Rp)"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            placeholder="Kosongkan bila tanpa DP"
            value={form.dp_amount}
            onChange={(event) => change({ ...form, dp_amount: event.target.value })}
            error={errors.amount}
            hint={Number(form.dp_amount) > 0 ? formatRupiah(form.dp_amount) : undefined}
          />
          <Select
            label="Metode DP"
            placeholder="Tanpa DP"
            options={METHOD_OPTIONS}
            value={form.dp_method}
            onChange={(event) => change({ ...form, dp_method: event.target.value, dp_reference: '' })}
            error={errors.method}
          />
        </div>

        {nonCash && (
          <Input
            label="Referensi Transfer/QRIS *"
            placeholder="Contoh: kode transaksi di mutasi bank"
            maxLength={100}
            autoComplete="off"
            value={form.dp_reference}
            onChange={(event) => change({ ...form, dp_reference: event.target.value })}
            error={errors.reference}
            hint="Wajib untuk DP nontunai dan tidak boleh sama dengan pembayaran lain."
          />
        )}

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          Simpan &amp; Jadwalkan Reservasi <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
