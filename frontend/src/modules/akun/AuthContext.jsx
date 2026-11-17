import { useCallback, useEffect, useMemo, useState } from 'react'
import { restoreAuthToken, setAuthToken, setUnauthorizedHandler } from '@/shared/api/client'
import * as akunApi from './api'
import { AuthContext } from './useAuth'

// Token disimpan per tab (sessionStorage): reload tetap login, tutup tab/browser = logout.
// Saat halaman dibuka, token tersimpan dicek ke backend (GET /auth/me) sebelum halaman tampil.
// Sesi juga berakhir otomatis di backend setelah 30 menit tidak aktif (NFR-08);
// request berikutnya mendapat 401 lalu pengguna diarahkan ke halaman Login.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Pesan untuk halaman Login, mis. "Sesi berakhir" atau "Kata sandi berhasil diganti".
  const [notice, setNotice] = useState(null)
  // true selama token tersimpan sedang dicek ke backend (App menampilkan "Memuat…").
  const [restoring, setRestoring] = useState(() => restoreAuthToken())

  const clearSession = useCallback((message = null) => {
    setAuthToken(null)
    setUser(null)
    setNotice(message)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession('Sesi berakhir. Silakan login ulang.'))
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Pulihkan sesi setelah reload (sekali saat aplikasi dibuka).
  useEffect(() => {
    if (!restoring) return undefined
    let active = true
    akunApi
      .getMe()
      .then((me) => {
        if (active) setUser(me)
      })
      .catch((error) => {
        if (!active) return
        if (error?.status === 401) clearSession('Sesi berakhir. Silakan login ulang.')
        // Server tidak terjangkau: token tetap disimpan supaya bisa dicoba lagi dengan reload.
        else setNotice('Tidak dapat terhubung ke server. Coba muat ulang halaman.')
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    return () => {
      active = false
    }
    // Hanya saat pertama dibuka; login/logout berikutnya tidak memakai jalur ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (username, password) => {
    const result = await akunApi.login(username, password)
    setAuthToken(result.token)
    setNotice(null)
    setUser(result.user)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await akunApi.logout()
    } catch {
      // Sesi mungkin sudah berakhir di server; tetap bersihkan di browser.
    } finally {
      clearSession()
    }
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    const me = await akunApi.getMe()
    setUser(me)
    return me
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, restoring, notice, login, logout, clearSession, refreshUser }),
    [user, restoring, notice, login, logout, clearSession, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
