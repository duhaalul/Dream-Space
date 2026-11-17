import { useState } from 'react'
import { CheckCircle2, Printer } from 'lucide-react'
import { Alert, Button, Modal } from '@/shared/components/ui'
import { openBlob } from '@/shared/utils/download'
import { formatRupiah } from '@/shared/utils/format'
import { downloadReceipt } from '../api'
import { SummaryRow } from './BillSummary'

// Pop-up setelah pelanggan lunas dan masuk antrean (tab Di Tempat & "Sudah Datang"):
// nomor antrean untuk disebutkan ke pelanggan, kembalian, dan Cetak Nota (nota tidak terbuka otomatis).
// info = successInfo(detail). closeLabel/closeIcon = tombol kiri (mis. "Pendaftaran Baru").
export default function RegistrationSuccess({ info, onClose, closeLabel, closeIcon: CloseIcon }) {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState(null)

  async function print() {
    setPrinting(true)
    setError(null)
    try {
      openBlob(await downloadReceipt(info.transactionId))
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
            <CloseIcon aria-hidden="true" className="h-4 w-4" /> {closeLabel}
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
          <p className="mt-2 text-5xl font-black tracking-tight text-brand-600">{info.queue}</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{info.name}</p>
        </div>
        <div className="space-y-1.5 rounded-2xl bg-slate-50 px-4 py-3">
          <SummaryRow label={`Lunas · ${info.methods}`} value={formatRupiah(info.total)} />
          {info.cash && <SummaryRow strong label="Kembalian" value={formatRupiah(info.change)} />}
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
