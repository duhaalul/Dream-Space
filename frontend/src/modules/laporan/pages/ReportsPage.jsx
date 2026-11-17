import ReportMobileRows from '../components/ReportMobileRows'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useAuth } from '@/modules/akun/useAuth'
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  SegmentedControl,
  Select,
  StatCard,
  Table,
} from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import { saveBlob } from '@/shared/utils/download'
import { formatDate, formatRupiah, formatTime, parseBackendDate, todayWib } from '@/shared/utils/format'
import { downloadReport, getReport, REPORT_CODES } from '../api'
import PeriodFilter from '../components/PeriodFilter'
import { buildPeriodQuery, validatePeriodRange } from '../periodUtils'

const STATUS_TONES = { DP: 'amber', Lunas: 'green', Refund: 'red' }

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

const REPORT_OPTIONS = Object.entries(REPORT_CODES).map(([value, label]) => ({
  value,
  label,
}))

const ERROR_MESSAGES = {
  DATE_RANGE_REQUIRED: 'Rentang tanggal belum lengkap. Pilih tanggal mulai dan tanggal akhir.',
  INVALID_RANGE: 'Rentang tanggal harus berurutan dan maksimal 367 hari.',
  REPORT_TOO_LARGE: 'Laporan melebihi 10.000 baris. Silakan persempit periode tanggal.',
}

