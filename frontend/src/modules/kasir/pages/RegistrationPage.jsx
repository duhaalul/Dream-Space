import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Printer, UserPlus } from 'lucide-react'
import PackageFields from '@/modules/antrean/components/PackageFields'
import { formatQueueNumber } from '@/modules/antrean/queue'
import { useDayVisits } from '@/modules/antrean/useQueueData'
import {
  EMPTY_SELECTION,
  interpretSaveError,
  newRequestIds,
  selectionPayload,
  validateSelection,
} from '@/modules/antrean/visitForm'
import { getAddons, getPackages } from '@/modules/paket/api'
import { Alert, Button, Card, Input, Modal, PageHeader, Select } from '@/shared/components/ui'
import { openBlob } from '@/shared/utils/download'
import { formatRupiah, todayWib } from '@/shared/utils/format'
import { downloadReceipt, registerWalkIn } from '../api'
import { PAYMENT_METHODS, billPreview, methodLabel, totalChange } from '../cashier'
import AddonPicker from '../components/AddonPicker'
import PackageSummary from '../components/PackageSummary'

const EMPTY_FORM = { customer_name: '', ...EMPTY_SELECTION, addons: {}, method: 'TUNAI', amount: '', reference: '' }

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'text-base font-bold text-slate-800' : 'text-sm text-slate-600'}`}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  )
}

// Pop-up setelah pendaftaran berhasil: nomor antrean untuk disebutkan ke pelanggan, kembalian, dan cetak nota.
function SuccessModal({ done, onClose }) {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState(null)

  async function print() {
    setPrinting(true)
    setError(null)
    try {
      openBlob(await downloadReceipt(done.transactionId))
    } catch (err) {
      setError(err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Modal
      open
      title="Berhasil"
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose}>
            <UserPlus aria-hidden="true" className="h-4 w-4" /> Pendaftaran Baru
          </Button>
          <Button variant="success" loading={printing} onClick={print}>
            {!printing && <Printer aria-hidden="true" className="h-4 w-4" />} Cetak Nota
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-2 text-5xl font-black tracking-tight text-brand-600">{done.queue}</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{done.name}</p>
        </div>
        <div className="space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3">
          <Row label={`Lunas · ${methodLabel(done.method)}`} value={formatRupiah(done.total)} />
          {done.method === 'TUNAI' && <Row strong label="Kembalian" value={formatRupiah(done.change)} />}
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

// T-04/T-05 Pendaftaran (Admin): pelanggan datang langsung → pilih paket & tambahan → bayar lunas →
// masuk antrean. Setelah berhasil muncul pop-up (nomor antrean + Cetak Nota).
export default function RegistrationPage() {
  const [catalog, setCatalog] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null) // { queue, name, total, method, change, transactionId }
  // Satu request ID per pengisian; dipakai ulang bila simpan diulang setelah gagal (NFR-02).
  const [requestIds, setRequestIds] = useState(newRequestIds)
  const { data: queueData, reload: reloadQueue } = useDayVisits(todayWib())

  const loadCatalog = useCallback(
    () =>
      Promise.all([getPackages(), getAddons()])
        .then(([packages, addons]) => {
          setLoadError(null)
          setCatalog({
            packages: packages?.packages ?? [],
            backgrounds: packages?.backgrounds ?? [],
            allowedAddons: packages?.allowed_addons ?? [],
            addons: addons ?? [],
          })
        })
        .catch(setLoadError),
    [],
  )

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  if (loadError) {
    return (
      <>
        <PageHeader title="Pendaftaran" code="T-04" />
        <Alert variant="error" requestId={loadError.requestId}>
          Daftar paket gagal dimuat. {loadError.message}
        </Alert>
      </>
    )
  }
  if (!catalog) {
    return (
      <>
        <PageHeader title="Pendaftaran" code="T-04" />
        <p className="text-sm text-slate-500">Memuat…</p>
      </>
    )
  }

  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const allowedIds = new Set(catalog.allowedAddons.filter((row) => row.package_id === pkg?.id).map((row) => row.addon_id))
  const addonOptions = catalog.addons.filter((addon) => allowedIds.has(addon.id) && Number(addon.is_active) === 1)
  const chosenAddons = addonOptions.filter((addon) => (form.addons[addon.id] ?? 0) > 0).map((addon) => ({ addon, qty: form.addons[addon.id] }))
  const background = catalog.backgrounds.find((item) => String(item.id) === String(form.background_id)) ?? null
  // Durasi sesi = durasi paket + tambah waktu (sama dengan hitungan backend saat Mulai Foto).
  const minutes = pkg?.duration_minutes
    ? Number(pkg.duration_minutes) + chosenAddons.reduce((sum, { addon, qty }) => sum + (Number(addon.extra_minutes) || 0) * qty, 0)
    : null
  const bill = billPreview(pkg, form.persons, chosenAddons)
  const total = bill?.total ?? 0
  const cash = form.method === 'TUNAI'
  const amount = cash ? Number(form.amount) : total
  const change = cash && amount > total ? amount - total : 0

  // Dicek langsung saat diketik (tanpa menunggu Konfirmasi): jumlah orang & uang tunai.
  const liveErrors = {}
  if (pkg && form.persons !== '') {
    const personsError = validateSelection(catalog, form, { required: true }).persons
    if (personsError) liveErrors.persons = personsError
  }
  if (bill && total > 0 && cash && form.amount !== '') {
    if (!Number.isInteger(amount) || amount < 0) liveErrors.amount = 'Isi angka bulat.'
    else if (amount < total) liveErrors.amount = `Kurang ${formatRupiah(total - amount)}.`
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
    if (bill && total > 0 && cash && (!Number.isInteger(amount) || amount < total)) {
      nextErrors.amount = `Uang diterima minimal ${formatRupiah(total)}.`
    }
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      const result = await registerWalkIn({
        client_request_id: requestIds.visit,
        customer_name: form.customer_name.trim(),
        ...selectionPayload(form),
        addons: chosenAddons.map(({ addon, qty }) => ({ addon_id: addon.id, qty })),
        ...(total > 0 && {
          payment: {
            client_request_id: requestIds.payment,
            method: form.method,
            amount,
            reference: form.method === 'TRANSFER' ? form.reference.trim() || null : null,
          },
        }),
      })
      setRequestIds(newRequestIds())
      setForm(EMPTY_FORM)
      reloadQueue()
      setDone({
        queue: formatQueueNumber(result.visit.queue_code_snapshot, result.visit.queue_number),
        name: result.visit.customer_name,
        total: result.transaction.total,
        method: result.payments[0]?.method ?? form.method,
        change: totalChange(result),
        transactionId: result.transaction.id,
      })
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
      <PageHeader title="Pendaftaran" code="T-04" />

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
            <PackageSummary pkg={pkg} background={background} minutes={minutes} data={queueData} />
          </div>
        </Card>

        <Card title="Pembayaran">
          <div className="space-y-4">
            {alert && (
              <Alert variant="error" requestId={alert.requestId}>
                {alert.message}
              </Alert>
            )}

            <div className="space-y-1.5">
              {bill ? bill.lines.map((line) => <Row key={line.key} label={line.label} value={formatRupiah(line.amount)} />) : <Row label="Pilih paket" value="—" />}
              <div className="border-t border-slate-100 pt-2">
                <Row strong label="Total" value={formatRupiah(total)} />
              </div>
            </div>

            <Select
              label="Metode"
              options={PAYMENT_METHODS}
              value={form.method}
              onChange={(event) => update({ ...form, method: event.target.value, reference: '' })}
            />
            {cash ? (
              <Input
                label="Uang diterima *"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder={total ? String(total) : '0'}
                value={form.amount}
                onChange={(event) => update({ ...form, amount: event.target.value })}
                error={shownErrors.amount}
                hint={Number(form.amount) > 0 ? formatRupiah(form.amount) : undefined}
              />
            ) : (
              <Input label="Nominal" value={formatRupiah(total)} readOnly tabIndex={-1} error={shownErrors.amount} />
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
            <Row strong label="Kembalian" value={formatRupiah(change)} />

            <Button type="submit" size="lg" className="w-full" loading={saving}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Konfirmasi &amp; Masuk Antrean
            </Button>
          </div>
        </Card>
      </form>

      {done && <SuccessModal key={done.transactionId} done={done} onClose={() => setDone(null)} />}
    </>
  )
}
