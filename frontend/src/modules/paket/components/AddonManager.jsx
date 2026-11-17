import { useState } from 'react'
import { Check, Package, Pencil, Plus, Sparkles, Timer, Trash2, X } from 'lucide-react'
import { Alert, Button, Input, Modal, numberGuard } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'
import { createAddon, deleteAddon, updateAddon } from '../api'

const EMPTY = { name: '', price: '', qty: '1', unit: '' }
const ROW_INPUT = 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:bg-white'

// "tambah aksesoris" → "Tambah aksesoris"
const capitalizeFirst = (value) => value.replace(/^(\s*)(\S)/, (_, space, char) => space + char.toUpperCase())

// Satuan waktu menambah timer sesi: menit/mnt = jumlah menit, jam = jumlah × 60.
function minutesOf(qty, unit) {
  const name = unit.trim().toLowerCase()
  if (name === 'menit' || name === 'mnt') return qty
  if (name === 'jam') return qty * 60
  return null
}

// unit tersimpan → isian: "5 menit" → { qty: '5', unit: 'menit' }, "lembar" → { qty: '1', unit: 'lembar' }
function splitUnit(unit = '') {
  const match = /^(\d+)\s+(.+)$/.exec(unit.trim())
  return match ? { qty: match[1], unit: match[2] } : { qty: '1', unit: unit.trim() }
}

function toForm(addon) {
  return { name: addon.name ?? '', price: String(addon.price ?? ''), ...splitUnit(addon.unit) }
}

// Validasi → { errors, payload }. unit disimpan "5 menit", atau cukup "lembar" bila jumlah 1.
function validate(form) {
  const errors = {}
  const name = form.name.trim()
  const price = form.price.trim() === '' ? NaN : Number(form.price)
  const qty = Number(form.qty)
  const unit = form.unit.trim()
  if (!name) errors.name = 'Isi nama.'
  if (!Number.isInteger(price) || price < 0) errors.price = 'Isi harga (angka bulat).'
  if (!unit) errors.unit = 'Isi satuan.'
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) errors.qty = 'Jumlah 1–999.'
  const minutes = errors.qty || errors.unit ? null : minutesOf(qty, unit)
  if (minutes !== null && minutes > 600) errors.qty = 'Maksimal 600 menit.'
  if (Object.keys(errors).length) return { errors, payload: null }
  return {
    errors,
    payload: { name, price, unit: qty === 1 ? unit : `${qty} ${unit}`, extra_minutes: minutes, is_active: true },
  }
}

// Isian "Per": jumlah + satuan (diketik bebas).
function PerFields({ form, onChange, errors = {}, compact = false }) {
  return (
    <div className="flex gap-2">
      <input
        type="number"
        {...numberGuard()}
        min="1"
        max="999"
        step="1"
        aria-label="Jumlah per"
        value={form.qty}
        onChange={(e) => onChange({ ...form, qty: e.target.value })}
        className={`${ROW_INPUT} ${compact ? 'w-16' : 'w-20 py-3'} ${errors.qty ? 'border-red-300' : ''}`}
      />
      <input
        aria-label="Satuan"
        placeholder="Mis. menit, lembar"
        maxLength={30}
        value={form.unit}
        onChange={(e) => onChange({ ...form, unit: e.target.value })}
        className={`${ROW_INPUT} min-w-0 flex-1 ${compact ? '' : 'py-3'} ${errors.unit ? 'border-red-300' : ''}`}
      />
    </div>
  )
}

