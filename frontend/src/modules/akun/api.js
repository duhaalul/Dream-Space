// Modul Akun dan Pengaturan — endpoint /auth/* (docs/API.md bagian Autentikasi).
import { api } from '@/shared/api/client'

// → { token, user: { id, name, username, role, must_change_password } }
export const login = (username, password) => api.post('/auth/login', { username, password })

export const getMe = () => api.get('/auth/me')

export const logout = () => api.post('/auth/logout')

// Berhasil → SEMUA sesi dicabut, pengguna harus login ulang.
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })

export const updateProfile = (name) => api.patch('/auth/profile', { name })

// Owner saja. Admin wajib mengganti kata sandi sementara saat login berikutnya.
export const resetAdminPassword = (temporaryPassword) =>
  api.post('/auth/reset-admin-password', { temporary_password: temporaryPassword })
