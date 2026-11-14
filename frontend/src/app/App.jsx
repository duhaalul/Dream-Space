import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { HOME_BY_ROLE } from '@/shared/utils/constants'
import AppLayout from './AppLayout'
import NotFoundPage from './NotFoundPage'
import PageLoading from './PageLoading'
import ProtectedRoute from './ProtectedRoute'
import { appRoutes } from './routes'

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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
