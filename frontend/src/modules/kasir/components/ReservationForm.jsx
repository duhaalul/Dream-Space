import { useState } from 'react'
import { BadgeCheck, CalendarCheck, CalendarPlus, Printer, Wallet } from 'lucide-react'
import { EMPTY_SELECTION, interpretSaveError, newRequestIds } from '@/modules/antrean/visitForm'
import { Alert, Button, Card, Input, Modal, SegmentedControl, Select } from '@/shared/components/ui'
import { openBlob } from '@/shared/utils/download'
import { formatDate, formatRupiah } from '@/shared/utils/format'
import { downloadReceipt, registerReservation } from '../api'
import { RESERVATION_METHODS, addonOptionsFor, billPreview, chosenAddons, methodLabel } from '../cashier'
import { liveReservationErrors, reservationPayload, validateReservation } from '../reservation'
import { useReservationTime } from '../useReservationSlots'
import BillSummary, { SummaryRow } from './BillSummary'
import ReservationFields from './ReservationFields'

const EMPTY_FORM = {
  customer_name: '',
  phone: '',
  date: '',
  time: '',
  ...EMPTY_SELECTION,
  addons: {},
  pay: 'DP',
  method: 'TRANSFER',
  amount: '',
  reference: '',
}

// Pop-up setelah reservasi tersimpan: jadwal, paket, DP/Lunas; Cetak Nota hanya bila sudah lunas.
function ReservationSaved({ detail, onClose }) {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState(null)
  const { visit, transaction, balance, payments } = detail
  const paid = transaction.payment_status === 'LUNAS'
  const pkgName = detail.items.find((item) => item.item_type === 'PAKET' && Number(item.is_active) === 1)?.description
  const method = methodLabel(payments[0]?.method)

  async function print() {
    setPrinting(true)
    setError(null)
    try {
      openBlob(await downloadReceipt(transaction.id))
    } catch (err) {
      setError(err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Modal
      open
      title="Reservasi Tersimpan"
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            <CalendarPlus aria-hidden="true" className="h-4 w-4" /> Reservasi Baru
          </Button>
          {paid && (
            <Button variant="success" loading={printing} onClick={print}>
              {!printing && <Printer aria-hidden="true" className="h-4 w-4" />} Cetak Nota
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <CalendarCheck aria-hidden="true" className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-2 text-lg font-semibold text-slate-800">{visit.customer_name}</p>
          <p className="text-3xl font-black tracking-tight text-brand-600">{visit.appointment_at.slice(11, 16).replace(':', '.')}</p>
          <p className="text-sm text-slate-500">{formatDate(visit.appointment_at)}</p>
        </div>
        <div className="space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3">
          <SummaryRow label="Paket" value={pkgName ?? 'Belum dipilih'} />
          <SummaryRow strong label={`${paid ? 'Lunas' : 'DP'} · ${method}`} value={formatRupiah(balance.paid)} />
          {!paid && pkgName && <SummaryRow label="Sisa saat datang" value={formatRupiah(balance.due)} />}
        </div>
        {error && (
          <Alert variant="error" requestId={error.requestId}>
            Nota gagal dibuka. {error.message}
          </Alert>
        )}
      </div>
    </Modal>
  )
}

// Tab "Reservasi" (pesanan lewat WhatsApp): paket (wajib), tambahan, tanggal & jam,
// lalu bayar DP (nominal diketik Admin) atau Lunas (otomatis = total) lewat Transfer/QRIS.
// Pilihan jam dari backend: hanya jam yang belum lewat dan tidak bentrok dengan reservasi lain di paket yang sama
// (lama pemakaian = durasi paket + tambah waktu). Nomor antrean diberikan saat pelanggan datang.
export default function ReservationForm({ catalog }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [requestIds, setRequestIds] = useState(newRequestIds)
  const [slotsRefresh, setSlotsRefresh] = useState(0)

  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const chosen = chosenAddons(addonOptionsFor(catalog, pkg), form.addons)
  const time = useReservationTime({ form, pkg, chosen, refresh: slotsRefresh })
  const bill = billPreview(pkg, form.persons, chosen)
  const total = bill?.total ?? 0
  const lunas = form.pay === 'LUNAS'
  const dp = Number(form.amount)
  const dpValid = form.amount !== '' && Number.isInteger(dp) && dp > 0

  // Dicek langsung saat diketik: jumlah orang, No. WhatsApp, jam bentrok, nominal DP.
  const liveErrors = liveReservationErrors(catalog, form, pkg, time)
  if (!lunas && form.amount !== '') {
    if (!dpValid) liveErrors.amount = 'Isi angka bulat.'
    else if (bill && dp >= total) liveErrors.amount = `DP harus kurang dari total ${formatRupiah(total)}. Pilih Lunas.`
  }
  const shownErrors = { ...errors, ...liveErrors }

  function update(next) {
    setForm(next)
    setErrors({})
    setAlert(null)
  }

  function changeSelection(next) {
    const addons = next.package_id === form.package_id ? form.addons : {}
    // Tanpa paket tidak bisa lunas → kembali ke DP.
    const pay = next.package_id ? form.pay : 'DP'
    update({ ...form, ...next, addons, pay })
  }

  function validate() {
    const nextErrors = validateReservation(catalog, form, time)
    if (lunas) {
      if (!bill || total <= 0) nextErrors.package_id = 'Pilih paket untuk bayar lunas.'
    } else if (!dpValid) {
      nextErrors.amount = 'Isi nominal DP.'
    } else if (bill && dp >= total) {
      nextErrors.amount = `DP harus kurang dari total ${formatRupiah(total)}. Pilih Lunas.`
    }
    return nextErrors
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      const result = await registerReservation({
        client_request_id: requestIds.visit,
        ...reservationPayload(form, chosen),
        payment: {
          client_request_id: requestIds.payment,
          type: form.pay,
          method: form.method,
          amount: lunas ? total : dp,
          reference: form.method === 'TRANSFER' ? form.reference.trim() || null : null,
        },
      })
      setRequestIds(newRequestIds())
      setForm(EMPTY_FORM)
      setSaved(result)
      setSlotsRefresh((value) => value + 1) // jam yang baru dipesan tidak lagi bisa dipilih
    } catch (error) {
      const outcome = interpretSaveError(error)
      setErrors(outcome.fields)
      setAlert(outcome.alert)
      if (outcome.resetRequest) setRequestIds(newRequestIds())
    } finally {
      setSaving(false)
    }
  }

  const payOptions = [
    { value: 'DP', label: 'DP', icon: Wallet },
    { value: 'LUNAS', label: 'Lunas', icon: BadgeCheck, disabled: !pkg, title: pkg ? undefined : 'Pilih paket dulu' },
  ]

  return (
    <>
      <form noValidate onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Pelanggan">
          <ReservationFields
            catalog={catalog}
            form={form}
            onChange={update}
            onSelection={changeSelection}
            errors={shownErrors}
            time={time}
            disabled={saving}
          />
        </Card>

        <Card title="Pembayaran">
          <div className="space-y-4">
            {alert && (
              <Alert variant="error" requestId={alert.requestId}>
                {alert.message}
              </Alert>
            )}
            <BillSummary bill={bill} />
            <div>
              <p className="mb-1.5 text-sm text-slate-500">Bayar</p>
              <SegmentedControl
                label="Bayar"
                tone="brand"
                options={payOptions}
                value={form.pay}
                onChange={(pay) => update({ ...form, pay })}
              />
            </div>
            <Select
              label="Metode"
              options={RESERVATION_METHODS}
              value={form.method}
              onChange={(event) => update({ ...form, method: event.target.value, reference: '' })}
            />
            {lunas ? (
              <Input label="Nominal" value={formatRupiah(total)} readOnly tabIndex={-1} error={shownErrors.amount} />
            ) : (
              <Input
                label="Nominal DP (Rp) *"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Contoh: 50000"
                value={form.amount}
                onChange={(event) => update({ ...form, amount: event.target.value })}
                error={shownErrors.amount}
                hint={dp > 0 ? formatRupiah(dp) : undefined}
              />
            )}
            {form.method === 'TRANSFER' && (
              <Input
                label="Referensi (opsional)"
                maxLength={100}
                autoComplete="off"
                value={form.reference}
                onChange={(event) => update({ ...form, reference: event.target.value })}
                error={shownErrors.reference}
              />
            )}
            {!lunas && bill && dpValid && dp < total && <SummaryRow strong label="Sisa saat datang" value={formatRupiah(total - dp)} />}
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              <CalendarCheck aria-hidden="true" className="h-4 w-4" /> Simpan Reservasi
            </Button>
          </div>
        </Card>
      </form>

      {saved && <ReservationSaved key={saved.visit.id} detail={saved} onClose={() => setSaved(null)} />}
    </>
  )
}
