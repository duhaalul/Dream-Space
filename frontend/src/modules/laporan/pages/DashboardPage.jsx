import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Banknote, Camera, TrendingUp } from 'lucide-react'
import { Alert, Badge, Card, PageHeader, StatCard } from '@/shared/components/ui'
import {
  REPORT_PERIODS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONES,
} from '@/shared/utils/constants'
import { formatDate, formatRupiah, todayWib } from '@/shared/utils/format'
import { getDashboard, getReport } from '../api'
import CashMethodChart from '../components/CashMethodChart'
import PeriodFilter from '../components/PeriodFilter'
import SalesChart from '../components/SalesChart'
import { buildPeriodQuery, validatePeriodRange } from '../periodUtils'

// T-02 Dashboard — Owner. Harus nyaman dibuka di HP (NFR-03).
export default function DashboardPage() {
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState(() => todayWib())
  const [customTo, setCustomTo] = useState(() => todayWib())

  const [dashboard, setDashboard] = useState(null)
  const [salesRows, setSalesRows] = useState([])
  const [cashRows, setCashRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboardData = useCallback(async (query) => {
    const [dashData, salesReport, cashReport] = await Promise.all([
      getDashboard(query),
      getReport('sales', query),
      getReport('cash', query),
    ])
    return {
      dashData,
      salesRows: salesReport?.rows ?? [],
      cashRows: cashReport?.rows ?? [],
    }
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
        setCashRows(result.cashRows)
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
      setCashRows(result.cashRows)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const totalPersonsServed = useMemo(
    () => salesRows.reduce((sum, row) => sum + Number(row.persons ?? 0), 0),
    [salesRows],
  )

  const cashBreakdown = useMemo(() => {
    let tunai = 0
    let nonTunai = 0
    for (const row of cashRows) {
      const net = Number(row.net ?? 0)
      if (row.method === 'TUNAI') tunai += net
      else nonTunai += net
    }
    return { tunai, nonTunai }
  }, [cashRows])

  // Paket terlaris: packages[0] bila sessions > 0; bila belum ada sesi tampilkan "Belum ada"
  const topPackage = useMemo(() => {
    const first = dashboard?.packages?.[0]
    if (first && Number(first.sessions) > 0) return first
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
        description="Ringkasan penjualan, sesi selesai, penerimaan kasir, dan performa paket."
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

        {/* 4 Kartu Ringkasan Utama */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Nilai Penjualan"
            value={formatRupiah(dashboard?.sales ?? 0)}
            hint={`Transaksi selesai · ${periodRangeLabel}`}
            icon={TrendingUp}
            tone="brand"
          />
          <StatCard
            label="Sesi Selesai"
            value={`${Number(dashboard?.sessions ?? 0)} Sesi`}
            hint={
              totalPersonsServed > 0
                ? `${totalPersonsServed} pelanggan terlayani`
                : 'Belum ada sesi selesai'
            }
            icon={Camera}
            tone="green"
          />
          <StatCard
            label="Penerimaan Kasir"
            value={formatRupiah(dashboard?.net_cash ?? 0)}
            hint={`Tunai ${formatRupiah(cashBreakdown.tunai)} · Non-tunai ${formatRupiah(cashBreakdown.nonTunai)}`}
            icon={Banknote}
            tone="brand"
          />
          <StatCard
            label="Paket Terlaris"
            value={topPackage ? topPackage.name : 'Belum ada'}
            hint={
              topPackage
                ? `${topPackage.sessions} sesi selesai · ${formatRupiah(topPackage.sales)}`
                : 'Belum ada sesi selesai pada periode ini'
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
                isSingleDay
                  ? 'Nilai transaksi selesai per jam operasional'
                  : 'Nilai transaksi selesai per tanggal pada periode terpilih'
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
            <Card
              title="Penerimaan per Metode"
              description="Bersih setelah pengembalian"
            >
              {loading ? (
                <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <CashMethodChart
                  rows={cashRows}
                  netCash={dashboard?.net_cash ?? 0}
                  cancelledNetCash={dashboard?.cancelled_net_cash ?? 0}
                />
              )}
            </Card>
          </div>
        </div>

        {/* Urutan Performa Paket */}
        <Card
          title={period === 'today' ? 'Paket Terlaris Hari Ini' : 'Urutan Performa Paket'}
          description="Urutan berdasarkan performa penjualan dan sesi selesai"
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
                const sessionsCount = Number(pkg.sessions ?? 0)
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
                    ? 'Belum ada sesi'
                    : rank === 1
                      ? 'Terlaris'
                      : rank === 2
                        ? 'Populer'
                        : 'Aktif'

                return (
                  <div
                    key={pkg.package_id ?? pkg.name}
                    className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-600">
                        #{rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{pkg.name}</p>
                        <p className="text-xs text-slate-500">
                          {sessionsCount} Sesi Selesai
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">
                          {formatRupiah(pkg.sales ?? 0)}
                        </p>
                        <p className="text-[11px] text-slate-500">Total penjualan</p>
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
