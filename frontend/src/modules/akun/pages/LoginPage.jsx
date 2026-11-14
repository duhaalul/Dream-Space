import { useId, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ArrowRight, CircleAlert, Eye, EyeOff, Info, Lock, UsersRound } from 'lucide-react'
import { BrandLogo } from '@/shared/components/ui'
import { HOME_BY_ROLE } from '@/shared/utils/constants'
import LoginBrandPanel from '../components/LoginBrandPanel'
import { useAuth } from '../useAuth'

const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Nama pengguna atau kata sandi tidak cocok. Silakan coba lagi.',
}

function LoginField({ label, icon: Icon, trailing, ...inputProps }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-slate-600">
        {label}
      </label>
      <div className="relative">
        <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-brand-600" />
        <input
          id={id}
          className="w-full rounded-2xl border border-brand-200 bg-brand-100 py-3.5 pr-12 pl-12 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          {...inputProps}
        />
        {trailing && <div className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  )
}

// T-01 Login — Admin dan Owner.
export default function LoginPage() {
  const { user, notice, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Setelah login berhasil, arahkan ke halaman yang tadi dibuka atau halaman awal peran.
  if (user) {
    const destination = user.must_change_password
      ? '/profil'
      : (location.state?.from ?? HOME_BY_ROLE[user.role] ?? '/profil')
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err)
      setLoading(false)
    }
  }

  const errorMessage = error ? (ERROR_MESSAGES[error.code] ?? error.message) : null

  return (
    <div className="flex min-h-screen bg-white">
      <main className="flex w-full flex-col px-6 py-10 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-lg flex-1">
          <BrandLogo size="md" />
          <h1 className="mt-8 text-2xl font-bold text-slate-800 sm:text-3xl">Selamat Datang Kembali</h1>
          <p className="mt-2 text-sm text-slate-500">Masuk untuk mengelola antrean, kasir &amp; operasional studio</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <LoginField
              label="Nama Pengguna"
              icon={UsersRound}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Masukkan nama pengguna"
              autoFocus
              required
            />
            <LoginField
              label="Kata Sandi"
              icon={Lock}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Masukkan kata sandi"
              required
              trailing={
                // Ikon menunjukkan keadaan: mata terbuka = kata sandi terlihat, mata silang = tersembunyi.
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-200/60"
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand-500 to-brand-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses…
                </>
              ) : (
                <>
                  Masuk Sekarang <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </>
              )}
            </button>

            {errorMessage && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-700">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{errorMessage}</p>
                  {error.status >= 500 && error.requestId && (
                    <p className="mt-1 text-xs opacity-75">Kode laporan: {error.requestId}</p>
                  )}
                </div>
              </div>
            )}
            {notice && !errorMessage && (
              <div role="status" className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{notice}</p>
              </div>
            )}
          </form>
        </div>

        <p className="mx-auto mt-10 flex w-full max-w-lg items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
          Sistem Operasional Aktif · Studio Buka Setiap Hari (09.00 – 21.00 WIB)
        </p>
      </main>

      <LoginBrandPanel />
    </div>
  )
}
