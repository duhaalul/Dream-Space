import { lazy } from 'react'
import { History, UserPlus } from 'lucide-react'
import { ROLES } from '@/shared/utils/constants'

const RegistrationPage = lazy(() => import('./pages/RegistrationPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))

export const kasirRoutes = [
  // Pendaftaran = daftar + bayar lunas di awal (halaman pertama Admin).
  {
    path: '/pendaftaran',
    component: RegistrationPage,
    roles: [ROLES.ADMIN],
    menu: { label: 'Pendaftaran', order: 5, icon: UserPlus },
  },
  {
    path: '/riwayat',
    component: HistoryPage,
    roles: [ROLES.ADMIN, ROLES.OWNER],
    menu: { label: 'Riwayat', order: 40, icon: History },
  },
]
