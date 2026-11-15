import { useId, useState } from 'react'
import { Button, Input, Modal } from '@/shared/components/ui'

const MIN_REASON = 3 // backend: reason minimal 3 karakter

// Dialog alasan untuk Lewati, Kembalikan, Batalkan, dan Panggil di luar urutan.
// config: { title, description, confirmLabel, variant, placeholder } dari useVisitActions.
// Pasang dengan key berbeda per kunjungan+tindakan supaya isian alasan selalu mulai kosong.
export default function ReasonDialog({ config, busy, onCancel, onConfirm }) {
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
            Batal
          </Button>
          <Button type="submit" form={formId} variant={config.variant} loading={busy}>
            {config.confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">{config.description}</p>
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
