import { useState } from 'react'
import { Wallet } from 'lucide-react'
import {
  Alert,
  Badge,
  BrandLogo,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  SegmentedControl,
  Select,
  StatCard,
  Table,
} from '@/shared/components/ui'
import { REPORT_PERIODS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'

// HANYA SAAT DEVELOPMENT: contoh semua komponen dasar di /dev/komponen.
// Tidak ikut ke hasil build produksi.
const PERIOD_OPTIONS = Object.entries(REPORT_PERIODS).map(([value, label]) => ({ value, label }))
const METHOD_OPTIONS = [
  { value: 'TUNAI', label: 'Tunai' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'QRIS', label: 'QRIS' },
]
const SAMPLE_ROWS = [
  { id: 1, no: 'RG-001', name: 'Eko', package: 'Reguler · Latar Putih', total: 110000 },
  { id: 2, no: 'WD-001', name: 'Putra', package: 'Wide Studio · Latar Putih', total: 180000 },
]

export default function ComponentsPreviewPage() {
  const [period, setPeriod] = useState('today')
  const [method, setMethod] = useState('TUNAI')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Komponen"
        description="Contoh komponen dasar dari @/shared/components/ui (hanya saat development)."
        actions={<SegmentedControl label="Periode" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nilai Penjualan" value="Rp540.000" hint="Periode terpilih" />
        <StatCard tone="green" label="Sesi Selesai" value="3 Sesi" hint="✓ 11 pelanggan terlayani" />
        <StatCard label="Penerimaan Kasir" value="Rp800.000" hint="Tunai Rp570rb · Non-tunai Rp230rb" icon={Wallet} />
        <StatCard label="Paket Terlaris" value="Reguler (RG)" hint="1 sesi selesai" />
      </div>

      <Card title="Button" description='variant="..." · size="sm" | "md" | "lg" · loading'>
        <div className="flex flex-wrap gap-2">
          <Button>primary</Button>
          <Button variant="success">success</Button>
          <Button variant="warning">warning</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="soft">soft</Button>
          <Button variant="soft-success">soft-success</Button>
          <Button variant="danger">danger</Button>
          <Button variant="neutral">neutral</Button>
          <Button variant="ghost">ghost</Button>
          <Button loading>loading</Button>
          <Button size="sm" variant="soft">size sm</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Input, Select, SegmentedControl">
          <div className="space-y-4">
            <Input label="Uang Diterima (Rp)" placeholder="Rp150.000" hint="Isi uang yang diserahkan pelanggan." />
            <Input label="Nama panggilan" defaultValue="" error="Nama panggilan wajib diisi." />
            <Select label="Paket" placeholder="Pilih paket" options={[{ value: 1, label: 'Reguler Studio (RG)' }]} />
            <SegmentedControl label="Metode bayar" tone="brand" options={METHOD_OPTIONS} value={method} onChange={setMethod} />
          </div>
        </Card>

        <Card title="Badge, Alert, Modal, BrandLogo">
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Kosong</Badge>
            <Badge tone="amber">Belum Lunas</Badge>
            <Badge tone="green">DP Rp50.000</Badge>
            <Badge tone="red">Belum Dibayar</Badge>
            <Badge tone="gray">Dilewati</Badge>
          </div>
          <div className="mt-4 space-y-2">
            <Alert variant="error" requestId="contoh-123">Gagal menyimpan. Coba lagi.</Alert>
            <Alert variant="success">Pembayaran tersimpan.</Alert>
            <Alert variant="warning">Tagihan awal belum lunas.</Alert>
            <Alert variant="info">Data berubah di komputer lain.</Alert>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Buka Modal
            </Button>
            <BrandLogo size="sm" />
            <BrandLogo size="md" />
          </div>
        </Card>
      </div>

      <Card
        title="Table"
        description="columns + rows; render untuk isi khusus"
        actions={
          <>
            <Button size="sm" variant="danger">Unduh PDF</Button>
            <Button size="sm" variant="soft-success">Unduh Excel</Button>
          </>
        }
      >
        <Table
          columns={[
            { key: 'no', header: 'No', render: (row) => <b className="text-brand-600">{row.no}</b> },
            { key: 'name', header: 'Pelanggan' },
            { key: 'package', header: 'Paket & Latar' },
            { key: 'total', header: 'Total Tagihan', align: 'right', render: (row) => <b>{formatRupiah(row.total)}</b> },
          ]}
          rows={SAMPLE_ROWS}
        />
      </Card>

      <Modal
        open={modalOpen}
        title="Contoh Modal"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="neutral" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button variant="success" onClick={() => setModalOpen(false)}>Simpan</Button>
          </>
        }
      >
        <Input label="Alasan" placeholder="Tulis alasan" />
      </Modal>
    </div>
  )
}
