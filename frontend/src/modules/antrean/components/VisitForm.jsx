import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getPackages } from '@/modules/paket/api'
import { Alert, Button, Card } from '@/shared/components/ui'
import ReservationForm from './ReservationForm'
import WalkInForm from './WalkInForm'

// Tab "Pendaftaran" di halaman Antrean (T-04), Admin saja.
// Kiri: pendaftaran datang langsung. Kanan: reservasi WhatsApp + DP.
export default function VisitForm() {
  // ?form=walkin|reservasi dari tombol header halaman Antrean → kursor langsung di kolom nama.
  const [searchParams] = useSearchParams()
  const focusForm = searchParams.get('form')
  const [catalog, setCatalog] = useState(null)
  const [loadError, setLoadError] = useState(null)

  // Hasil setState dipanggil setelah request selesai (bukan langsung di dalam effect).
  const loadCatalog = useCallback(
    () =>
      getPackages()
        .then((data) => {
          setLoadError(null)
          setCatalog({ packages: data?.packages ?? [], backgrounds: data?.backgrounds ?? [] })
        })
        .catch(setLoadError),
    [],
  )

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  if (loadError) {
    return (
      <Card>
        <Alert variant="error" requestId={loadError.requestId}>
          Daftar paket gagal dimuat. {loadError.message}
        </Alert>
        <Button variant="soft" className="mt-4" onClick={loadCatalog}>
          Coba lagi
        </Button>
      </Card>
    )
  }

  if (!catalog) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat daftar paket…</p>
      </Card>
    )
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <WalkInForm catalog={catalog} autoFocus={focusForm === 'walkin'} />
      <ReservationForm catalog={catalog} autoFocus={focusForm === 'reservasi'} />
    </div>
  )
}
