import { useEffect, useState } from 'react'
import { Clock, ListPlus, Package, X } from 'lucide-react'
import { checkInReservation } from '@/modules/kasir/api'
import {
  EMPTY_PAYMENT,
  activeItems,
  addonOptionsFor,
  billFromDetail,
  billPreview,
  cashError,
  chosenAddons,
  paymentPayload,
  sessionMinutes,
  successInfo,
} from '@/modules/kasir/cashier'
import AddonPicker from '@/modules/kasir/components/AddonPicker'
import BillSummary from '@/modules/kasir/components/BillSummary'
import PackageSummary, { Chip } from '@/modules/kasir/components/PackageSummary'
import PaymentFields from '@/modules/kasir/components/PaymentFields'
import RegistrationSuccess from '@/modules/kasir/components/RegistrationSuccess'
import { useCatalog } from '@/modules/kasir/useCatalog'
import { Alert, Badge, Button, Modal } from '@/shared/components/ui'
import { formatRupiah, formatTime } from '@/shared/utils/format'
import { newRequestId } from '@/shared/utils/requestId'
import { getVisit } from '../api'
import { EMPTY_SELECTION, interpretSaveError, selectionPayload, validateSelection } from '../visitForm'
import PackageFields from './PackageFields'

// Pop-up "Sudah Datang" (Antrean › Reservasi, Admin, hanya pada tanggal reservasi).
// Data reservasi tampil sebagai chip; yang diisi hanya yang kurang:
// - belum pilih paket (data lama) → Paket, Latar, Jumlah Orang, Tambahan;
// - sudah berpaket → tambahan boleh DITAMBAH (yang sudah dipesan tidak bisa dikurangi; paket diubah lewat Ubah Reservasi);
// - belum lunas → sisa tagihan dibayar (Tunai/Transfer/QRIS).
// Satu tombol "Masuk Antrean" → backend memilih paket, menerima pembayaran, dan memberi nomor RG-R001
// sekaligus. Lalu pop-up Berhasil (nomor antrean + Cetak Nota). onDone() memuat ulang papan.
export default function CheckInModal({ visitId, onClose, onDone }) {
  const { catalog, error: catalogError } = useCatalog()
  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_SELECTION, addons: {}, payment: EMPTY_PAYMENT })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  // Satu request ID pembayaran per pop-up: klik ulang setelah koneksi putus tidak mencatat dua kali.
  const [paymentId] = useState(newRequestId)

  useEffect(() => {
    getVisit(visitId).then(setDetail).catch(setLoadError)
  }, [visitId])

  if (done) return <RegistrationSuccess info={done} onClose={onClose} closeLabel="Tutup" closeIcon={X} />

  const failure = loadError ?? catalogError
  let body = <p className="text-sm text-slate-500">Memuat…</p>
  let submit = null
  if (failure) {
    body = (
      <Alert variant="error" requestId={failure.requestId}>
        Data reservasi gagal dimuat. {failure.message}
      </Alert>
    )
  } else if (detail && catalog) {
    const { visit, transaction } = detail
    const hasPackage = visit.package_id !== null
    const paid = Number(detail.balance.net)
    const pkg = hasPackage ? null : catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
    const addonOptions = addonOptionsFor(catalog, pkg)
    const chosen = chosenAddons(addonOptions, form.addons)
    const background = catalog.backgrounds.find((item) => String(item.id) === String(form.background_id)) ?? null
    // Reservasi berpaket: tambahan yang sudah dipesan jadi batas minimum; boleh ditambah sebelum masuk Menunggu.
    const bookedItems = activeItems(detail).filter((item) => item.item_type === 'TAMBAHAN')
    const booked = Object.fromEntries(bookedItems.map((item) => [item.addon_id, item.qty]))
    const reservedPkg = hasPackage ? catalog.packages.find((item) => item.id === visit.package_id) ?? null : null
    const extraOptions = addonOptionsFor(catalog, reservedPkg)
    const extraValue = form.addonsEdited ? form.addons : booked
    const extraLines = Object.entries(extraValue)
      .filter(([, qty]) => qty > 0)
      .map(([addonId, qty]) => {
        const old = bookedItems.find((item) => String(item.addon_id) === addonId)
        const option = extraOptions.find((addon) => String(addon.id) === addonId)
        const price = old ? Number(old.unit_price) : Number(option?.price ?? 0)
        return { key: `addon-${addonId}`, label: `${old?.description ?? option?.name} ×${qty}`, amount: price * qty }
      })
    const baseLines = hasPackage ? billFromDetail(detail).lines.filter((line) => !bookedItems.some((item) => item.id === line.key)) : []
    const bill = hasPackage
      ? { lines: [...baseLines, ...extraLines], total: [...baseLines, ...extraLines].reduce((sum, line) => sum + line.amount, 0) }
      : billPreview(pkg, form.persons, chosen)
    const extrasChanged = hasPackage && form.addonsEdited && Object.entries(extraValue).some(([id, qty]) => qty !== (booked[id] ?? 0))
    const due = bill ? Math.max(bill.total - paid, 0) : 0
    const dpTooBig = !hasPackage && bill && paid > bill.total ? `DP ${formatRupiah(paid)} lebih besar dari total ${formatRupiah(bill.total)}.` : null
    const pkgName = detail.items.find((item) => item.item_type === 'PAKET' && Number(item.is_active) === 1)?.description

    const liveErrors = {}
    if (pkg && form.persons !== '') {
      const personsError = validateSelection(catalog, form, { required: true }).persons
      if (personsError) liveErrors.persons = personsError
    }
    if (dpTooBig) liveErrors.package_id = dpTooBig
    const shownErrors = { ...errors, ...liveErrors }

    const update = (next) => {
      setForm(next)
      setErrors({})
      setAlert(null)
    }
    const changeSelection = (next) => update({ ...form, ...next, addons: next.package_id === form.package_id ? form.addons : {} })

    submit = async () => {
      const nextErrors = hasPackage ? {} : validateSelection(catalog, form, { required: true })
      if (dpTooBig) nextErrors.package_id = dpTooBig
      const amountError = bill && due > 0 ? cashError(form.payment, due, { required: true }) : null
      if (amountError) nextErrors.amount = amountError
      setErrors(nextErrors)
      setAlert(null)
      if (Object.keys(nextErrors).length) return

      setSaving(true)
      try {
        const result = await checkInReservation(visit.id, {
          version: visit.version,
          ...(!hasPackage && { ...selectionPayload(form), addons: chosen.map(({ addon, qty }) => ({ addon_id: addon.id, qty })) }),
          ...(extrasChanged && {
            addons: Object.entries(extraValue)
              .filter(([, qty]) => qty > 0)
              .map(([addonId, qty]) => ({ addon_id: Number(addonId), qty })),
          }),
          ...(due > 0 && { payment: paymentPayload(form.payment, due, paymentId) }),
        })
        onDone?.()
        setDone(successInfo(result))
      } catch (error) {
        const outcome = interpretSaveError(error)
        setErrors(outcome.fields)
        setAlert(outcome.alert)
      } finally {
        setSaving(false)
      }
    }

    body = (
      <div className="space-y-5">
        <div>
          <p className="text-lg font-bold text-slate-800">{visit.customer_name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip icon={Clock}>{formatTime(visit.appointment_at)}</Chip>
            <Chip icon={Package}>{pkgName ?? 'Belum pilih paket'}</Chip>
            {transaction.payment_status === 'LUNAS' ? <Badge tone="green">Lunas</Badge> : <Badge tone="amber">Dibayar {formatRupiah(paid)}</Badge>}
          </div>
        </div>
        {alert && (
          <Alert variant="error" requestId={alert.requestId}>
            {alert.message}
          </Alert>
        )}
        {!hasPackage && (
          <div className="space-y-4">
            <PackageFields catalog={catalog} value={form} onChange={changeSelection} errors={shownErrors} />
            <AddonPicker addons={addonOptions} value={form.addons} onChange={(addons) => update({ ...form, addons })} disabled={saving} />
            <PackageSummary pkg={pkg} background={background} minutes={sessionMinutes(pkg, chosen)} />
          </div>
        )}
        {hasPackage && (
          <AddonPicker
            addons={extraOptions}
            value={extraValue}
            min={booked}
            onChange={(addons) => update({ ...form, addons, addonsEdited: true })}
            disabled={saving}
          />
        )}
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <BillSummary bill={bill} paid={paid} />
        </div>
        {bill && due > 0 && (
          <PaymentFields due={due} value={form.payment} onChange={(payment) => update({ ...form, payment })} errors={shownErrors} disabled={saving} />
        )}
      </div>
    )
  }

  return (
    <Modal
      open
      size="lg"
      title="Sudah Datang"
      onClose={onClose}
      footer={
        <Button loading={saving} disabled={!submit} onClick={() => submit?.()}>
          {!saving && <ListPlus aria-hidden="true" className="h-4 w-4" />} Masuk Antrean
        </Button>
      }
    >
      {body}
    </Modal>
  )
}
