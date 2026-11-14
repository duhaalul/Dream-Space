import { useCallback, useEffect, useMemo, useState } from 'react'
import { setAuthToken, setUnauthorizedHandler } from '@/shared/api/client'
import * as akunApi from './api'
import { AuthContext } from './useAuth'

// Token hanya di memori: reload halaman = login ulang (saran docs/API.md).
// Sesi juga berakhir otomatis di backend setelah 30 menit tidak aktif (NFR-08);
// request berikutnya mendapat 401 lalu pengguna diarahkan ke halaman Login.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Pesan untuk halaman Login, mis. "Sesi berakhir" atau "Kata sandi berhasil diganti".
  const [notice, setNotice] = useState(null)

  const clearSession = useCallback((message = null) => {
    setAuthToken(null)
    setUser(null)
    setNotice(message)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession('Sesi berakhir. Silakan login ulang.'))
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

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
    () => ({ user, isAuthenticated: user !== null, notice, login, logout, clearSession, refreshUser }),
    [user, notice, login, logout, clearSession, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
