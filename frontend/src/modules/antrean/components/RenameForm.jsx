import { useState } from 'react'
import { addCorrection } from '@/modules/kasir/api'
import { cashierError } from '@/modules/kasir/cashier'
import { Alert, Button, Input } from '@/shared/components/ui'

// Koreksi salah ketik nama panggilan. Lewat koreksi transaksi (tercatat di audit),
// karena updateVisitSelection tidak mengubah nama (catatan tim backend).
export default function RenameForm({ detail, onSaved, onCancel }) {
  const { visit, transaction } = detail
  const [name, setName] = useState(visit.customer_name)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!name.trim()) nextErrors.name = 'Isi nama panggilan.'
    else if (name.trim() === visit.customer_name) nextErrors.name = 'Nama belum diubah.'
    if (reason.trim().length < 3) nextErrors.reason = 'Alasan wajib diisi, minimal 3 karakter.'
    setErrors(nextErrors)
    setAlert(null)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      onSaved(await addCorrection(transaction.id, { version: transaction.version, reason: reason.trim(), customer_name: name.trim() }))
    } catch (error) {
      setAlert(cashierError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 p-4">
      <p className="font-semibold text-slate-800">Koreksi Nama Panggilan</p>
      {alert && (
        <Alert variant={alert.variant} requestId={alert.requestId}>
          {alert.message}
        </Alert>
      )}
      <Input label="Nama panggilan yang benar *" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
      <Input
        label="Alasan koreksi *"
        placeholder="Mis. salah ketik saat pendaftaran"
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
          Simpan Koreksi
        </Button>
      </div>
    </form>
  )
}
