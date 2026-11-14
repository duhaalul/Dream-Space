import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

// { user, isAuthenticated, notice, login, logout, clearSession, refreshUser }
// user: { id, name, username, role: 'ADMIN' | 'OWNER', must_change_password }
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return context
}
