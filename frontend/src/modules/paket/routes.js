import { lazy } from 'react'
import { Package } from 'lucide-react'
import { ROLES } from '@/shared/utils/constants'

const PackagesPage = lazy(() => import('./pages/PackagesPage'))

export const paketRoutes = [
  {
    path: '/paket',
    component: PackagesPage,
    roles: [ROLES.ADMIN, ROLES.OWNER],
    // Label menu berbeda per peran.
    menu: { label: { ADMIN: 'Paket', OWNER: 'Kelola Paket' }, order: 50, icon: Package },
  },
]
