import { useState } from 'react'
import { Alert, Button, Input } from '@/shared/components/ui'
import { resetAdminPassword } from '../api'
import { validateNewPassword } from '../passwordRules'

// Dipakai di Profil (T-11), Owner saja (UC-24).
// Admin wajib mengganti kata sandi sementara ini saat login berikutnya.
export default function ResetAdminPasswordForm() {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const message = validateNewPassword(form.password, form.confirm)
    if (message) {
      setError({ message })
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await resetAdminPassword(form.password)
      setForm({ password: '', confirm: '' })
      setSuccess(true)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <Alert variant="success">
          Kata sandi sementara Admin sudah dibuat. Berikan kepada Admin; Admin wajib menggantinya saat login.
        </Alert>
      )}
      {error && (
        <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
          {error.message}
        </Alert>
      )}
      <Input
        label="Kata sandi sementara"
        type="password"
        value={form.password}
        onChange={update('password')}
        autoComplete="new-password"
        hint="Minimal 12 karakter."
        required
      />
      <Input
        label="Ulangi kata sandi sementara"
        type="password"
        value={form.confirm}
        onChange={update('confirm')}
        autoComplete="new-password"
        required
      />
      <Button type="submit" variant="danger" loading={loading}>
        Reset kata sandi Admin
      </Button>
    </form>
  )
}
