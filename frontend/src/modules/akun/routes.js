import { lazy } from 'react'
import { ROLES } from '@/shared/utils/constants'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

// public: bisa dibuka tanpa login. roles: peran yang boleh membuka.
// menu: tampil di menu samping (urut berdasarkan order).
export const akunRoutes = [
  { path: '/login', component: LoginPage, public: true },
  {
    path: '/profil',
    component: ProfilePage,
    roles: [ROLES.ADMIN, ROLES.OWNER],
    menu: { label: 'Profil', order: 90 },
  },
]
