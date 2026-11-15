import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { VISIT_ACTIONS } from '@/shared/utils/constants'
import { todayWib } from '@/shared/utils/format'
import { appointmentDue } from '../queue'
import { nowWibTime } from '../visitForm'

// Tombol tindakan Admin sesuai status kunjungan (README modul antrean, "Tombol per status").
// Dipakai papan Per Paket dan Ringkasan. actions = hasil useVisitActions().
// call: { isFirst, blocked } khusus status Menunggu (blocked = alasan Panggil nonaktif).
export default function VisitActionButtons({ visit, actions, call = { isFirst: true, blocked: null } }) {
  const navigate = useNavigate()
  const anyBusy = actions.busyId !== null
  const loading = actions.busyId === visit.id
  const isToday = visit.service_date === todayWib()
  const toKasir = () => navigate(`/kasir/${visit.id}`)

  const kasir = (
    <Button key="kasir" size="sm" variant="soft" onClick={toKasir}>
      Ke Kasir
    </Button>
  )
  const cancel = (
    <Button key="cancel" size="sm" variant="danger" disabled={anyBusy} onClick={() => actions.ask(visit, VISIT_ACTIONS.CANCEL)}>
      Batalkan
    </Button>
  )

  switch (visit.status) {
    case 'RESERVASI': {
      const due = appointmentDue(visit, `${todayWib()} ${nowWibTime()}`)
      return [
        isToday && (
          <Button
            key="confirm"
            size="sm"
            variant="success"
            loading={loading}
            // Backend: hanya pada tanggal & mulai jam janji, dan paket sudah lengkap.
            disabled={anyBusy || !due || !visit.package_id}
            onClick={() => actions.run(visit, VISIT_ACTIONS.CONFIRM, { priority: true })}
          >
            Sudah Datang
          </Button>
        ),
        cancel,
      ]
    }
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
            // Urutan pertama langsung dipanggil; selain itu wajib alasan (di luar urutan).
            onClick={() => (call.isFirst ? actions.run(visit, VISIT_ACTIONS.CALL) : actions.ask(visit, VISIT_ACTIONS.CALL))}
          >
            Panggil
          </Button>
        ),
        kasir,
        cancel,
      ]
    case 'DIPANGGIL':
      return [
        <Button key="start" size="sm" variant="success" loading={loading} disabled={anyBusy} onClick={() => actions.run(visit, VISIT_ACTIONS.START)}>
          Mulai Foto <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>,
        <Button key="skip" size="sm" variant="neutral" disabled={anyBusy} onClick={() => actions.ask(visit, VISIT_ACTIONS.SKIP)}>
          Lewati
        </Button>,
        cancel,
        kasir,
      ]
    case 'SEDANG_DILAYANI':
      return [
        kasir,
        <Button key="finish" size="sm" variant="success" onClick={toKasir}>
          Selesaikan Sesi <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>,
      ]
    case 'DILEWATI':
      return [
        // Kembali ke antrean hanya untuk antrean hari ini (backend: INVALID_TRANSITION).
        isToday && (
          <Button key="return" size="sm" variant="soft" disabled={anyBusy} onClick={() => actions.ask(visit, VISIT_ACTIONS.RETURN)}>
            Kembalikan ke Antrean
          </Button>
        ),
        cancel,
      ]
    default:
      return null
  }
}
