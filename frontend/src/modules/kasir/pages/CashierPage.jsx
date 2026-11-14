import { useParams } from 'react-router'
import { PageHeader, TodoCard } from '@/shared/components/ui'

// T-05 Kasir — Admin.
// /kasir → daftar pelanggan aktif. /kasir/:id → pelanggan (kunjungan) :id terpilih.
export default function CashierPage() {
  const { id } = useParams()

  return (
    <>
      <PageHeader
        title="Kasir"
        code="T-05"
        description={id ? `Tagihan kunjungan #${id}.` : 'Pilih pelanggan aktif untuk melihat tagihannya.'}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <TodoCard
          title="Pelanggan aktif"
          items={[
            'Daftar dari getActiveVisits({ date: todayWib(), search }).',
            'Kolom pencarian nama panggilan.',
            'Klik pelanggan → navigasi ke /kasir/:id.',
          ]}
        />
        <TodoCard
          title="Rincian tagihan"
          items={[
            'getCashierDetail(id): items aktif (is_active=1) dan balance { paid, net, due, surplus }.',
            'Tambahan selama sesi: setTransactionAddons().',
            'Konfirmasi akhir sesi: jumlah orang akhir + seluruh tambahan.',
          ]}
        />
        <TodoCard
          title="Pembayaran"
          items={[
            'addPayment(): Tunai/Transfer/QRIS; tunai = uang diserahkan, tampilkan kembalian.',
            'Tagihan awal harus lunas sebelum Mulai foto; tambahan selama sesi dibayar di akhir.',
            '"Selesaikan & Cetak Nota" → finishVisit(); tombol nonaktif selama masih ada sisa tagihan.',
            'Kembalikan kelebihan bayar: addRefund().',
            'Setelah Selesai: downloadReceipt() lalu openBlob() untuk mencetak nota.',
            'client_request_id dari newRequestId() untuk setiap pembayaran/refund.',
          ]}
        />
      </div>
    </>
  )
}