// T-08 Laporan — penjualan = uang masuk per pembayaran (DP / Lunas) pada hari bayar.
// Owner: bebas memilih periode. Admin: hanya hari ini (tanpa pilihan periode).
export default function ReportsPage() {
  const { user } = useAuth()
  const isOwner = user.role === ROLES.OWNER
  const [reportCode, setReportCode] = useState('sales')
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState(() => todayWib())
  const [customTo, setCustomTo] = useState(() => todayWib())

  const [reportData, setReportData] = useState({ from: null, to: null, rows: [] })
  const [loading, setLoading] = useState(true)
  const [downloadingFormat, setDownloadingFormat] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (period === 'custom') return undefined
    let active = true
    const query = buildPeriodQuery(period, '', '')

    getReport(reportCode, query)
      .then((response) => {
        if (!active) return
        setReportData({
          from: response?.from ?? null,
          to: response?.to ?? null,
          rows: response?.rows ?? [],
        })
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
  }, [reportCode, period])

  async function runCustomReport(targetCode) {
    const rangeError = validatePeriodRange('custom', customFrom, customTo)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await getReport(targetCode, buildPeriodQuery('custom', customFrom, customTo))
      setReportData({
        from: response?.from ?? null,
        to: response?.to ?? null,
        rows: response?.rows ?? [],
      })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  function handleReportCodeChange(nextCode) {
    setError(null)
    setReportCode(nextCode)
    if (period === 'custom') {
      runCustomReport(nextCode)
    } else {
      setLoading(true)
    }
  }

  function handlePeriodChange(nextPeriod) {
    setError(null)
    setPeriod(nextPeriod)
    if (nextPeriod !== 'custom') {
      setLoading(true)
    }
  }

  function handleApplyCustom() {
    runCustomReport(reportCode)
  }

  async function handleExport(format) {
    const rangeError = validatePeriodRange(period, customFrom, customTo)
    if (rangeError) {
      setError(rangeError)
      return
    }

    const query = buildPeriodQuery(period, customFrom, customTo)
    setDownloadingFormat(format)
    setError(null)
    try {
      const blob = await downloadReport(reportCode, format, query)
      const fromPart = reportData.from ?? customFrom ?? todayWib()
      const toPart = reportData.to ?? customTo ?? todayWib()
      saveBlob(blob, `${reportCode}-${fromPart}-${toPart}.${format}`)
    } catch (err) {
      setError(err)
    } finally {
      setDownloadingFormat(null)
    }
  }

  const rows = reportData.rows

  // L-01 = satu baris per pembayaran (DP / Lunas). Kunci baris dari urutan (satu transaksi bisa dua baris).
  const tableRows = useMemo(
    () => (reportCode === 'sales' ? rows.map((row, index) => ({ ...row, row_key: index })) : rows),
    [reportCode, rows],
  )

  const summaryCards = useMemo(() => {
    if (reportCode === 'sales') {
      const sumOf = (list) => list.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      const dp = rows.filter((r) => r.status === 'DP')
      const lunas = rows.filter((r) => r.status === 'Lunas')
      const refund = rows.filter((r) => r.status === 'Refund')
      return [
        { label: 'Total Penjualan', value: formatRupiah(sumOf(rows)), tone: 'brand' },
        { label: 'DP', value: formatRupiah(sumOf(dp)), hint: `${dp.length} pembayaran`, tone: 'brand' },
        { label: 'Lunas', value: formatRupiah(sumOf(lunas)), hint: `${lunas.length} pembayaran`, tone: 'green' },
        // Uang dikembalikan (turun paket); nilainya minus dan sudah mengurangi Total Penjualan.
        { label: 'Refund', value: formatRupiah(sumOf(refund)), hint: `${refund.length} pengembalian`, tone: 'brand' },
      ]
    }
    if (reportCode === 'packages') {
      const totalPayments = rows.reduce((sum, r) => sum + Number(r.payments ?? 0), 0)
      const totalSales = rows.reduce((sum, r) => sum + Number(r.sales ?? 0), 0)
      const topPkg = rows.find((r) => Number(r.sales) > 0)
      return [
        { label: 'Total Penjualan Paket', value: formatRupiah(totalSales), tone: 'brand' },
        { label: 'Pembayaran', value: `${totalPayments} Pembayaran`, tone: 'green' },
        { label: 'Paket Terlaris', value: topPkg ? topPkg.name : 'Belum ada', tone: 'brand' },
      ]
    }
    return []
  }, [reportCode, rows])

  // Waktu ringkas supaya kolom Nominal tetap terlihat: satu hari → "14.05"; beberapa hari → "17 Nov 14.05".
  const singleDay = Boolean(reportData.from) && reportData.from === reportData.to

  const columnsByCode = useMemo(() => {
    if (reportCode === 'sales') {
      return [
        {
          key: 'paid_at',
          header: 'Waktu (WIB)',
          render: (row) => (
            <span className="whitespace-nowrap">
              {singleDay ? formatTime(row.paid_at) : `${shortDate.format(parseBackendDate(row.paid_at))} ${formatTime(row.paid_at)}`}
            </span>
          ),
        },
        {
          key: 'transaction_no',
          header: 'No. Transaksi',
          render: (row) => <b className="text-brand-600">{row.transaction_no}</b>,
        },
        { key: 'customer_name', header: 'Pelanggan' },
        { key: 'customer_type', header: 'Jenis' },
        {
          key: 'package_name',
          header: 'Paket',
          render: (row) => row.package_name || '-',
        },
        {
          key: 'persons',
          header: 'Orang',
          align: 'center',
          render: (row) => (row.persons ? `${row.persons} org` : '-'),
        },
        { key: 'method', header: 'Metode' },
        {
          // DP = uang muka reservasi; Lunas = pelunasan / bayar penuh / bayar selisih; Refund = uang dikembalikan (minus).
          key: 'status',
          header: 'Status',
          render: (row) => <Badge tone={STATUS_TONES[row.status] ?? 'gray'}>{row.status}</Badge>,
        },
        {
          key: 'amount',
          header: 'Nominal',
          align: 'right',
          render: (row) => <b className="text-slate-900">{formatRupiah(row.amount)}</b>,
        },
      ]
    }

    if (reportCode === 'packages') {
      return [
        {
          key: 'rank',
          header: 'Urutan',
          render: (row) => (
            <span className="font-bold text-brand-600">#{rows.indexOf(row) + 1}</span>
          ),
        },
        {
          key: 'name',
          header: 'Nama Paket',
          render: (row) => <b className="text-slate-800">{row.name}</b>,
        },
        {
          key: 'payments',
          header: 'Pembayaran',
          align: 'right',
          render: (row) => (
            <Badge tone={Number(row.payments) > 0 ? 'green' : 'gray'}>
              {row.payments} Pembayaran
            </Badge>
          ),
        },
        {
          key: 'sales',
          header: 'Nilai Penjualan',
          align: 'right',
          render: (row) => <b className="text-slate-900">{formatRupiah(row.sales)}</b>,
        },
      ]
    }

    return []
  }, [reportCode, rows, singleDay])

  const errorMessage = error ? (ERROR_MESSAGES[error.code] ?? error.message) : null
  const rangeText =
    reportData.from && reportData.to
      ? reportData.from === reportData.to
        ? formatDate(reportData.from)
        : `${formatDate(reportData.from)} – ${formatDate(reportData.to)}`
      : null

  const periodFilter = (
    <PeriodFilter
      mobileSelect
      period={period}
      from={customFrom}
      to={customTo}
      onPeriodChange={handlePeriodChange}
      onFromChange={setCustomFrom}
      onToChange={setCustomTo}
      onApplyCustom={handleApplyCustom}
      loading={loading}
    />
  )

  return (
    <>
      <PageHeader
        title="Laporan"
        code="T-08"
        description={isOwner ? (
          <>
            <span className="sm:hidden">Penjualan dan pembayaran studio.</span>
            <span className="hidden sm:inline">Uang masuk per pembayaran (L-01) dan per paket (L-02) beserta ekspor PDF dan Excel.</span>
          </>
        ) : null}
        actions={
          isOwner ? (
            <div className="hidden sm:block">{periodFilter}</div>
          ) : (
            // Admin hanya laporan hari ini (backend: REPORT_TODAY_ONLY).
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              <CalendarDays aria-hidden="true" className="h-4 w-4 text-brand-500" />
              {formatDate(todayWib())}
            </span>
          )
        }
      />

      <div className="space-y-4 sm:space-y-6">
        {errorMessage && (
          <Alert variant="error" requestId={error?.status >= 500 ? error?.requestId : null}>
            {errorMessage}
          </Alert>
        )}

        {/* Pilihan Jenis Laporan: L-01 Penjualan, L-02 Penjualan per Paket */}
        <div className={isOwner ? 'flex flex-wrap items-center justify-between gap-3 max-sm:rounded-2xl max-sm:border max-sm:border-slate-200 max-sm:bg-white max-sm:p-3 sm:gap-4' : 'flex flex-wrap items-center justify-between gap-4'}>
          {isOwner && (
            <div className="grid w-full min-w-0 gap-3 sm:hidden">
              <Select
                label="Jenis laporan"
                options={REPORT_OPTIONS}
                value={reportCode}
                onChange={(event) => handleReportCodeChange(event.target.value)}
              />
              {periodFilter}
            </div>
          )}
          <SegmentedControl
            label="Jenis laporan"
            tone="brand"
            className={isOwner ? 'max-sm:hidden' : 'max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:[&>button]:px-2 max-sm:[&>button]:whitespace-normal'}
            options={REPORT_OPTIONS}
            value={reportCode}
            onChange={handleReportCodeChange}
          />

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Button
              size="sm"
              className="max-sm:min-h-11"
              variant="danger"
              loading={downloadingFormat === 'pdf'}
              disabled={loading || downloadingFormat !== null}
              onClick={() => handleExport('pdf')}
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Unduh PDF
            </Button>
            <Button
              size="sm"
              className="max-sm:min-h-11"
              variant="soft-success"
              loading={downloadingFormat === 'xlsx'}
              disabled={loading || downloadingFormat !== null}
              onClick={() => handleExport('xlsx')}
            >
              <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
              Unduh Excel
            </Button>
          </div>
        </div>

        {/* Kartu Ringkasan Laporan */}
        {isOwner && summaryCards.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white sm:hidden">
            <div className="bg-linear-to-br from-white to-brand-50 p-4">
              <p className="text-sm text-slate-500">{summaryCards[0].label}</p>
              <p className="mt-1 wrap-anywhere text-2xl font-bold text-slate-900">{summaryCards[0].value}</p>
              {rangeText && <p className="mt-1 text-xs text-brand-600">{rangeText}</p>}
            </div>
            <dl className="divide-y divide-slate-100 border-t border-brand-100 px-4">
              {summaryCards.slice(1).map((card) => (
                <div key={card.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-3 py-2.5">
                  <dt className="text-sm font-medium text-slate-700">{card.label}</dt>
                  <dd className="text-right text-sm font-semibold wrap-anywhere text-slate-900">{card.value}</dd>
                  {card.hint && <dd className="col-span-2 text-xs text-slate-500">{card.hint}</dd>}
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isOwner ? 'max-sm:hidden' : ''} ${summaryCards.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {summaryCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint ?? rangeText}
              tone={card.tone}
            />
          ))}
        </div>

        {/* Tabel Laporan Utama */}
        <Card
          title={REPORT_CODES[reportCode]}
          description={
            rangeText
              ? `Periode: ${rangeText} (WIB) · Menampilkan ${rows.length} baris`
              : 'Memuat data laporan...'
          }
          actions={
            <Badge tone="brand" className={isOwner ? 'max-sm:hidden' : ''}>
              <Download aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Maks. 10.000 baris
            </Badge>
          }
        >
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-11 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <>
              {isOwner && <ReportMobileRows code={reportCode} columns={columnsByCode} rows={tableRows} />}
              <div className={isOwner ? 'hidden sm:block' : ''}>
                <Table
                  columns={columnsByCode}
                  rows={tableRows}
                  rowKey={reportCode === 'packages' ? 'package_id' : 'row_key'}
                  empty="Belum ada data pada periode ini."
                />
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
