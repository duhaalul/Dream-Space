import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { Button } from '@/shared/components/ui'
import { ROLE_LABELS } from '@/shared/utils/constants'
import PageLoading from './PageLoading'
import { menuFor } from './routes'

// Kerangka halaman setelah login. Komputer: menu di samping.
// HP: menu menjadi baris yang bisa digeser di bawah judul (halaman Owner, NFR-03).
export default function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const menu = menuFor(user.role)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  const logoutButton = (className) => (
    <Button variant="ghost" loading={loggingOut} onClick={handleLogout} className={className}>
      Keluar
    </Button>
  )

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div>
            <p className="text-lg font-semibold text-indigo-700">Dream Space</p>
            <p className="text-xs text-slate-500">
              {user.name} · {ROLE_LABELS[user.role]}
            </p>
          </div>
          {logoutButton('md:hidden')}
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:px-3">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200 p-3 md:block">{logoutButton('w-full')}</div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
