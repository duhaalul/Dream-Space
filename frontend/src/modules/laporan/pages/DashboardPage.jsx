import { PageHeader, TodoCard } from '@/shared/components/ui'

// T-02 Dashboard — Owner. Harus nyaman dibuka di HP (NFR-03).
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" code="T-02" description="Ringkasan penjualan dan penerimaan." />

      <TodoCard
        title="Dashboard ringkasan"
        items={[
          'Pilihan periode: Hari ini, Minggu ini, Bulan ini, Rentang tanggal (REPORT_PERIODS).',
          'Data dari getDashboard({ period, from, to }).',
          'Kartu: nilai penjualan, jumlah sesi selesai, penerimaan, paket terlaris.',
          'Grafik penjualan memakai Recharts (ResponsiveContainer supaya pas di HP).',
        ]}
      />
    </>
  )
}
