import { useState } from 'react'
import { CheckCircle2, UserPlus } from 'lucide-react'
import PackageFields from '@/modules/antrean/components/PackageFields'
import { useDayVisits } from '@/modules/antrean/useQueueData'
import {
  EMPTY_SELECTION,
  interpretSaveError,
  newRequestIds,
  selectionPayload,
  validateSelection,
} from '@/modules/antrean/visitForm'
import { Alert, Button, Card, Input } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { registerWalkIn } from '../api'
import {
  EMPTY_PAYMENT,
  addonOptionsFor,
  billPreview,
  cashError,
  chosenAddons,
  paymentPayload,
  sessionMinutes,
  successInfo,
} from '../cashier'
import AddonPicker from './AddonPicker'
import BillSummary from './BillSummary'
import PackageSummary from './PackageSummary'
import PaymentFields from './PaymentFields'
import RegistrationSuccess from './RegistrationSuccess'

const EMPTY_FORM = { customer_name: '', ...EMPTY_SELECTION, addons: {}, payment: EMPTY_PAYMENT }

// Tab "Di Tempat" (Admin): pelanggan di studio → pilih paket & tambahan → bayar lunas → masuk antrean.
// Setelah berhasil muncul pop-up (nomor antrean + Cetak Nota).
export default function WalkInForm({ catalog }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  // Satu request ID per pengisian; dipakai ulang bila simpan diulang setelah gagal.
  const [requestIds, setRequestIds] = useState(newRequestIds)
  const { data: queueData, reload: reloadQueue } = useDayVisits(todayWib())

  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const addonOptions = addonOptionsFor(catalog, pkg)
  const chosen = chosenAddons(addonOptions, form.addons)
  const background = catalog.backgrounds.find((item) => String(item.id) === String(form.background_id)) ?? null
  const bill = billPreview(pkg, form.persons, chosen)
  const total = bill?.total ?? 0

  // Dicek langsung saat diketik (tanpa menunggu Konfirmasi): jumlah orang. Uang tunai dicek di PaymentFields.
  const liveErrors = {}
  if (pkg && form.persons !== '') {
    const personsError = validateSelection(catalog, form, { required: true }).persons
    if (personsError) liveErrors.persons = personsError
  }
  const shownErrors = { ...errors, ...liveErrors }

  function update(next) {
    setForm(next)
    setErrors({})
    setAlert(null)
  }

  function changeSelection(next) {
    // Paket berganti → tambahan lama tidak berlaku.
    const addons = next.package_id === form.package_id ? form.addons : {}
    update({ ...form, ...next, addons })
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateSelection(catalog, form, { required: true })
    if (!form.customer_name.trim()) nextErrors.customer_name = 'Isi nama panggilan.'
    const amountError = bill ? cashError(form.payment, total, { required: true }) : null
    if (amountError) nextErrors.amount = amountError
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      const result = await registerWalkIn({
        client_request_id: requestIds.visit,
        customer_name: form.customer_name.trim(),
        ...selectionPayload(form),
        addons: chosen.map(({ addon, qty }) => ({ addon_id: addon.id, qty })),
        ...(total > 0 && { payment: paymentPayload(form.payment, total, requestIds.payment) }),
      })
      setRequestIds(newRequestIds())
      setForm(EMPTY_FORM)
      reloadQueue()
      setDone(successInfo(result))
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
    <>
      <form noValidate onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Pelanggan">
          <div className="space-y-4">
            <Input
              label="Nama panggilan *"
              placeholder="Contoh: Bayu"
              maxLength={100}
              autoComplete="off"
              autoFocus
              value={form.customer_name}
              onChange={(event) => update({ ...form, customer_name: event.target.value })}
              error={shownErrors.customer_name}
            />
            <PackageFields catalog={catalog} value={form} onChange={changeSelection} errors={shownErrors} />
            <AddonPicker addons={addonOptions} value={form.addons} onChange={(addons) => update({ ...form, addons })} disabled={saving} />
            <PackageSummary pkg={pkg} background={background} minutes={sessionMinutes(pkg, chosen)} data={queueData} />
          </div>
        </Card>

        <Card title="Pembayaran">
          <div className="space-y-4">
            {alert && (
              <Alert variant="error" requestId={alert.requestId}>
                {alert.message}
              </Alert>
            )}
            <BillSummary bill={bill} />
            <PaymentFields due={total} value={form.payment} onChange={(payment) => update({ ...form, payment })} errors={shownErrors} />
            <Button type="submit" size="lg" className="w-full" loading={saving}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Konfirmasi &amp; Masuk Antrean
            </Button>
          </div>
        </Card>
      </form>

      {done && (
        <RegistrationSuccess
          key={done.transactionId}
          info={done}
          onClose={() => setDone(null)}
          closeLabel="Pendaftaran Baru"
          closeIcon={UserPlus}
        />
      )}
    </>
  )
}