// Tambahan Layanan (Owner, di halaman Kelola Paket): tambah, ubah, hapus.
// Tambahan yang sudah dihapus (arsip, is_active=0) tidak ditampilkan.
// usage = { [addonId]: [nama paket] } — tambahan yang masih tercentang di paket tidak bisa dihapus.
export default function AddonManager({ addons = [], usage = {}, onChanged }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY)
  const [editErrors, setEditErrors] = useState({})
  const [confirming, setConfirming] = useState(null) // tambahan yang akan dihapus
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(null) // 'create' | 'update' | 'delete'

  const list = addons.filter((addon) => Number(addon.is_active) === 1)

  async function run(kind, action, message) {
    setBusy(kind)
    setError(null)
    setSuccess(null)
    try {
      await action()
      setSuccess(message)
      await onChanged?.()
      return true
    } catch (err) {
      setError(err)
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    const { errors: next, payload } = validate(form)
    setErrors(next)
    if (!payload) return
    if (await run('create', () => createAddon(payload), `"${payload.name}" ditambahkan.`)) setForm(EMPTY)
  }

  function startEdit(addon) {
    setEditingId(addon.id)
    setEditForm(toForm(addon))
    setEditErrors({})
    setError(null)
    setSuccess(null)
  }

  async function handleUpdate(addonId) {
    const { errors: next, payload } = validate(editForm)
    setEditErrors(next)
    if (!payload) return
    if (await run('update', () => updateAddon(addonId, payload), `"${payload.name}" disimpan.`)) setEditingId(null)
  }

  async function handleDelete() {
    const addon = confirming
    if (await run('delete', () => deleteAddon(addon.id), `"${addon.name}" dihapus.`)) setConfirming(null)
    // Ditolak karena ternyata masih dipakai (data berubah di komputer lain): muat ulang supaya peringatan tampil.
    else onChanged?.()
  }

  const inUse = confirming ? (usage[confirming.id] ?? []) : []

  const firstError = (errs) => errs.name ?? errs.price ?? errs.qty ?? errs.unit

  return (
    <div className="space-y-5">
      {error && !confirming && (
        <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
          {error.message}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleCreate} noValidate className="grid gap-4 sm:grid-cols-12 sm:items-start">
        <Input
          className="sm:col-span-4"
          label="Nama *"
          placeholder="Mis. Tambah waktu"
          maxLength={100}
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: capitalizeFirst(e.target.value) })
            setErrors({ ...errors, name: null })
          }}
          error={errors.name}
        />
        <Input
          className="sm:col-span-3"
          label="Harga *"
          type="number"
          min="0"
          step="1"
          placeholder="Mis. 20000"
          value={form.price}
          onChange={(e) => {
            setForm({ ...form, price: e.target.value })
            setErrors({ ...errors, price: null })
          }}
          error={errors.price}
          hint={Number(form.price) > 0 ? formatRupiah(form.price) : undefined}
        />
        <div className="sm:col-span-3">
          <p className="mb-1.5 text-sm text-slate-500">Per *</p>
          <PerFields
            form={form}
            errors={errors}
            onChange={(next) => {
              setForm(next)
              setErrors({ ...errors, qty: null, unit: null })
            }}
          />
          {(errors.qty || errors.unit) && <p className="mt-1.5 text-xs text-red-600">{errors.qty ?? errors.unit}</p>}
        </div>
        <div className="sm:col-span-2 sm:pt-7">
          <Button type="submit" variant="success" loading={busy === 'create'} className="w-full">
            {busy !== 'create' && <Plus aria-hidden="true" className="h-4 w-4" />} Tambah
          </Button>
        </div>
      </form>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada tambahan layanan.</p>
        ) : (
          list.map((addon) =>
            editingId === addon.id ? (
              <div key={addon.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Nama tambahan"
                    maxLength={100}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: capitalizeFirst(e.target.value) })}
                    className={`${ROW_INPUT} min-w-40 flex-1 font-medium ${editErrors.name ? 'border-red-300' : ''}`}
                  />
                  <input
                    aria-label="Harga tambahan"
                    type="number"
                    {...numberGuard()}
                    min="0"
                    step="1"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className={`${ROW_INPUT} w-28 ${editErrors.price ? 'border-red-300' : ''}`}
                  />
                  <div className="w-56">
                    <PerFields compact form={editForm} errors={editErrors} onChange={setEditForm} />
                  </div>
                  <Button size="sm" variant="primary" loading={busy === 'update'} onClick={() => handleUpdate(addon.id)}>
                    {busy !== 'update' && <Check aria-hidden="true" className="h-3.5 w-3.5" />} Simpan
                  </Button>
                  <Button size="sm" variant="neutral" onClick={() => setEditingId(null)} disabled={busy === 'update'}>
                    <X aria-hidden="true" className="h-3.5 w-3.5" /> Batal
                  </Button>
                </div>
                {firstError(editErrors) && <p className="mt-1.5 text-xs text-red-600">{firstError(editErrors)}</p>}
              </div>
            ) : (
              <div key={addon.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{addon.name}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>
                        <span className="font-semibold text-brand-600">{formatRupiah(addon.price)}</span> / {addon.unit}
                      </span>
                      {addon.extra_minutes ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-600">
                          <Timer aria-hidden="true" className="h-3 w-3" />+{addon.extra_minutes} menit
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="soft" onClick={() => startEdit(addon)} disabled={busy !== null}>
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setError(null)
                      setSuccess(null)
                      setConfirming(addon)
                    }}
                    disabled={busy !== null}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Hapus
                  </Button>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {confirming && inUse.length > 0 && (
        <Modal
          open
          title={`${confirming.name} belum bisa dihapus`}
          onClose={() => setConfirming(null)}
          footer={
            <Button variant="primary" onClick={() => setConfirming(null)}>
              <Check aria-hidden="true" className="h-4 w-4" /> Mengerti
            </Button>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>Layanan ini masih tersedia di paket:</p>
            <div className="flex flex-wrap gap-2">
              {inUse.map((name) => (
                <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  <Package aria-hidden="true" className="h-3.5 w-3.5" />
                  {name}
                </span>
              ))}
            </div>
            <p>
              Lepas centangnya di paket tersebut (<strong>Ubah</strong> → <strong>Tambahan Tersedia</strong>), lalu hapus kembali.
            </p>
          </div>
        </Modal>
      )}

      {confirming && inUse.length === 0 && (
        <Modal
          open
          title={`Hapus ${confirming.name}?`}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button variant="neutral" onClick={() => setConfirming(null)} disabled={busy === 'delete'}>
                <X aria-hidden="true" className="h-4 w-4" /> Batal
              </Button>
              <Button variant="danger" loading={busy === 'delete'} onClick={handleDelete}>
                {busy !== 'delete' && <Trash2 aria-hidden="true" className="h-4 w-4" />} Hapus
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Tindakan ini tidak bisa dibatalkan.</p>
            {error && (
              <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
                {error.message}
              </Alert>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
