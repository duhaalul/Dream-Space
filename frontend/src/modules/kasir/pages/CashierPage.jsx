import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import { getAddons, getPackages } from '@/modules/paket/api'
import { Alert, Button, Card, PageHeader } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { getActiveVisits, getCashierDetail } from '../api'
import ActiveVisitList from '../components/ActiveVisitList'
import BillDetails from '../components/BillDetails'
import PaymentPanel from '../components/PaymentPanel'

const REFRESH_MS = 15_000

async function fetchActiveVisits() {
  const visits = []
  for (let page = 1; page <= 20; page += 1) {
    const rows = await getActiveVisits({ date: todayWib(), page })
    visits.push(...rows)
    if (rows.length < 100) break
  }
  return visits
}

// T-05 Kasir — Admin (desain 05_Kasir_Admin).
// /kasir → daftar pelanggan aktif. /kasir/:id → pelanggan (kunjungan) :id terpilih.
export default function CashierPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [visits, setVisits] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [detail, setDetail] = useState(null) // { id, data } supaya detail lama tidak tampil untuk id baru
  const [loadError, setLoadError] = useState(null)

  const loadVisits = useCallback(
    () =>
      fetchActiveVisits()
        .then((rows) => {
          setVisits(rows)
          setLoadError(null)
        })
        .catch(setLoadError),
    [],
  )

  const loadDetail = useCallback(() => {
    if (!id) return Promise.resolve()
    return getCashierDetail(id)
      .then((data) => setDetail({ id, data }))
      .catch((error) => setDetail({ id, error }))
  }, [id])

  // Paket & tambahan ikut dimuat ulang: halaman Kasir bisa terbuka seharian sementara Owner mengubah katalog.
  const loadCatalog = useCallback(
    () =>
      Promise.all([getPackages(), getAddons()])
        .then(([packages, addons]) =>
          setCatalog({
            packages: packages?.packages ?? [],
            allowedAddons: packages?.allowed_addons ?? [],
            addons: addons ?? [],
          }),
        )
        .catch(setLoadError),
    [],
  )

  const reloadAll = useCallback(() => {
    loadCatalog()
    loadVisits()
    loadDetail()
  }, [loadCatalog, loadVisits, loadDetail])

  useEffect(() => {
    reloadAll()
    const timer = setInterval(() => {
      if (!document.hidden) reloadAll()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reloadAll])

  // Detail terbaru dari respons tindakan; daftar ikut diperbarui (total/status berubah).
  function handleUpdated(data) {
    setDetail({ id, data })
    loadVisits()
  }

  const packages = new Map((catalog?.packages ?? []).map((pkg) => [pkg.id, pkg]))
  const current = detail?.id === id ? detail : null

  let main
  if (!id) {
    main = (
      <Card className="lg:col-span-2">
        <p className="text-sm text-slate-500">Pilih pelanggan di kolom kiri untuk melihat rincian tagihan dan menerima pembayaran.</p>
      </Card>
    )
  } else if (current?.error) {
    main = (
      <Card className="lg:col-span-2">
        <Alert variant="error" requestId={current.error.requestId}>
          Rincian tagihan gagal dimuat. {current.error.message}
        </Alert>
      </Card>
    )
  } else if (!current || !catalog) {
    main = (
      <Card className="lg:col-span-2">
        <p className="text-sm text-slate-500">Memuat rincian tagihan…</p>
      </Card>
    )
  } else {
    main = (
      <>
        {/* key per kunjungan: isian & pesan tidak terbawa ke pelanggan lain */}
        <BillDetails key={`bill-${id}`} detail={current.data} catalog={catalog} onUpdated={handleUpdated} onReload={reloadAll} />
        <PaymentPanel key={`pay-${id}`} detail={current.data} onUpdated={handleUpdated} onReload={reloadAll} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Kasir"
        code="T-05"
        actions={
          <Button variant="success" onClick={() => navigate('/antrean?tab=pendaftaran&form=walkin')}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Pelanggan Baru (Bayar Awal)
          </Button>
        }
      />

      {loadError && (
        <Alert variant="warning" className="mb-4">
          Gagal memuat data ({loadError.message}). Yang tampil adalah data terakhir.
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
        <ActiveVisitList visits={visits ?? []} packages={packages} selectedId={id} loading={visits === null} />
        {main}
      </div>
    </>
  )
}
