import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { HOME_BY_ROLE } from '@/shared/utils/constants'

const CHANGE_PASSWORD_PATH = '/profil'

// Penjaga halaman: wajib login, wajib ganti kata sandi sementara, dan cek peran.
// Ini hanya untuk tampilan; hak akses sebenarnya tetap diperiksa backend (NFR-01).
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (user.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? CHANGE_PASSWORD_PATH} replace />
  }
  return children
}
