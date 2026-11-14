import { lazy } from 'react'
import { ChartColumn, LayoutDashboard } from 'lucide-react'
import { ROLES } from '@/shared/utils/constants'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))

export const laporanRoutes = [
  {
    path: '/dashboard',
    component: DashboardPage,
    roles: [ROLES.OWNER],
    menu: { label: 'Dashboard', order: 10, icon: LayoutDashboard },
  },
  {
    path: '/laporan',
    component: ReportsPage,
    roles: [ROLES.OWNER],
    menu: { label: 'Laporan', order: 60, icon: ChartColumn },
  },
]
