import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Power } from 'lucide-react'
import logoDs from '@/assets/logo-ds.png'
import { useAuth } from '@/modules/akun/useAuth'
import { ROLE_LABELS } from '@/shared/utils/constants'
import PageLoading from './PageLoading'
import { menuFor } from './routes'

// Gradien biru → cyan → hijau sesuai desain Figma.
const BRAND_GRADIENT = 'from-brand-500 via-cyan-500 to-emerald-500'

// Kerangka halaman setelah login.
// Layar lebar (≥1024px): menu samping. HP/tablet: bilah atas + menu yang bisa digeser (NFR-03).
export default function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const menu = menuFor(user.role)
  const displayName = user.name || ROLE_LABELS[user.role]
  const initial = displayName.trim().charAt(0).toUpperCase()

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Menu samping — layar lebar */}
      <aside
        className={`relative hidden shrink-0 overflow-hidden rounded-r-[2rem] bg-linear-to-b text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 ${BRAND_GRADIENT}`}
      >
        <span aria-hidden="true" className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-white/15" />
        <span aria-hidden="true" className="absolute top-1/3 -right-24 h-64 w-48 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute bottom-20 -left-24 h-56 w-40 rounded-full bg-white/10" />

        <div className="relative flex w-full flex-col px-5 py-6">
          <img src={logoDs} alt="Dream Space" className="ml-2 w-20" />

          <div className="mt-8 flex items-center gap-3 border-b border-white/30 pb-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-brand-600">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-white/85">Selamat datang,</p>
              <p className="truncate font-bold">{displayName}</p>
            </div>
          </div>

          <nav aria-label="Menu utama" className="mt-5 flex flex-1 flex-col gap-1.5">
            {menu.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-white font-bold text-brand-600 shadow-sm' : 'text-white hover:bg-white/15'
                  }`
                }
              >
                {Icon && <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />}
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/30 pt-4">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/15 disabled:opacity-60"
            >
              <Power aria-hidden="true" className="h-5 w-5" />
              {loggingOut ? 'Keluar…' : 'Keluar'}
            </button>
          </div>
        </div>
      </aside>

      {/* Bilah atas — HP dan tablet */}
      <header className={`sticky top-0 z-30 bg-linear-to-r text-white shadow-md lg:hidden ${BRAND_GRADIENT}`}>
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoDs} alt="Dream Space" className="h-9 w-auto" />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-white/85">Selamat datang,</p>
              <p className="truncate text-sm font-bold">{displayName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Keluar"
            className="rounded-full p-2 transition-colors hover:bg-white/15 disabled:opacity-60"
          >
            <Power aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Menu" className="flex gap-1.5 overflow-x-auto px-3 pb-3">
          {menu.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white font-bold text-brand-600' : 'bg-white/15 text-white hover:bg-white/25'
                }`
              }
            >
              {Icon && <Icon aria-hidden="true" className="h-4 w-4" />}
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
