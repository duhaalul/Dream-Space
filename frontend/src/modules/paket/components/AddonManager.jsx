import { useEffect, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Alert, Badge, Button, Input } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'
import { createAddon, getAddons, updateAddon } from '../api'

const EMPTY_ADDON = {
  name: '',
  price: '',
  unit: '',
}

// Kelola tambahan layanan (UC-05), Owner saja.
// Dipakai di halaman Kelola Paket.
export default function AddonManager({ addons: externalAddons, onChanged }) {
  const [internalAddons, setInternalAddons] = useState([])
  const addons = externalAddons ?? internalAddons

  const [form, setForm] = useState(EMPTY_ADDON)
  const [fieldErrors, setFieldErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', price: '', unit: '', is_active: true })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (externalAddons !== undefined) return
    getAddons()
      .then((list) => setInternalAddons(list ?? []))
      .catch((err) => setError(err))
  }, [externalAddons])

  async function notifyChanged() {
    if (onChanged) {
      await onChanged()
    } else {
      const list = await getAddons()
      setInternalAddons(list ?? [])
    }
  }

  function validateAddonInput(input) {
    const errors = {}
    const name = String(input.name ?? '').trim()
    const unit = String(input.unit ?? '').trim()
    const rawPrice = String(input.price ?? '').trim()
    const price = rawPrice === '' ? NaN : Number(rawPrice)

    if (!name) errors.name = 'Nama tambahan wajib diisi.'
    if (!Number.isInteger(price) || price < 0) {
      errors.price = 'Harga wajib berupa angka bulat minimal 0.'
    }
    if (!unit) errors.unit = 'Satuan wajib diisi (mis. 5 menit, lembar).'

    return {
      errors,
      payload:
        Object.keys(errors).length === 0
          ? { name, price, unit, is_active: input.is_active ?? true }
          : null,
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    const { errors, payload } = validateAddonInput({ ...form, is_active: true })
    setFieldErrors(errors)
    if (!payload) return

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const created = await createAddon(payload)
      setForm(EMPTY_ADDON)
      setSuccess(`Tambahan "${created.name}" (${formatRupiah(created.price)} per ${created.unit}) berhasil ditambahkan.`)
      await notifyChanged()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(addon) {
    setEditingId(addon.id)
    setEditForm({
      name: addon.name ?? '',
      price: String(addon.price ?? 0),
      unit: addon.unit ?? '',
      is_active: Boolean(addon.is_active),
    })
    setError(null)
    setSuccess(null)
  }

  async function handleUpdate(addonId) {
    const { errors, payload } = validateAddonInput(editForm)
    if (!payload) {
      setError({ message: Object.values(errors)[0] || 'Periksa kembali isian tambahan layanan.' })
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAddon(addonId, payload)
      setEditingId(null)
      setSuccess(`Tambahan "${updated.name}" berhasil diperbarui.`)
      await notifyChanged()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(addon) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await updateAddon(addon.id, {
        name: addon.name,
        price: Number(addon.price),
        unit: addon.unit,
        is_active: !addon.is_active,
      })
      await notifyChanged()
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
          {error.message}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <Input
            label="Nama Tambahan Layanan *"
            placeholder="Mis. Tambah waktu, Tambah cetak 4R"
            value={form.name}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, name: event.target.value }))
              setFieldErrors((prev) => ({ ...prev, name: null }))
            }}
            error={fieldErrors.name}
            maxLength={100}
            required
          />
        </div>
        <div className="sm:col-span-3">
          <Input
            label="Harga (Rp) *"
            type="number"
            min="0"
            step="1000"
            placeholder="20000"
            value={form.price}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, price: event.target.value }))
              setFieldErrors((prev) => ({ ...prev, price: null }))
            }}
            error={fieldErrors.price}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Satuan *"
            placeholder="5 menit / lembar"
            value={form.unit}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, unit: event.target.value }))
              setFieldErrors((prev) => ({ ...prev, unit: null }))
            }}
            error={fieldErrors.unit}
            maxLength={40}
            required
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" variant="success" loading={loading} className="w-full">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Tambah
          </Button>
        </div>
      </form>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
        {addons.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Belum ada tambahan layanan terdaftar.
          </p>
        ) : (
          addons.map((addon) => {
            const isEditing = editingId === addon.id
            return (
              <div
                key={addon.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm"
              >
                {isEditing ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="min-w-44 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
                      placeholder="Nama tambahan"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editForm.price}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, price: event.target.value }))
                      }
                      className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      placeholder="Harga (Rp)"
                    />
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, unit: event.target.value }))
                      }
                      className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      placeholder="Satuan"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      loading={loading}
                      onClick={() => handleUpdate(addon.id)}
                    >
                      Simpan
                    </Button>
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => setEditingId(null)}
                      disabled={loading}
                    >
                      Batal
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Sparkles aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-bold text-slate-800">{addon.name}</p>
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-brand-600">
                            {formatRupiah(addon.price)}
                          </span>{' '}
                          per {addon.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={addon.is_active ? 'green' : 'gray'}>
                        {addon.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => startEdit(addon)}
                        disabled={loading}
                      >
                        Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant={addon.is_active ? 'danger' : 'soft-success'}
                        onClick={() => handleToggleActive(addon)}
                        disabled={loading}
                      >
                        {addon.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
