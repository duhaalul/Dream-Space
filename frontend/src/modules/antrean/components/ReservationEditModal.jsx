import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { updateReservation } from '@/modules/kasir/api'
import { activeItems, addonOptionsFor, chosenAddons, editBillPreview } from '@/modules/kasir/cashier'
import BillSummary, { SummaryRow } from '@/modules/kasir/components/BillSummary'
import ReservationFields from '@/modules/kasir/components/ReservationFields'
import { liveReservationErrors, reservationPayload, validateReservation } from '@/modules/kasir/reservation'
import { useCatalog } from '@/modules/kasir/useCatalog'
import { useReservationTime } from '@/modules/kasir/useReservationSlots'
import { Alert, Button, Modal, Select } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'
import { newRequestId } from '@/shared/utils/requestId'
import { getVisit } from '../api'
import { interpretSaveError } from '../visitForm'

// Uang dikembalikan lewat Tunai atau Transfer (QRIS hanya untuk menerima).
const REFUND_METHODS = [
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'TUNAI', label: 'Tunai' },
]

function EditForm({ detail, catalog, onClose, onSaved }) {
  const { visit, balance } = detail
  const original = { date: visit.appointment_at.slice(0, 10), time: visit.appointment_at.slice(11, 16) }
  const [form, setForm] = useState(() => ({
    customer_name: visit.customer_name,
    phone: visit.phone ?? '',
    ...original,
    package_id: visit.package_id ? String(visit.package_id) : '',
    background_id: visit.background_id ? String(visit.background_id) : '',
    persons: visit.persons ? String(visit.persons) : '',
    addons: Object.fromEntries(
      activeItems(detail)
        .filter((item) => item.item_type === 'TAMBAHAN')
        .map((item) => [item.addon_id, item.qty]),
    ),
  }))
  const [refundMethod, setRefundMethod] = useState('TRANSFER')
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  // Satu request ID refund per pop-up: klik ulang setelah koneksi putus tidak mengembalikan uang dua kali.
  const [refundId] = useState(newRequestId)

  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const chosen = chosenAddons(addonOptionsFor(catalog, pkg), form.addons)
  const time = useReservationTime({ form, pkg, chosen, visitId: visit.id, original })
  const bill = editBillPreview(detail, pkg, form.persons, chosen)
  const paid = Number(balance.net)
  const total = bill?.total ?? 0
  const excess = bill && paid > total ? paid - total : 0
  const shownErrors = { ...errors, ...liveReservationErrors(catalog, form, pkg, time) }

  function update(next) {
    setForm(next)
    setErrors({})
    setAlert(null)
  }

  async function save() {
    const nextErrors = validateReservation(catalog, form, time)
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      onSaved(
        await updateReservation(visit.id, {
          version: visit.version,
          ...reservationPayload(form, chosen),
          // Selalu dikirim bila sudah ada uang masuk: backend hanya mengembalikan bila total baru < uang yang dibayar.
          ...(paid > 0 && { refund: { client_request_id: refundId, method: refundMethod } }),
        }),
      )
    } catch (error) {
      const outcome = interpretSaveError(error)
      setErrors(outcome.fields)
      setAlert(outcome.alert)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      title="Ubah Reservasi"
      onClose={onClose}
      footer={
        <Button loading={saving} onClick={save}>
          {!saving && <Save aria-hidden="true" className="h-4 w-4" />} Simpan
        </Button>
      }
    >
      <div className="space-y-5">
        {alert && (
          <Alert variant="error" requestId={alert.requestId}>
            {alert.message}
          </Alert>
        )}
        <ReservationFields
          catalog={catalog}
          form={form}
          onChange={update}
          onSelection={(next) => update({ ...form, ...next, addons: next.package_id === form.package_id ? form.addons : {} })}
          errors={shownErrors}
          time={time}
          disabled={saving}
        />
        <div className="space-y-3 rounded-2xl bg-slate-50 px-4 py-3">
          <BillSummary bill={bill} paid={paid} dueLabel="Sisa dibayar saat datang" />
          {excess > 0 && (
            <>
              <SummaryRow strong label="Dikembalikan" value={formatRupiah(excess)} />
              <Select label="Dikembalikan lewat" options={REFUND_METHODS} value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)} />
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// Pop-up "Ubah Reservasi" (Detail › Ubah Reservasi, Admin, selama pelanggan belum datang):
// nama, No. WA, paket, latar, jumlah orang, tambahan, tanggal & jam — satu Simpan.
// Total baru dibanding uang yang sudah dibayar: kurang → sisa dibayar saat datang; lebih → dikembalikan (Tunai/Transfer)
// dan tercatat di Laporan sebagai baris Refund (minus). onSaved(detail) dipanggil setelah tersimpan.
export default function ReservationEditModal({ visitId, onClose, onSaved }) {
  const { catalog, error: catalogError } = useCatalog()
  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    getVisit(visitId).then(setDetail).catch(setLoadError)
  }, [visitId])

  if (detail && catalog) return <EditForm key={detail.visit.version} detail={detail} catalog={catalog} onClose={onClose} onSaved={onSaved} />

  const failure = loadError ?? catalogError
  return (
    <Modal open size="lg" title="Ubah Reservasi" onClose={onClose}>
      {failure ? (
        <Alert variant="error" requestId={failure.requestId}>
          Data reservasi gagal dimuat. {failure.message}
        </Alert>
      ) : (
        <p className="text-sm text-slate-500">Memuat…</p>
      )}
    </Modal>
  )
}
