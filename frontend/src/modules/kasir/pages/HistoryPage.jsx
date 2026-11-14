import { useAuth } from '@/modules/akun/useAuth'
import { PageHeader, TodoCard } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'

// T-06 Riwayat transaksi — Admin (lihat + koreksi), Owner (lihat).
export default function HistoryPage() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN

  return (
    <>
      <PageHeader title="Riwayat" code="T-06" description="Transaksi Selesai dan Dibatalkan." />

      <div className="grid gap-6 lg:grid-cols-2">
        <TodoCard
          title="Daftar transaksi"
          items={[
            'Daftar dari getHistory({ page, search, from, to }), maksimal 100 per halaman.',
            'Pencarian berdasarkan nama panggilan dan rentang tanggal.',
            'Riwayat koreksi tiap transaksi: getAudit(transactionId).',
            'Cetak ulang nota: downloadReceipt() + openBlob().',
          ]}
        />
        {isAdmin && (
          <TodoCard
            title="Koreksi data transaksi"
            items={[
              'Perbaiki salah input lewat addCorrection(); pembayaran tidak dihapus.',
              'Alasan wajib bila transaksi sudah lunas.',
              'Owner hanya melihat riwayat koreksinya.',
            ]}
          />
        )}
      </div>
    </>
  )
}
