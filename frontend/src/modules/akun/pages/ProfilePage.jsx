import { Alert, Card, PageHeader } from '@/shared/components/ui'
import { ROLE_LABELS, ROLES } from '@/shared/utils/constants'
import ChangePasswordForm from '../components/ChangePasswordForm'
import ResetAdminPasswordForm from '../components/ResetAdminPasswordForm'
import { useAuth } from '../useAuth'

// T-11 Profil — Admin dan Owner.
// Setiap akun mengganti kata sandinya sendiri di sini.
// Owner juga bisa mereset kata sandi Admin (UC-24), mis. saat Admin lupa kata sandi.
export default function ProfilePage() {
  const { user, clearSession } = useAuth()
  const isOwner = user.role === ROLES.OWNER

  return (
    <>
      <PageHeader title="Profil" code="T-11" description="Informasi akun dan ganti kata sandi." />

      {user.must_change_password && (
        <Alert variant="warning" className="mb-6">
          Akun ini memakai kata sandi sementara. Ganti kata sandi terlebih dahulu sebelum memakai menu lain.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Informasi akun">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Nama</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nama pengguna</dt>
              <dd className="font-medium">{user.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Peran</dt>
              <dd className="font-medium">{ROLE_LABELS[user.role]}</dd>
            </div>
          </dl>
          {/* TODO: ubah nama tampilan lewat updateProfile() di ../api */}
        </Card>

        <Card title="Ganti kata sandi">
          <ChangePasswordForm
            onChanged={() => clearSession('Kata sandi berhasil diganti. Silakan login dengan kata sandi baru.')}
          />
        </Card>

        {isOwner && !user.must_change_password && (
          <Card title="Reset kata sandi Admin">
            <ResetAdminPasswordForm />
          </Card>
        )}
      </div>
    </>
  )
}
