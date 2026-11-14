import { lazy } from 'react'
import { UsersRound } from 'lucide-react'
import { ROLES } from '@/shared/utils/constants'

const QueuePage = lazy(() => import('./pages/QueuePage'))

// Form pendaftaran dan detail kunjungan ada di dalam halaman Antrean (tab & modal).
export const antreanRoutes = [
  {
    path: '/antrean',
    component: QueuePage,
    roles: [ROLES.ADMIN, ROLES.OWNER],
    menu: { label: 'Antrean', order: 20, icon: UsersRound },
  },
]
