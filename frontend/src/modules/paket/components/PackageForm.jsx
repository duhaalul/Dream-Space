import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Alert, Button, Input, Modal, Select, numberGuard } from '@/shared/components/ui'
import { PRICE_TYPE_LABELS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'
import { createPackageSetup, updatePackageSetup } from '../api'

const PRICE_TYPE_OPTIONS = Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const EMPTY_FORM = {
  name: '',
  queue_code: '',
  price_type: 'PER_KELOMPOK',
  price: '',
  included_persons: '',
  extra_person_price: '',
  min_persons: '',
  max_persons: '',
  duration_minutes: '',
  description: '',
}

const text = (value) => (value == null ? '' : String(value))

function formFromPackage(pkg) {
  if (!pkg) return EMPTY_FORM
  return {
    name: pkg.name ?? '',
    queue_code: pkg.queue_code ?? '',
    price_type: pkg.price_type ?? 'PER_SESI',
    price: text(pkg.price),
    included_persons: text(pkg.included_persons),
    extra_person_price: text(pkg.extra_person_price),
    min_persons: text(pkg.min_persons),
    max_persons: text(pkg.max_persons),
    duration_minutes: text(pkg.duration_minutes),
    description: pkg.description ?? '',
  }
}

let rowSeq = 0
const rowFromBackground = (bg) => ({
  key: `bg-${bg.id}`,
  id: bg.id,
  name: bg.name ?? '',
  max_persons: text(bg.max_persons),
  is_active: Boolean(bg.is_active),
})
const newRow = () => ({ key: `new-${(rowSeq += 1)}`, id: null, name: '', max_persons: '', is_active: true })

// '' → null, angka bulat → angka, selain itu → NaN
function parseOptionalInt(value) {
  const trimmed = String(value ?? '').trim()
  if (trimmed === '') return null
  const num = Number(trimmed)
  return Number.isInteger(num) ? num : NaN
}

function previewTotal(form, persons) {
  const count = Math.max(1, Number(persons) || 1)
  const price = Math.max(0, Number(form.price) || 0)
  if (form.price_type === 'PER_ORANG') return count * price
  if (form.price_type === 'PER_SESI') return price
  const included = Math.max(1, Number(form.included_persons) || 1)
  const extra = Math.max(0, Number(form.extra_person_price) || 0)
  return price + Math.max(count - included, 0) * extra
}

function priceLabel(type) {
  if (type === 'PER_ORANG') return 'Harga per Orang (Rp) *'
  if (type === 'PER_SESI') return 'Harga per Sesi (Rp) *'
  return 'Harga Kelompok (Rp) *'
}

// Validasi info paket (sama dengan aturan backend) → { errors, payload }.
function validatePackage(form) {
  const errors = {}
  const kelompok = form.price_type === 'PER_KELOMPOK'
  const code = form.queue_code.trim().toUpperCase()
  const price = parseOptionalInt(form.price)
  const included = kelompok ? parseOptionalInt(form.included_persons) : null
  const extra = kelompok ? parseOptionalInt(form.extra_person_price) : null
  const min = parseOptionalInt(form.min_persons)
  const max = parseOptionalInt(form.max_persons)
  const duration = parseOptionalInt(form.duration_minutes)
  const bad = (value, low, high) => value === null || Number.isNaN(value) || value < low || value > high

  if (!form.name.trim()) errors.name = 'Isi nama paket.'
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(code)) errors.queue_code = 'Huruf kapital/angka, diawali huruf (maks. 10).'
  if (bad(price, 0, 1_000_000_000_000)) errors.price = 'Isi harga (angka bulat).'
  if (kelompok && bad(included, 1, 1000)) errors.included_persons = 'Isi minimal 1.'
  if (extra !== null && bad(extra, 0, 1_000_000_000_000)) errors.extra_person_price = 'Isi angka bulat.'
  if (min !== null && bad(min, 1, 1000)) errors.min_persons = 'Minimal 1.'
  if (max !== null && bad(max, 1, 1000)) errors.max_persons = 'Minimal 1.'
  if (!errors.min_persons && !errors.max_persons && min !== null && max !== null && min > max) {
    errors.max_persons = 'Tidak boleh di bawah minimal.'
  }
  if (bad(duration, 1, 600)) errors.duration_minutes = 'Isi 1–600 menit.'

  if (Object.keys(errors).length) return { errors, payload: null }
  return {
    errors,
    payload: {
      name: form.name.trim(),
      queue_code: code,
      price_type: form.price_type,
      price,
      included_persons: kelompok ? included : null,
      extra_person_price: kelompok ? (extra ?? 0) : null,
      min_persons: min,
      max_persons: max,
      duration_minutes: duration,
      description: form.description.trim() || null,
    },
  }
}

