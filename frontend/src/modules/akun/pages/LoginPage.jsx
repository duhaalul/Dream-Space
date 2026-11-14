import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Alert, Button, Input } from '@/shared/components/ui'
import { HOME_BY_ROLE } from '@/shared/utils/constants'
import { useAuth } from '../useAuth'

// T-01 Login — Admin dan Owner.
export default function LoginPage() {
  const { user, notice, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-indigo-700">Dream Space</h1>
          <p className="mt-1 text-sm text-slate-500">Sistem Informasi Kasir dan Antrean</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {notice && !error && <Alert variant="info">{notice}</Alert>}
          {error && (
            <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
              {error.message}
            </Alert>
          )}

          <Input
            label="Nama pengguna"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <Input
            label="Kata sandi"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            Masuk
          </Button>
        </form>
      </div>
    </div>
  )
}
