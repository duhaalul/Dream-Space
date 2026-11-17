import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Alert, Button, PasswordInput } from '@/shared/components/ui'
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
      <PasswordInput
        label="Kata sandi saat ini"
        value={form.current}
        onChange={update('current')}
        autoComplete="current-password"
        required
      />
      <PasswordInput
        label="Kata sandi baru"
        value={form.next}
        onChange={update('next')}
        autoComplete="new-password"
        hint="Minimal 12 karakter."
        required
      />
      <PasswordInput
        label="Ulangi kata sandi baru"
        value={form.confirm}
        onChange={update('confirm')}
        autoComplete="new-password"
        required
      />
      <Button type="submit" loading={loading}>
        {!loading && <KeyRound aria-hidden="true" className="h-4 w-4" />} Ganti kata sandi
      </Button>
    </form>
  )
}