// Validasi baris latar → { errors: { [key]: { name?, max_persons? } }, list: [{ key, id, name, max_persons, is_active }] }
function validateRows(rows) {
  const errors = {}
  const seen = new Set()
  const list = rows.map((row) => {
    const rowErrors = {}
    const name = row.name.trim()
    const max = parseOptionalInt(row.max_persons)
    if (!name) rowErrors.name = 'Isi nama.'
    else if (seen.has(name.toLowerCase())) rowErrors.name = 'Nama kembar.'
    seen.add(name.toLowerCase())
    if (max !== null && (Number.isNaN(max) || max < 1 || max > 1000)) rowErrors.max_persons = 'Minimal 1.'
    if (Object.keys(rowErrors).length) errors[row.key] = rowErrors
    return { key: row.key, id: row.id, name, max_persons: max, is_active: row.is_active }
  })
  return { errors, list }
}

function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-slate-800">{children}</h3>
      {aside}
    </div>
  )
}

const ROW_INPUT = 'rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:bg-white'

// Pop-up tambah/ubah paket (Owner): info paket, pilihan latar, dan tambahan tersedia,
// disimpan sekaligus dengan satu tombol Simpan (satu transaksi di backend).
// pkg = null → paket baru. backgrounds = latar milik paket. addons = master tambahan.
export default function PackageForm({ pkg = null, backgrounds = [], addons = [], allowedAddonIds = [], onClose, onSaved }) {
  const isEditing = Boolean(pkg?.id)
  const [form, setForm] = useState(() => formFromPackage(pkg))
  const [rows, setRows] = useState(() => backgrounds.map(rowFromBackground))
  const [checked, setChecked] = useState(() => new Set(allowedAddonIds))
  const [previewPersons, setPreviewPersons] = useState('4')
  const [fieldErrors, setFieldErrors] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const kelompok = form.price_type === 'PER_KELOMPOK'
  // Tambahan yang sudah dihapus (arsip, is_active=0) tidak ditampilkan.
  const addonOptions = addons.filter((addon) => Number(addon.is_active) === 1)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: null }))
    setError(null)
  }

  function updateRow(key, patch) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setRowErrors((prev) => ({ ...prev, [key]: null }))
    setError(null)
  }

  function toggleAddon(addonId) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(addonId)) next.delete(addonId)
      else next.add(addonId)
      return next
    })
    setError(null)
  }

  async function save() {
    const pkgCheck = validatePackage(form)
    const rowCheck = validateRows(rows)
    setFieldErrors(pkgCheck.errors)
    setRowErrors(rowCheck.errors)
    if (!pkgCheck.payload || Object.keys(rowCheck.errors).length) return

    // Hanya latar baru dan latar lama yang berubah yang dikirim.
    const original = new Map(backgrounds.map((bg) => [bg.id, bg]))
    const sent = rowCheck.list.filter((row) => {
      if (!row.id) return true
      const old = original.get(row.id)
      return old.name !== row.name || (old.max_persons ?? null) !== row.max_persons || Boolean(old.is_active) !== row.is_active
    })
    const body = {
      package: { ...pkgCheck.payload, is_active: isEditing ? Boolean(pkg.is_active) : true },
      backgrounds: sent.map(({ id, name, max_persons, is_active }) => ({ ...(id ? { id } : {}), name, max_persons, is_active })),
      addon_ids: [...checked],
    }

    setSaving(true)
    setError(null)
    try {
      const saved = isEditing ? await updatePackageSetup(pkg.id, body) : await createPackageSetup(body)
      await onSaved?.(saved)
    } catch (err) {
      // Tandai kolom yang ditolak backend; isian tidak dikosongkan.
      const nextFields = {}
      const nextRows = {}
      for (const issue of err?.details ?? []) {
        const [scope, indexOrField, field] = issue?.path ?? []
        if (scope === 'package' && indexOrField) nextFields[indexOrField] = issue.message
        if (scope === 'backgrounds' && sent[indexOrField] && field) {
          nextRows[sent[indexOrField].key] = { ...nextRows[sent[indexOrField].key], [field]: issue.message }
        }
      }
      setFieldErrors(nextFields)
      setRowErrors(nextRows)
      setError(
        err?.code === 'DUPLICATE_VALUE'
          ? { message: 'Nama/kode paket atau nama latar sudah dipakai.' }
          : { message: err?.message ?? 'Gagal menyimpan.', requestId: err?.status >= 500 ? err.requestId : null },
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      size="xl"
      title={isEditing ? `Ubah ${pkg.name}` : 'Paket Baru'}
      onClose={onClose}
      footer={
        <>
          <Button variant="neutral" onClick={onClose} disabled={saving}>
            <X aria-hidden="true" className="h-4 w-4" /> Batal
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {!saving && <Check aria-hidden="true" className="h-4 w-4" />} Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {error && (
          <Alert variant="error" requestId={error.requestId}>
            {error.message}
          </Alert>
        )}

        <section>
          <SectionTitle>Info Paket</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Nama Paket *" placeholder="Mis. Reguler Studio" maxLength={100} value={form.name} onChange={(e) => updateField('name', e.target.value)} error={fieldErrors.name} />
            <Input label="Kode Antrean *" placeholder="Mis. RG" maxLength={10} value={form.queue_code} onChange={(e) => updateField('queue_code', e.target.value.toUpperCase())} error={fieldErrors.queue_code} />
            <Select label="Skema Harga *" options={PRICE_TYPE_OPTIONS} value={form.price_type} onChange={(e) => updateField('price_type', e.target.value)} />
            <Input label={priceLabel(form.price_type)} type="number" min="0" step="1" placeholder="Mis. 110000" value={form.price} onChange={(e) => updateField('price', e.target.value)} error={fieldErrors.price} hint={Number(form.price) > 0 ? formatRupiah(form.price) : undefined} />
            {kelompok && (
              <>
                <Input label="Termasuk Harga (orang) *" type="number" min="1" step="1" placeholder="Mis. 2" value={form.included_persons} onChange={(e) => updateField('included_persons', e.target.value)} error={fieldErrors.included_persons} />
                <Input label="Tambahan per Orang (Rp)" type="number" min="0" step="1" placeholder="Mis. 30000" value={form.extra_person_price} onChange={(e) => updateField('extra_person_price', e.target.value)} error={fieldErrors.extra_person_price} />
              </>
            )}
            <Input label="Min. Orang" type="number" min="1" step="1" placeholder="Bebas" value={form.min_persons} onChange={(e) => updateField('min_persons', e.target.value)} error={fieldErrors.min_persons} />
            <Input label="Maks. Orang" type="number" min="1" step="1" placeholder="Bebas" value={form.max_persons} onChange={(e) => updateField('max_persons', e.target.value)} error={fieldErrors.max_persons} />
            <Input label="Durasi Sesi (menit) *" type="number" min="1" max="600" step="1" placeholder="Mis. 15" value={form.duration_minutes} onChange={(e) => updateField('duration_minutes', e.target.value)} error={fieldErrors.duration_minutes} />
            <Input className="sm:col-span-2 lg:col-span-3" label="Keterangan" placeholder="Mis. cetak 4R per orang · seluruh softcopy" maxLength={5000} value={form.description} onChange={(e) => updateField('description', e.target.value)} error={fieldErrors.description} />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            Contoh
            <input
              type="number"
              {...numberGuard()}
              min="1"
              aria-label="Jumlah orang contoh"
              value={previewPersons}
              onChange={(e) => setPreviewPersons(e.target.value)}
              className={`${ROW_INPUT} w-16 border-slate-200 py-1 text-center`}
            />
            orang = <strong className="text-brand-600">{formatRupiah(previewTotal(form, previewPersons))}</strong>
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle
              aside={
                <Button size="sm" variant="soft" onClick={() => setRows((prev) => [...prev, newRow()])}>
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Latar
                </Button>
              }
            >
              Pilihan Latar
            </SectionTitle>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Tanpa latar.</p>
            ) : (
              <>
                <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500" aria-hidden="true">
                  <span className="min-w-0 flex-1">Nama Latar</span>
                  <span className="w-32">Maks. Orang</span>
                  <span className="w-10 text-center">Aktif</span>
                  <span className="w-6" />
                </div>
                <ul className="space-y-2">
                  {rows.map((row) => {
                    const errs = rowErrors[row.key] ?? {}
                    return (
                      <li key={row.key}>
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Nama latar"
                            placeholder="Nama latar"
                            maxLength={100}
                            value={row.name}
                            onChange={(e) => updateRow(row.key, { name: e.target.value })}
                            className={`${ROW_INPUT} min-w-0 flex-1 ${errs.name ? 'border-red-300' : 'border-slate-200'} ${row.is_active ? '' : 'text-slate-400'}`}
                          />
                          <div className="relative w-32 shrink-0">
                            <input
                              aria-label="Maks. orang latar"
                              type="number"
                              {...numberGuard()}
                              min="1"
                              placeholder="Ikut paket"
                              value={row.max_persons}
                              onChange={(e) => updateRow(row.key, { max_persons: e.target.value })}
                              className={`${ROW_INPUT} w-full ${row.max_persons !== '' ? 'pr-14' : ''} ${errs.max_persons ? 'border-red-300' : 'border-slate-200'}`}
                            />
                            {row.max_persons !== '' && (
                              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">orang</span>
                            )}
                          </div>
                          <label className="flex w-10 shrink-0 cursor-pointer justify-center">
                            <input
                              type="checkbox"
                              aria-label="Latar aktif"
                              checked={row.is_active}
                              onChange={(e) => updateRow(row.key, { is_active: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-brand-600"
                            />
                          </label>
                          {row.id ? (
                            <span className="w-6 shrink-0" aria-hidden="true" />
                          ) : (
                            <button
                              type="button"
                              aria-label="Hapus baris latar"
                              onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <X aria-hidden="true" className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {(errs.name || errs.max_persons) && <p className="mt-1 text-xs text-red-600">{errs.name ?? errs.max_persons}</p>}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          <section>
            <SectionTitle>Tambahan Tersedia</SectionTitle>
            {addonOptions.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">Belum ada tambahan.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {addonOptions.map((addon) => {
                  const on = checked.has(addon.id)
                  return (
                    <label
                      key={addon.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                        on ? 'border-brand-500 bg-brand-50/70' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggleAddon(addon.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-800">{addon.name}</span>
                        <span className="block text-xs text-slate-500">
                          {formatRupiah(addon.price)}/{addon.unit}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </Modal>
  )
}
