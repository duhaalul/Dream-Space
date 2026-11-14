import { PageHeader, TodoCard } from '@/shared/components/ui'

// T-08 Laporan — Owner.
export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Laporan" code="T-08" description="Laporan L-01 sampai L-04 per periode." />

      <TodoCard
        title="Laporan per periode"
        items={[
          'Pilih laporan (REPORT_CODES di ../api) dan periode.',
          'Tampilkan tabel dari getReport(code, { period, from, to }).',
          'Unduh: downloadReport(code, "pdf" | "xlsx", params) lalu saveBlob().',
          'L-03: uang dari transaksi Dibatalkan ditampilkan terpisah (BATAL_DITAHAN).',
        ]}
      />
    </>
  )
}
