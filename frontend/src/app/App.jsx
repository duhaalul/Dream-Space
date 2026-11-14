import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { HOME_BY_ROLE } from '@/shared/utils/constants'
import AppLayout from './AppLayout'
import NotFoundPage from './NotFoundPage'
import PageLoading from './PageLoading'
import ProtectedRoute from './ProtectedRoute'
import { appRoutes } from './routes'

// Halaman contoh komponen, hanya saat `npm run dev` (tidak ikut build produksi).
const ComponentsPreviewPage = import.meta.env.DEV ? lazy(() => import('./ComponentsPreviewPage')) : null

const publicRoutes = appRoutes.filter((route) => route.public)
const privateRoutes = appRoutes.filter((route) => !route.public)

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={HOME_BY_ROLE[user.role] ?? '/profil'} replace />
}

export default function App() {
  return (
    <Routes>
      {publicRoutes.map(({ path, component: Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <Suspense fallback={<PageLoading />}>
              <Page />
            </Suspense>
          }
        />
      ))}

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        {privateRoutes.map(({ path, component: Page, roles }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute roles={roles}>
                <Page />
              </ProtectedRoute>
            }
          />
        ))}
      </Route>

      {ComponentsPreviewPage && (
        <Route
          path="/dev/komponen"
          element={
            <Suspense fallback={<PageLoading />}>
              <ComponentsPreviewPage />
            </Suspense>
          }
        />
      )}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
