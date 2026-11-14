import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  SegmentedControl,
  StatCard,
  Table,
} from '@/shared/components/ui'
import {
  CUSTOMER_TYPES,
  PAYMENT_METHOD_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONES,
} from '@/shared/utils/constants'
import { saveBlob } from '@/shared/utils/download'
import { formatDate, formatDateTime, formatRupiah, formatTime, todayWib } from '@/shared/utils/format'
import { downloadReport, getReport, REPORT_CODES } from '../api'
import PeriodFilter from '../components/PeriodFilter'
import { buildPeriodQuery, validatePeriodRange } from '../periodUtils'

const REPORT_OPTIONS = Object.entries(REPORT_CODES).map(([value, label]) => ({
  value,
  label,
}))

const PAYMENT_STATUS_BADGES = {
  LUNAS: { label: 'Lunas', tone: 'green' },
  BELUM_LUNAS: { label: 'Belum Lunas', tone: 'amber' },
  BELUM_DIBAYAR: { label: 'Belum Dibayar', tone: 'red' },
  KELEBIHAN_BAYAR: { label: 'Kelebihan Bayar', tone: 'indigo' },
  TIDAK_ADA_TAGIHAN: { label: 'Tanpa Tagihan', tone: 'gray' },
}

const CASH_CATEGORY_BADGES = {
  NORMAL: { label: 'Transaksi Normal', tone: 'green' },
  REFUND_KELEBIHAN: { label: 'Refund Kelebihan', tone: 'amber' },
  BATAL_DITAHAN: { label: 'Batal (Ditahan)', tone: 'red' },
}

const ERROR_MESSAGES = {
  DATE_RANGE_REQUIRED: 'Rentang tanggal belum lengkap. Pilih tanggal mulai dan tanggal akhir.',
  INVALID_RANGE: 'Rentang tanggal harus berurutan dan maksimal 367 hari.',
  REPORT_TOO_LARGE: 'Laporan melebihi 10.000 baris. Silakan persempit periode tanggal.',
}

