import { useId, useState } from 'react'
import { DoorClosed, DoorOpen } from 'lucide-react'
import { useAuth } from '@/modules/akun/useAuth'
import { Alert, Button, Input, Modal } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import { setPackageAvailability } from '../api'

const MIN_REASON_LENGTH = 3

// Tutup/buka ruangan paket sementara (UC-06), Admin saja; Owner tidak melihat tombol ini.
// Dipakai di halaman Antrean. Kontrak props (jangan diubah tanpa kabar):
//   packageId  id paket/ruangan
//   isOpen     true = ruangan buka (tombol "Tutup Ruangan"), false = tutup (tombol "Buka Ruangan")
//   onChanged  dipanggil setelah berhasil dengan { id, is_open } → muat ulang data antrean
// Opsional: packageName (judul dialog), className.
// Contoh: <RoomAvailabilityToggle packageId={room.id} isOpen={room.is_open} onChanged={reload} />
export default function RoomAvailabilityToggle({ packageId, isOpen, onChanged, packageName, className = '' }) {
  const { user } = useAuth()
  const formId = useId()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (user?.role !== ROLES.ADMIN) return null

  async function changeAvailability(nextIsOpen, closeReason) {
    setLoading(true)
    setError(null)
    try {
      const result = await setPackageAvailability(packageId, nextIsOpen, closeReason)
      setDialogOpen(false)
      setReason('')
      onChanged?.(result)
    } catch (err) {
      // Isian alasan tidak dikosongkan supaya bisa langsung dicoba lagi.
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  function openDialog() {
    setError(null)
    setReasonError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    if (!loading) setDialogOpen(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Alasan wajib diisi, minimal ${MIN_REASON_LENGTH} karakter.`)
      return
    }
    setReasonError(null)
    changeAvailability(false, trimmed)
  }

  if (!isOpen) {
    return (
      <div className={className}>
        <Button variant="success" loading={loading} onClick={() => changeAvailability(true)}>
          {!loading && <DoorOpen aria-hidden="true" className="h-4 w-4" />}
          Buka Ruangan
        </Button>
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {error.message}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <Button variant="secondary" className={className} onClick={openDialog}>
        <DoorClosed aria-hidden="true" className="h-4 w-4" />
        Tutup Ruangan
      </Button>

      <Modal
        open={dialogOpen}
        title={packageName ? `Tutup ruangan ${packageName}` : 'Tutup ruangan'}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="neutral" onClick={closeDialog} disabled={loading}>
              Batal
            </Button>
            <Button variant="danger" type="submit" form={formId} loading={loading}>
              Tutup Ruangan
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Selama ditutup, pelanggan paket ini tidak bisa dipanggil sampai ruangan dibuka lagi.
          </p>
          {error && (
            <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
              {error.message}
            </Alert>
          )}
          <Input
            label="Alasan penutupan"
            placeholder="Mis. lampu rusak"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={reasonError}
            maxLength={500}
            autoFocus
          />
        </form>
      </Modal>
    </>
  )
}
