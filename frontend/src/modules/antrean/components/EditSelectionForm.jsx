import { useState } from 'react'
import { Alert, Button, Input } from '@/shared/components/ui'
import { updateVisitSelection } from '../api'
import { interpretSaveError, selectionPayload, validateSelection } from '../visitForm'
import EstimateBox from './EstimateBox'
import PackageFields from './PackageFields'

// Ubah paket, latar, atau jumlah orang — hanya sebelum dipanggil (Reservasi/Menunggu).
// Juga dipakai untuk melengkapi paket reservasi sebelum "Sudah datang".
// onSaved(detail) menerima detail terbaru dari backend.
export default function EditSelectionForm({ detail, catalog, onSaved, onCancel }) {
  const { visit } = detail
  const [form, setForm] = useState({
    package_id: visit.package_id ? String(visit.package_id) : '',
    background_id: visit.background_id ? String(visit.background_id) : '',
    persons: visit.persons ? String(visit.persons) : '',
  })
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateSelection(catalog, form, { required: true })
    if (reason.trim().length < 3) nextErrors.reason = 'Alasan wajib diisi, minimal 3 karakter.'
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      onSaved(await updateVisitSelection(visit.id, { version: visit.version, ...selectionPayload(form), reason: reason.trim() }))
    } catch (error) {
      const outcome = interpretSaveError(error)
      setErrors(outcome.fields)
      setAlert(outcome.alert)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 p-4">
      <p className="font-semibold text-slate-800">Ubah Paket, Latar, atau Jumlah Orang</p>
      {alert && (
        <Alert variant="error" requestId={alert.requestId}>
          {alert.message}
        </Alert>
      )}
      <PackageFields
        catalog={catalog}
        value={form}
        onChange={(next) => {
          setForm(next)
          setErrors({})
        }}
        errors={errors}
      />
      {pkg && <EstimateBox pkg={pkg} persons={form.persons} />}
      <Input
        label="Alasan perubahan *"
        placeholder="Mis. pelanggan memilih paket lain"
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        error={errors.reason}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="neutral" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          Simpan Perubahan
        </Button>
      </div>
    </form>
  )
}
