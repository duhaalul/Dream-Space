import { Camera, CheckCircle2, Megaphone, Undo2, XCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { VISIT_ACTIONS } from '@/shared/utils/constants'
import { todayWib } from '@/shared/utils/format'

// Tombol tindakan Admin sesuai status (semua berikon). Tagihan sudah lunas saat masuk antrean,
// jadi tidak ada tombol kasir: sesi foto cukup diakhiri dengan "Selesai".
// Reservasi yang belum datang punya tombol sendiri (bagian Reservasi: Sudah Datang, Batalkan).
// call: { blocked } khusus status Menunggu (blocked = alasan Panggil nonaktif).
// Siapa pun di Menunggu boleh dipanggil tanpa alasan: urutan hanya panduan, keputusan di Admin.
export default function VisitActionButtons({ visit, actions, call = { blocked: null } }) {
  const anyBusy = actions.busyId !== null
  const loading = actions.busyId === visit.id
  const isToday = visit.service_date === todayWib()

  const cancel = (
    <Button key="cancel" size="sm" variant="danger" disabled={anyBusy} onClick={() => actions.ask(visit, VISIT_ACTIONS.CANCEL)}>
      <XCircle aria-hidden="true" className="h-3.5 w-3.5" /> Batalkan
    </Button>
  )

  switch (visit.status) {
    case 'MENUNGGU':
      return [
        // Antrean hari lain tidak bisa dipanggil (WRONG_SERVICE_DATE).
        isToday && (
          <Button
            key="call"
            size="sm"
            variant="warning"
            loading={loading}
            disabled={anyBusy || !!call.blocked}
            title={call.blocked ?? undefined}
            onClick={() => actions.run(visit, VISIT_ACTIONS.CALL)}
          >
            {!loading && <Megaphone aria-hidden="true" className="h-3.5 w-3.5" />} Panggil
          </Button>
        ),
        cancel,
      ]
    case 'DIPANGGIL':
      return [
        <Button key="start" size="sm" variant="success" loading={loading} disabled={anyBusy} onClick={() => actions.run(visit, VISIT_ACTIONS.START)}>
          {!loading && <Camera aria-hidden="true" className="h-3.5 w-3.5" />} Mulai Foto
        </Button>,
        // Salah panggil / belum di tempat: kembali ke Menunggu di urutan semula, tanpa alasan (pengganti "Lewati").
        <Button key="uncall" size="sm" variant="neutral" disabled={anyBusy} onClick={() => actions.run(visit, VISIT_ACTIONS.UNCALL)}>
          <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Kembali ke Antrean
        </Button>,
        cancel,
      ]
    case 'SEDANG_DILAYANI':
      return (
        <Button size="sm" variant="success" loading={loading} disabled={anyBusy} onClick={() => actions.run(visit, VISIT_ACTIONS.FINISH)}>
          {!loading && <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />} Selesai
        </Button>
      )
    case 'DILEWATI':
      // Hanya untuk data lama (tombol Lewati sudah diganti "Kembali ke Antrean").
      return [
        // Kembali ke antrean hanya untuk antrean hari ini (backend: INVALID_TRANSITION).
        isToday && (
          <Button key="return" size="sm" variant="soft" disabled={anyBusy} onClick={() => actions.ask(visit, VISIT_ACTIONS.RETURN)}>
            <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Kembalikan
          </Button>
        ),
        cancel,
      ]
    default:
      return null
  }
}