// T-08 Laporan — Owner.
export default function ReportsPage() {
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

  // Pemisahan baris L-03: transaksi normal/refund vs transaksi dibatalkan (BATAL_DITAHAN)
  const cashSplit = useMemo(() => {
    if (reportCode !== 'cash') return { regularRows: [], cancelledRows: [] }
    const regularRows = []
    const cancelledRows = []
    for (const row of rows) {
      if (row.category === 'BATAL_DITAHAN') cancelledRows.push(row)
      else regularRows.push(row)
    }
    return { regularRows, cancelledRows }
  }, [reportCode, rows])

  const summaryCards = useMemo(() => {
    if (reportCode === 'sales') {
      const totalSales = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0)
      const totalPersons = rows.reduce((sum, r) => sum + Number(r.persons ?? 0), 0)
      return [
        { label: 'Total Nilai Penjualan', value: formatRupiah(totalSales), tone: 'brand' },
        { label: 'Transaksi Selesai', value: `${rows.length} Sesi`, tone: 'green' },
        { label: 'Pelanggan Terlayani', value: `${totalPersons} Orang`, tone: 'brand' },
      ]
    }
    if (reportCode === 'packages') {
      const totalSessions = rows.reduce((sum, r) => sum + Number(r.sessions ?? 0), 0)
      const totalSales = rows.reduce((sum, r) => sum + Number(r.sales ?? 0), 0)
      const topPkg = rows.find((r) => Number(r.sessions) > 0)
      return [
        { label: 'Total Penjualan Paket', value: formatRupiah(totalSales), tone: 'brand' },
        { label: 'Total Sesi Selesai', value: `${totalSessions} Sesi`, tone: 'green' },
        { label: 'Paket Terlaris', value: topPkg ? topPkg.name : 'Belum ada', tone: 'brand' },
      ]
    }
    if (reportCode === 'cash') {
      const regularIn = cashSplit.regularRows.reduce((sum, r) => sum + Number(r.cash_in ?? 0), 0)
      const totalOut = rows.reduce((sum, r) => sum + Number(r.cash_out ?? 0), 0)
      const regularNet = cashSplit.regularRows.reduce((sum, r) => sum + Number(r.net ?? 0), 0)
      const cancelledNet = cashSplit.cancelledRows.reduce((sum, r) => sum + Number(r.net ?? 0), 0)
      return [
        {
          label: 'Penerimaan Bersih (Aktif/Selesai)',
          value: formatRupiah(regularNet),
          hint: `Masuk ${formatRupiah(regularIn)} · Refund ${formatRupiah(totalOut)}`,
          tone: 'green',
        },
        {
          label: 'Transaksi Dibatalkan (Ditahan)',
          value: formatRupiah(cancelledNet),
          hint: `${cashSplit.cancelledRows.length} pembayaran batal ditahan`,
          tone: 'brand',
        },
        {
          label: 'Total Penerimaan Kasir',
          value: formatRupiah(regularNet + cancelledNet),
          hint: 'Bersih setelah pengembalian kelebihan bayar',
          tone: 'brand',
        },
      ]
    }
    const doneVisits = rows.filter((r) => r.status === 'SELESAI').length
    const cancelledVisits = rows.filter((r) => r.status === 'DIBATALKAN').length
    return [
      { label: 'Total Kunjungan', value: `${rows.length} Kunjungan`, tone: 'brand' },
      { label: 'Selesai Foto', value: `${doneVisits} Kunjungan`, tone: 'green' },
      { label: 'Dibatalkan', value: `${cancelledVisits} Kunjungan`, tone: 'brand' },
    ]
  }, [reportCode, rows, cashSplit])

  const columnsByCode = useMemo(() => {
    if (reportCode === 'sales') {
      return [
        {
          key: 'transaction_no',
          header: 'No. Transaksi',
          render: (row) => <b className="text-brand-600">{row.transaction_no}</b>,
        },
        { key: 'customer_name', header: 'Pelanggan' },
        {
          key: 'package_name',
          header: 'Paket',
          render: (row) => row.package_name || '-',
        },
        {
          key: 'persons',
          header: 'Orang',
          align: 'center',
          render: (row) => `${row.persons ?? 0} org`,
        },
        {
          key: 'subtotal',
          header: 'Subtotal',
          align: 'right',
          render: (row) => formatRupiah(row.subtotal),
        },
        {
          key: 'total',
          header: 'Total Penjualan',
          align: 'right',
          render: (row) => <b className="text-slate-900">{formatRupiah(row.total)}</b>,
        },
        {
          key: 'completed_at',
          header: 'Waktu Selesai (WIB)',
          render: (row) => formatDateTime(row.completed_at),
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
          key: 'sessions',
          header: 'Jumlah Sesi Selesai',
          align: 'right',
          render: (row) => (
            <Badge tone={Number(row.sessions) > 0 ? 'green' : 'gray'}>
              {row.sessions} Sesi
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

    if (reportCode === 'cash') {
      return [
        {
          key: 'transaction_no',
          header: 'No. Transaksi',
          render: (row) => <b className="text-brand-600">{row.transaction_no}</b>,
        },
        {
          key: 'kind',
          header: 'Jenis',
          render: (row) => (
            <Badge tone={row.kind === 'REFUND' ? 'amber' : 'brand'}>
              {row.kind === 'REFUND' ? 'Refund' : 'Pembayaran'}
            </Badge>
          ),
        },
        {
          key: 'method',
          header: 'Metode',
          render: (row) => PAYMENT_METHOD_LABELS[row.method] ?? row.method,
        },
        {
          key: 'cash_in',
          header: 'Uang Masuk',
          align: 'right',
          render: (row) =>
            Number(row.cash_in) > 0 ? (
              <span className="font-medium text-emerald-700">{formatRupiah(row.cash_in)}</span>
            ) : (
              '-'
            ),
        },
        {
          key: 'cash_out',
          header: 'Refund / Keluar',
          align: 'right',
          render: (row) =>
            Number(row.cash_out) > 0 ? (
              <span className="font-medium text-red-600">{formatRupiah(row.cash_out)}</span>
            ) : (
              '-'
            ),
        },
        {
          key: 'net',
          header: 'Bersih',
          align: 'right',
          render: (row) => <b className="text-slate-900">{formatRupiah(row.net)}</b>,
        },
        {
          key: 'category',
          header: 'Kategori',
          render: (row) => {
            const cat = CASH_CATEGORY_BADGES[row.category] ?? {
              label: row.category,
              tone: 'gray',
            }
            return <Badge tone={cat.tone}>{cat.label}</Badge>
          },
        },
        {
          key: 'occurred_at',
          header: 'Waktu (WIB)',
          render: (row) => formatDateTime(row.occurred_at),
        },
      ]
    }

    // visits (L-04)
    return [
      {
        key: 'queue_label',
        header: 'Antrean',
        render: (row) => <b className="text-brand-600">{row.queue_label || '-'}</b>,
      },
      {
        key: 'customer_name',
        header: 'Pelanggan',
        render: (row) => (
          <div>
            <p className="font-semibold text-slate-800">{row.customer_name}</p>
            <p className="text-xs text-slate-500">
              {row.customer_type === CUSTOMER_TYPES.RESERVASI
                ? `Reservasi${row.appointment_at ? ` (${formatTime(row.appointment_at)})` : ''}`
                : 'Datang langsung'}
            </p>
          </div>
        ),
      },
      {
        key: 'service_date',
        header: 'Tanggal Layanan',
        render: (row) => formatDate(row.service_date),
      },
      {
        key: 'status',
        header: 'Status Kunjungan',
        render: (row) => (
          <div className="space-y-1">
            <Badge tone={VISIT_STATUS_TONES[row.status] ?? 'gray'}>
              {VISIT_STATUS_LABELS[row.status] ?? row.status}
            </Badge>
            {row.cancel_reason && (
              <p className="max-w-48 truncate text-[11px] text-red-600" title={row.cancel_reason}>
                Alasan: {row.cancel_reason}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'times',
        header: 'Rincian Waktu (WIB)',
        render: (row) => (
          <div className="text-xs text-slate-600">
            <span>Masuk: {formatTime(row.queue_entered_at)}</span>
            {' · '}
            <span>Mulai: {formatTime(row.started_at)}</span>
            {' · '}
            <span>Selesai: {formatTime(row.finished_at)}</span>
          </div>
        ),
      },
      {
        key: 'payment_status',
        header: 'Status Bayar',
        render: (row) => {
          const badge = PAYMENT_STATUS_BADGES[row.payment_status] ?? {
            label: row.payment_status,
            tone: 'gray',
          }
          return <Badge tone={badge.tone}>{badge.label}</Badge>
        },
      },
      {
        key: 'total',
        header: 'Total Tagihan',
        align: 'right',
        render: (row) => <b className="text-slate-900">{formatRupiah(row.total)}</b>,
      },
    ]
  }, [reportCode, rows])

  const errorMessage = error ? (ERROR_MESSAGES[error.code] ?? error.message) : null
  const rangeText =
    reportData.from && reportData.to
      ? reportData.from === reportData.to
        ? formatDate(reportData.from)
        : `${formatDate(reportData.from)} – ${formatDate(reportData.to)}`
      : null

  return (
    <>
      <PageHeader
        title="Laporan"
        code="T-08"
        description="Rekap laporan operasional dan keuangan Owner (L-01 s.d. L-04) beserta ekspor PDF dan Excel."
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
        {errorMessage && (
          <Alert variant="error" requestId={error?.status >= 500 ? error?.requestId : null}>
            {errorMessage}
          </Alert>
        )}

        {/* Pilihan Jenis Laporan L-01 s.d. L-04 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegmentedControl
            label="Jenis laporan"
            tone="brand"
            options={REPORT_OPTIONS}
            value={reportCode}
            onChange={handleReportCodeChange}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
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
        <div className="grid gap-4 sm:grid-cols-3">
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
              ? `Periode: ${rangeText} (WIB) · Menampilkan ${
                  reportCode === 'cash' ? cashSplit.regularRows.length : rows.length
                } baris`
              : 'Memuat data laporan...'
          }
          actions={
            <Badge tone="brand">
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
            <Table
              columns={columnsByCode}
              rows={reportCode === 'cash' ? cashSplit.regularRows : rows}
              rowKey={reportCode === 'packages' ? 'package_id' : reportCode === 'sales' ? 'transaction_no' : 'id'}
              empty="Belum ada data pada periode ini."
            />
          )}
        </Card>

        {/* Tabel Terpisah untuk L-03: Uang dari Transaksi Dibatalkan (BATAL_DITAHAN) */}
        {reportCode === 'cash' && !loading && (
          <Card
            title="Penerimaan dari Transaksi Dibatalkan (Ditahan)"
            description="Pembayaran dari kunjungan yang dibatalkan sebelum sesi foto dimulai. Ditampilkan terpisah karena bukan merupakan nilai penjualan sesi selesai."
            actions={
              <Badge tone="red">
                {cashSplit.cancelledRows.length} Transaksi Batal
              </Badge>
            }
          >
            <Table
              columns={columnsByCode}
              rows={cashSplit.cancelledRows}
              rowKey="id"
              empty="Tidak ada penerimaan dari transaksi dibatalkan pada periode ini."
            />
          </Card>
        )}
      </div>
    </>
  )
}
