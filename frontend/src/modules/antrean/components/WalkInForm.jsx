import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Alert, Button, Card, Input } from '@/shared/components/ui'
import { CUSTOMER_TYPES } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'
import { createVisit } from '../api'
import { formatQueueNumber } from '../queue'
import {
  EMPTY_SELECTION,
  interpretSaveError,
  newRequestIds,
  selectionPayload,
  validateSelection,
} from '../visitForm'
import EstimateBox from './EstimateBox'
import PackageFields from './PackageFields'

const EMPTY_FORM = { customer_name: '', ...EMPTY_SELECTION }

// Kartu "Pendaftaran Datang Langsung" (UC-08): nama panggilan + paket, latar, jumlah orang
// → langsung masuk antrean paket. Tanpa nomor telepon (NFR-07).
export default function WalkInForm({ catalog, autoFocus = false }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(null) // 'queue' | 'cashier'
  // Satu request ID per pengisian; dipakai ulang bila simpan diulang setelah gagal.
  const [requestIds, setRequestIds] = useState(newRequestIds)

  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null

  function change(next) {
    setForm(next)
    setErrors({})
    setSuccess(null)
  }

  async function submit(goToCashier) {
    const name = form.customer_name.trim()
    const nextErrors = validateSelection(catalog, form, { required: true })
    if (!name) nextErrors.customer_name = 'Isi nama panggilan pelanggan.'
    setErrors(nextErrors)
    setAlert(null)
    setSuccess(null)
    if (Object.keys(nextErrors).length) return

    setSaving(goToCashier ? 'cashier' : 'queue')
    try {
      const result = await createVisit({
        client_request_id: requestIds.visit,
        customer_name: name,
        customer_type: CUSTOMER_TYPES.WALK_IN,
        ...selectionPayload(form),
      })
      setRequestIds(newRequestIds())
      if (goToCashier) {
        navigate(`/kasir/${result.visit.id}`)
        return
      }
      const queue = formatQueueNumber(result.visit.queue_code_snapshot, result.visit.queue_number)
      setForm(EMPTY_FORM)
      setSuccess(
        `${result.visit.customer_name} masuk antrean ${queue} · tagihan ${formatRupiah(result.transaction.total)}.`,
      )
    } catch (error) {
      const outcome = interpretSaveError(error)
      setErrors(outcome.fields)
      setAlert(outcome.alert)
      if (outcome.resetRequest) setRequestIds(newRequestIds())
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card title="Pendaftaran Datang Langsung" description="Isi nama panggilan pelanggan dan pilih paket studio">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
      >
        {success && <Alert variant="success">{success}</Alert>}
        {alert && (
          <Alert variant="error" requestId={alert.requestId}>
            {alert.message}
          </Alert>
        )}

        <Input
          label="Nama Panggilan Pelanggan *"
          placeholder="Contoh: Bayu"
          autoFocus={autoFocus}
          maxLength={100}
          autoComplete="off"
          value={form.customer_name}
          onChange={(event) => change({ ...form, customer_name: event.target.value })}
          error={errors.customer_name}
        />

        <PackageFields catalog={catalog} value={form} onChange={change} errors={errors} />

        <EstimateBox pkg={pkg} persons={form.persons} />

        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <Button type="submit" variant="neutral" size="lg" loading={saving === 'queue'} disabled={saving !== null}>
            Simpan &amp; Masuk Antrean
          </Button>
          <Button
            variant="success"
            size="lg"
            loading={saving === 'cashier'}
            disabled={saving !== null}
            onClick={() => submit(true)}
          >
            Bayar di Awal (Kasir) <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  )
}
