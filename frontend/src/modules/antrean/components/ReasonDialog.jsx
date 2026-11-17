import { useId, useState } from 'react'
import { ArrowLeft, Undo2, XCircle } from 'lucide-react'
import { Button, Input, Modal } from '@/shared/components/ui'

const MIN_REASON = 3 // backend: reason minimal 3 karakter
const ICONS = { RETURN: Undo2, CANCEL: XCircle }

// Dialog alasan untuk Kembalikan (data lama Dilewati) dan Batalkan (termasuk membatalkan reservasi).
// config: { action, title, description?, confirmLabel, variant, placeholder } dari useVisitActions.
// Pasang dengan key berbeda per kunjungan+tindakan supaya isian alasan selalu mulai kosong.
export default function ReasonDialog({ config, busy, onCancel, onConfirm }) {
  const ConfirmIcon = ICONS[config.action]
  const formId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  function submit(event) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (trimmed.length < MIN_REASON) {
      setError(`Alasan wajib diisi, minimal ${MIN_REASON} karakter.`)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Modal
      open
      title={config.title}
      onClose={() => !busy && onCancel()}
      footer={
        <>
          <Button variant="neutral" onClick={onCancel} disabled={busy}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Kembali
          </Button>
          <Button type="submit" form={formId} variant={config.variant} loading={busy}>
            {!busy && ConfirmIcon && <ConfirmIcon aria-hidden="true" className="h-4 w-4" />} {config.confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        {config.description && <p className="text-sm text-slate-600">{config.description}</p>}
        <Input
          label="Alasan *"
          placeholder={config.placeholder}
          maxLength={500}
          autoFocus
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setError(null)
          }}
          error={error}
        />
      </form>
    </Modal>
  )
}
