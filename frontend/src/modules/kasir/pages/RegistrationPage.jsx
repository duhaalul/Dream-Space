import { useSearchParams } from 'react-router'
import { CalendarClock, Store } from 'lucide-react'
import { Alert, PageHeader, SegmentedControl } from '@/shared/components/ui'
import ReservationForm from '../components/ReservationForm'
import WalkInForm from '../components/WalkInForm'
import { useCatalog } from '../useCatalog'

const TABS = [
  { value: 'langsung', label: 'Di Tempat', icon: Store },
  { value: 'reservasi', label: 'Reservasi', icon: CalendarClock },
]

// T-04/T-05 Pendaftaran (Admin), dua tab di kanan atas:
// - Di Tempat: pelanggan di studio → pilih paket & tambahan → bayar lunas → masuk antrean.
// - Reservasi: pesanan WhatsApp → jadwal + DP/Lunas (Transfer/QRIS) → muncul di Antrean › Reservasi.
// Tab tersimpan di URL (?tab=reservasi). Kedua form tetap terpasang supaya isian tidak hilang saat pindah tab.
export default function RegistrationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'reservasi' ? 'reservasi' : 'langsung'
  const { catalog, error } = useCatalog()

  function selectTab(next) {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'reservasi') params.set('tab', 'reservasi')
        else params.delete('tab')
        return params
      },
      { replace: true },
    )
  }

  let body
  if (error) {
    body = (
      <Alert variant="error" requestId={error.requestId}>
        Daftar paket gagal dimuat. {error.message}
      </Alert>
    )
  } else if (!catalog) {
    body = <p className="text-sm text-slate-500">Memuat…</p>
  } else {
    body = (
      <>
        <div hidden={tab !== 'langsung'}>
          <WalkInForm catalog={catalog} />
        </div>
        <div hidden={tab !== 'reservasi'}>
          <ReservationForm catalog={catalog} />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Pendaftaran"
        code="T-04"
        actions={<SegmentedControl label="Jenis pendaftaran" tone="brand" options={TABS} value={tab} onChange={selectTab} />}
      />
      {body}
    </>
  )
}
