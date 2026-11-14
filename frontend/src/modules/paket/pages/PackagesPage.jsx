import { useAuth } from '@/modules/akun/useAuth'
import { Card, PageHeader, TodoCard } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import AddonManager from '../components/AddonManager'
import PackageForm from '../components/PackageForm'

// T-07 Kelola Paket — Owner mengelola paket dan tambahan layanan, Admin hanya melihat paket.
export default function PackagesPage() {
  const { user } = useAuth()
  const isOwner = user.role === ROLES.OWNER

  return (
    <>
      <PageHeader
        title={isOwner ? 'Kelola Paket' : 'Paket'}
        code="T-07"
        description="Daftar paket, harga, kapasitas, latar, dan tambahan yang tersedia."
      />

      <div className="space-y-6">
        <TodoCard
          title="Daftar paket"
          items={[
            'Ambil data dengan getPackages() → { packages, backgrounds, allowed_addons }.',
            'Tampilkan nama, kode antrean, harga, kapasitas, latar, status aktif/nonaktif, dan status ruangan.',
            'Paket tidak dihapus, hanya dinonaktifkan.',
            'Admin: hanya melihat, tanpa tombol ubah.',
          ]}
        />

        {isOwner && (
          <>
            <PackageForm />
            <Card title="Tambahan layanan">
              <AddonManager />
            </Card>
          </>
        )}
      </div>
    </>
  )
}
