import { lazy } from 'react'
import { CreditCard, History } from 'lucide-react'
import { ROLES } from '@/shared/utils/constants'

const CashierPage = lazy(() => import('./pages/CashierPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))

export const kasirRoutes = [
  // /kasir = daftar pelanggan aktif; /kasir/:id = pelanggan terpilih (mis. dari tombol di Antrean).
  {
    path: '/kasir/:id?',
    component: CashierPage,
    roles: [ROLES.ADMIN],
    menu: { label: 'Kasir', order: 30, to: '/kasir', icon: CreditCard },
  },
  {
    path: '/riwayat',
    component: HistoryPage,
    roles: [ROLES.ADMIN, ROLES.OWNER],
    menu: { label: 'Riwayat', order: 40, icon: History },
  },
]
