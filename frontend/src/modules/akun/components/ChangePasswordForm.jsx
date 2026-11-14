import { useState } from 'react'
import { Alert, Button, Input } from '@/shared/components/ui'
import { changePassword } from '../api'
import { validateNewPassword } from '../passwordRules'

// Dipakai di Profil (T-11). Setelah berhasil, backend mencabut semua sesi,
// jadi onChanged() harus mengeluarkan pengguna ke halaman Login.
export default function ChangePasswordForm({ onChanged }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const message = validateNewPassword(form.next, form.confirm)
    if (message) {
      setError({ message })
      return
    }
    setLoading(true)
    setError(null)
    try {
      await changePassword(form.current, form.next)
      onChanged?.()
    } catch (err) {
      // Isian tidak dikosongkan supaya pengguna bisa memperbaiki (docs/API.md).
      setError(err)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
          {error.message}
        </Alert>
      )}
      <Input
        label="Kata sandi saat ini"
        type="password"
        value={form.current}
        onChange={update('current')}
        autoComplete="current-password"
        required
      />
      <Input
        label="Kata sandi baru"
        type="password"
        value={form.next}
        onChange={update('next')}
        autoComplete="new-password"
        hint="Minimal 12 karakter."
        required
      />
      <Input
        label="Ulangi kata sandi baru"
        type="password"
        value={form.confirm}
        onChange={update('confirm')}
        autoComplete="new-password"
        required
      />
      <Button type="submit" loading={loading}>
        Ganti kata sandi
      </Button>
    </form>
  )
}
