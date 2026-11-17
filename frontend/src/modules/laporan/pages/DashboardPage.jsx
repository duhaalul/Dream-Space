import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Camera, TrendingUp } from 'lucide-react'
import { Alert, Badge, Card, PageHeader, StatCard } from '@/shared/components/ui'
import {
  REPORT_PERIODS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONES,
} from '@/shared/utils/constants'
import { formatDate, formatRupiah, todayWib } from '@/shared/utils/format'
import { getDashboard, getReport } from '../api'
import PeriodFilter from '../components/PeriodFilter'
import SalesChart from '../components/SalesChart'
import SalesMethodChart from '../components/SalesMethodChart'
import { buildPeriodQuery, validatePeriodRange } from '../periodUtils'

// T-02 Dashboard — Owner. Harus nyaman dibuka di HP (NFR-03).
export default function DashboardPage() {
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState(() => todayWib())
  const [customTo, setCustomTo] = useState(() => todayWib())

  const [dashboard, setDashboard] = useState(null)
  const [salesRows, setSalesRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Semua angka Dashboard berdasar penjualan (transaksi lunas, tanpa yang dibatalkan).
  const fetchDashboardData = useCallback(async (query) => {
    const [dashData, salesReport] = await Promise.all([getDashboard(query), getReport('sales', query)])
    return { dashData, salesRows: salesReport?.rows ?? [] }
  }, [])

  useEffect(() => {
    if (period === 'custom') return undefined
    let active = true
    const query = buildPeriodQuery(period, '', '')

    fetchDashboardData(query)
      .then((result) => {
        if (!active) return
        setDashboard(result.dashData)
        setSalesRows(result.salesRows)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [period, fetchDashboardData])

  function handlePeriodChange(nextPeriod) {
    setError(null)
    setPeriod(nextPeriod)
    if (nextPeriod !== 'custom') {
      setLoading(true)
    }
  }

  async function handleApplyCustom() {
    const rangeError = validatePeriodRange('custom', customFrom, customTo)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDashboardData(buildPeriodQuery('custom', customFrom, customTo))
      setDashboard(result.dashData)
      setSalesRows(result.salesRows)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  // Paket terlaris: packages[0] (urut penjualan) bila sudah ada uang masuk; bila belum tampilkan "Belum ada".
  const topPackage = useMemo(() => {
    const first = dashboard?.packages?.[0]
    if (first && Number(first.sales) > 0) return first
    return null
  }, [dashboard])

  const periodRangeLabel = useMemo(() => {
    if (!dashboard?.from) return REPORT_PERIODS[period]
    if (dashboard.from === dashboard.to) return formatDate(dashboard.from)
    return `${formatDate(dashboard.from)} – ${formatDate(dashboard.to)}`
  }, [dashboard, period])

  const isSingleDay = !dashboard?.from || dashboard.from === dashboard.to

  return (
    <>
      <PageHeader
        title="Dashboard"
        code="T-02"
        description="Ringkasan uang masuk (DP & Lunas), transaksi lunas, dan performa paket."
        actions={
          <PeriodFilter
            period={period}
            from={customFrom}
            to={customTo}
            onPeriodChange={handlePeriodChange}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
            onApplyCustom={handleApplyCustom}
            loading={loading}
          />
        }
      />

      <div className="space-y-6">
        {error && (
          <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
            {error.message}
          </Alert>
        )}

        {/* 3 Kartu Ringkasan Utama */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard
            label="Nilai Penjualan"
            className="col-span-2 max-sm:[&>p:first-of-type]:text-2xl sm:col-span-1"
            value={formatRupiah(dashboard?.sales ?? 0)}
            hint={`DP ${formatRupiah(dashboard?.dp?.amount ?? 0)} · Lunas ${formatRupiah(dashboard?.lunas?.amount ?? 0)}${
              dashboard?.refund?.amount ? ` · Refund −${formatRupiah(dashboard.refund.amount)}` : ''
            }`}
            icon={TrendingUp}
            tone="brand"
          />
          <StatCard
            label="Transaksi Lunas"
            value={`${Number(dashboard?.lunas?.count ?? 0)} Transaksi`}
            hint={periodRangeLabel}
            icon={Camera}
            tone="green"
          />
          <StatCard
            label="Paket Terlaris"
            value={topPackage ? topPackage.name : 'Belum ada'}
            hint={
              topPackage
                ? `${topPackage.payments} pembayaran · ${formatRupiah(topPackage.sales)}`
                : 'Belum ada transaksi pada periode ini'
            }
            icon={Award}
            tone="brand"
          />
        </div>

        {/* Grafik Penjualan & Penerimaan per Metode */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <Card
              title={period === 'today' ? 'Grafik Penjualan Hari Ini' : 'Grafik Penjualan'}
              description={
                isSingleDay ? 'Uang masuk per jam' : 'Uang masuk per tanggal'
              }
              actions={<Badge tone="brand">{REPORT_PERIODS[period]}</Badge>}
            >
              {loading ? (
                <div className="h-64 animate-pulse rounded-2xl bg-slate-100 sm:h-72" />
              ) : (
                <SalesChart rows={salesRows} from={dashboard?.from} to={dashboard?.to} />
              )}
            </Card>
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <Card title="Penjualan per Metode">
              {loading ? (
                <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <SalesMethodChart methods={dashboard?.methods ?? []} total={dashboard?.sales ?? 0} />
              )}
            </Card>
          </div>
        </div>

        {/* Urutan Performa Paket */}
        <Card
          title={period === 'today' ? 'Paket Terlaris Hari Ini' : 'Urutan Performa Paket'}
          description="Urutan berdasarkan penjualan (uang masuk)"
        >
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : !dashboard?.packages?.length ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada data paket terdaftar.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard.packages.map((pkg, index) => {
                const sessionsCount = Number(pkg.payments ?? 0)
                const rank = index + 1
                const badgeTone =
                  sessionsCount === 0
                    ? 'gray'
                    : rank === 1
                      ? 'green'
                      : rank === 2
                        ? 'brand'
                        : 'amber'
                const badgeLabel =
                  sessionsCount === 0
                    ? 'Belum ada'
                    : rank === 1
                      ? 'Terlaris'
                      : rank === 2
                        ? 'Populer'
                        : 'Aktif'

                return (
                  <div
                    key={pkg.package_id ?? pkg.name}
                    className="grid grid-cols-[minmax(0,1fr)_38%] items-center gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex sm:flex-wrap sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-3.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xs font-bold text-brand-600 sm:size-10 sm:text-sm">
                        #{rank}
                      </span>
                      <div className="min-w-0">
                        <p className="max-sm:wrap-anywhere text-sm font-bold text-slate-800 sm:truncate sm:text-base">{pkg.name}</p>
                        <p className="text-xs text-slate-500">
                          {sessionsCount} Pembayaran
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 max-sm:min-w-0 sm:flex-row sm:items-center sm:gap-6">
                      <div className="text-right max-sm:w-full max-sm:min-w-0">
                        <p className="max-sm:wrap-anywhere text-sm font-bold max-sm:tabular-nums text-slate-800">
                          {formatRupiah(pkg.sales ?? 0)}
                        </p>
                        <p className="hidden text-[11px] text-slate-500 sm:block">Total penjualan</p>
                      </div>
                      <Badge tone={badgeTone}>{badgeLabel}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Ringkasan Status Kunjungan */}
        {dashboard?.visits_by_status?.length > 0 && (
          <Card
            title="Ringkasan Status Kunjungan"
            description={`Jumlah kunjungan berdasarkan status pada periode ${periodRangeLabel}`}
          >
            <div className="flex flex-wrap gap-2.5">
              {dashboard.visits_by_status.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3.5 py-2"
                >
                  <Badge tone={VISIT_STATUS_TONES[item.status] ?? 'gray'}>
                    {VISIT_STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                  <span className="text-sm font-bold text-slate-800">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
