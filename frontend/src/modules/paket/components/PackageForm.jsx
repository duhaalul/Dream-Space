import { useState } from 'react'
import { Check, Layers, Plus, Sparkles } from 'lucide-react'
import { Alert, Badge, Button, Card, Input, Select } from '@/shared/components/ui'
import { PRICE_TYPE_LABELS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'
import {
  createBackground,
  createPackage,
  setPackageAddons,
  updateBackground,
  updatePackage,
} from '../api'

const PRICE_TYPE_OPTIONS = Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const EMPTY_FORM = {
  name: '',
  queue_code: '',
  price_type: 'PER_KELOMPOK',
  price: '110000',
  included_persons: '2',
  extra_person_price: '30000',
  min_persons: '1',
  max_persons: '15',
  description: '',
  is_active: true,
}

function formFromPackage(pkg) {
  if (!pkg) return EMPTY_FORM
  return {
    name: pkg.name ?? '',
    queue_code: pkg.queue_code ?? '',
    price_type: pkg.price_type ?? 'PER_SESI',
    price: String(pkg.price ?? 0),
    included_persons: pkg.included_persons != null ? String(pkg.included_persons) : '',
    extra_person_price: pkg.extra_person_price != null ? String(pkg.extra_person_price) : '',
    min_persons: pkg.min_persons != null ? String(pkg.min_persons) : '',
    max_persons: pkg.max_persons != null ? String(pkg.max_persons) : '',
    description: pkg.description ?? '',
    is_active: Boolean(pkg.is_active),
  }
}

function calculatePreview(form, previewPersons) {
  const persons = Math.max(1, Number(previewPersons) || 1)
  const price = Math.max(0, Number(form.price) || 0)
  const type = form.price_type
  const included =
    type === 'PER_KELOMPOK' && form.included_persons !== ''
      ? Math.max(1, Number(form.included_persons) || 1)
      : null
  const extraPrice =
    type === 'PER_KELOMPOK' && form.extra_person_price !== ''
      ? Math.max(0, Number(form.extra_person_price) || 0)
      : 0

  const baseQty = type === 'PER_ORANG' ? persons : 1
  const extraQty = type === 'PER_ORANG' || included === null ? 0 : Math.max(persons - included, 0)
  const baseTotal = baseQty * price
  const extraTotal = extraQty * extraPrice
  const total = baseTotal + extraTotal

  return { persons, baseQty, extraQty, baseTotal, extraTotal, total, included, extraPrice }
}

function parseOptionalInt(value) {
  const trimmed = String(value ?? '').trim()
  if (trimmed === '') return null
  const num = Number(trimmed)
  return Number.isInteger(num) ? num : NaN
}

function extractFieldErrors(err) {
  const fieldErrors = {}
  if (err?.code === 'DUPLICATE_VALUE') {
    fieldErrors.queue_code = 'Kode antrean atau nama paket sudah digunakan.'
    fieldErrors.name = 'Nama paket atau kode antrean sudah digunakan.'
  }
  if (err?.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
    for (const issue of err.details) {
      const key = issue?.path?.[0]
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message || 'Isian tidak valid.'
      }
    }
  }
  return fieldErrors
}

// Formulir tambah/ubah paket beserta pengelolaan latar & tambahan per paket (SRS 5.4, Owner saja).
export default function PackageForm({
  selectedPackage = null,
  backgrounds = [],
  addons = [],
  allowedAddonIds = [],
  onSaved,
  onCancelEdit,
}) {
  const isEditing = Boolean(selectedPackage?.id)
  const [form, setForm] = useState(() => formFromPackage(selectedPackage))
  const [previewPersons, setPreviewPersons] = useState(4)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [savingPackage, setSavingPackage] = useState(false)

  // State latar paket
  const [bgForm, setBgForm] = useState({ name: '', max_persons: '' })
  const [editingBgId, setEditingBgId] = useState(null)
  const [editingBgForm, setEditingBgForm] = useState({ name: '', max_persons: '', is_active: true })
  const [bgError, setBgError] = useState(null)
  const [savingBg, setSavingBg] = useState(false)

  // State tambahan layanan per paket
  const [checkedAddonIds, setCheckedAddonIds] = useState(() => allowedAddonIds)
  const [savingAddons, setSavingAddons] = useState(false)
  const [addonNotice, setAddonNotice] = useState(null)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: null }))
    setSuccessMessage(null)
  }

  function validateForm() {
    const nextErrors = {}
    const name = form.name.trim()
    const code = form.queue_code.trim().toUpperCase()
    const price = parseOptionalInt(form.price)
    const minPersons = parseOptionalInt(form.min_persons)
    const maxPersons = parseOptionalInt(form.max_persons)
    const includedPersons =
      form.price_type === 'PER_KELOMPOK' ? parseOptionalInt(form.included_persons) : null
    const extraPersonPrice =
      form.price_type === 'PER_KELOMPOK' && String(form.extra_person_price).trim() !== ''
        ? parseOptionalInt(form.extra_person_price)
        : null

    if (!name) nextErrors.name = 'Nama paket wajib diisi.'
    if (!/^[A-Z][A-Z0-9]{0,9}$/.test(code)) {
      nextErrors.queue_code = 'Kode diawali huruf kapital, hanya huruf kapital/angka (maks. 10 karakter).'
    }
    if (price === null || Number.isNaN(price) || price < 0) {
      nextErrors.price = 'Harga wajib berupa angka bulat minimal 0.'
    }
    if (form.price_type === 'PER_KELOMPOK') {
      if (includedPersons === null || Number.isNaN(includedPersons) || includedPersons < 1) {
        nextErrors.included_persons = 'Jumlah orang tercakup wajib diisi (minimal 1).'
      }
      if (extraPersonPrice !== null && (Number.isNaN(extraPersonPrice) || extraPersonPrice < 0)) {
        nextErrors.extra_person_price = 'Tarif tambahan per orang harus minimal 0.'
      }
    }
    if (minPersons !== null && (Number.isNaN(minPersons) || minPersons < 1)) {
      nextErrors.min_persons = 'Minimal orang harus minimal 1.'
    }
    if (maxPersons !== null && (Number.isNaN(maxPersons) || maxPersons < 1)) {
      nextErrors.max_persons = 'Maksimal orang harus minimal 1.'
    }
    if (
      minPersons !== null &&
      maxPersons !== null &&
      !Number.isNaN(minPersons) &&
      !Number.isNaN(maxPersons) &&
      minPersons > maxPersons
    ) {
      nextErrors.max_persons = 'Maksimal orang tidak boleh lebih kecil dari minimal orang.'
    }

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null

    return {
      name,
      queue_code: code,
      price_type: form.price_type,
      price,
      included_persons: form.price_type === 'PER_KELOMPOK' ? includedPersons : null,
      extra_person_price: form.price_type === 'PER_KELOMPOK' ? (extraPersonPrice ?? 0) : null,
      min_persons: minPersons,
      max_persons: maxPersons,
      description: form.description.trim() || null,
      is_active: Boolean(form.is_active),
    }
  }

  async function handleSubmitPackage(event) {
    event.preventDefault()
    const payload = validateForm()
    if (!payload) return

    setSavingPackage(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let saved
      if (isEditing) {
        saved = await updatePackage(selectedPackage.id, payload)
        setSuccessMessage(`Paket "${saved.name}" berhasil diperbarui.`)
      } else {
        saved = await createPackage(payload)
        setForm(EMPTY_FORM)
        setSuccessMessage(`Paket "${saved.name}" (${saved.queue_code}) berhasil ditambahkan.`)
      }
      await onSaved?.(saved)
    } catch (err) {
      setError(err)
      const mapped = extractFieldErrors(err)
      if (Object.keys(mapped).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...mapped }))
      }
    } finally {
      setSavingPackage(false)
    }
  }

  async function handleAddBackground(event) {
    event.preventDefault()
    if (!isEditing) return
    const name = bgForm.name.trim()
    const maxPersons = parseOptionalInt(bgForm.max_persons)

    if (!name) {
      setBgError({ message: 'Nama latar wajib diisi.' })
      return
    }
    if (maxPersons !== null && (Number.isNaN(maxPersons) || maxPersons < 1)) {
      setBgError({ message: 'Batas maksimal orang latar harus berupa angka minimal 1.' })
      return
    }

    setSavingBg(true)
    setBgError(null)
    try {
      await createBackground(selectedPackage.id, {
        name,
        max_persons: maxPersons,
        is_active: true,
      })
      setBgForm({ name: '', max_persons: '' })
      await onSaved?.(selectedPackage)
    } catch (err) {
      setBgError(err)
    } finally {
      setSavingBg(false)
    }
  }

  function startEditBackground(bg) {
    setEditingBgId(bg.id)
    setEditingBgForm({
      name: bg.name ?? '',
      max_persons: bg.max_persons != null ? String(bg.max_persons) : '',
      is_active: Boolean(bg.is_active),
    })
    setBgError(null)
  }

  async function handleUpdateBackground(bgId) {
    const name = editingBgForm.name.trim()
    const maxPersons = parseOptionalInt(editingBgForm.max_persons)
    if (!name) {
      setBgError({ message: 'Nama latar wajib diisi.' })
      return
    }
    if (maxPersons !== null && (Number.isNaN(maxPersons) || maxPersons < 1)) {
      setBgError({ message: 'Batas maksimal orang latar harus minimal 1.' })
      return
    }

    setSavingBg(true)
    setBgError(null)
    try {
      await updateBackground(bgId, {
        name,
        max_persons: maxPersons,
        is_active: Boolean(editingBgForm.is_active),
      })
      setEditingBgId(null)
      await onSaved?.(selectedPackage)
    } catch (err) {
      setBgError(err)
    } finally {
      setSavingBg(false)
    }
  }

  async function handleToggleBackgroundActive(bg) {
    setSavingBg(true)
    setBgError(null)
    try {
      await updateBackground(bg.id, {
        name: bg.name,
        max_persons: bg.max_persons ?? null,
        is_active: !bg.is_active,
      })
      await onSaved?.(selectedPackage)
    } catch (err) {
      setBgError(err)
    } finally {
      setSavingBg(false)
    }
  }

  function toggleAddonSelection(addonId) {
    setAddonNotice(null)
    setCheckedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId],
    )
  }

  async function handleSavePackageAddons() {
    if (!isEditing) return
    setSavingAddons(true)
    setAddonNotice(null)
    try {
      await setPackageAddons(selectedPackage.id, checkedAddonIds)
      setAddonNotice({ type: 'success', text: 'Daftar tambahan layanan paket berhasil disimpan.' })
      await onSaved?.(selectedPackage)
    } catch (err) {
      setAddonNotice({ type: 'error', text: err.message, requestId: err.requestId })
    } finally {
      setSavingAddons(false)
    }
  }

  const preview = calculatePreview(form, previewPersons)

  return (
    <div className="space-y-6">
      <Card
        title={
          isEditing
            ? `Ubah Paket: ${selectedPackage.name} (${selectedPackage.queue_code})`
            : 'Pengaturan Skema Harga & Kapasitas Paket Baru'
        }
        description={
          isEditing
            ? 'Perubahan harga dan kapasitas berlaku untuk pendaftaran baru dan tidak mengubah transaksi yang sudah tercatat.'
            : 'Tambahkan paket studio baru beserta skema perhitungan harga dan kapasitas ruangan.'
        }
        actions={
          isEditing && (
            <Button variant="neutral" size="sm" onClick={onCancelEdit}>
              + Mode Tambah Paket Baru
            </Button>
          )
        }
      >
        <form onSubmit={handleSubmitPackage} className="space-y-5">
          {error && (
            <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
              {error.message}
            </Alert>
          )}
          {successMessage && <Alert variant="success">{successMessage}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nama Paket *"
              placeholder="Mis. Reguler Studio"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              error={fieldErrors.name}
              maxLength={100}
              required
            />
            <Input
              label="Kode Antrean *"
              placeholder="Mis. RG"
              value={form.queue_code}
              onChange={(event) => updateField('queue_code', event.target.value.toUpperCase())}
              error={fieldErrors.queue_code}
              hint="Huruf kapital/angka, diawali huruf (maks. 10)"
              maxLength={10}
              required
            />
            <Select
              label="Skema Hitung Harga *"
              options={PRICE_TYPE_OPTIONS}
              value={form.price_type}
              onChange={(event) => updateField('price_type', event.target.value)}
              error={fieldErrors.price_type}
            />
            <Select
              label="Status Paket"
              options={[
                { value: 'true', label: 'Aktif (Tampil di Pendaftaran)' },
                { value: 'false', label: 'Nonaktif (Disembunyikan)' },
              ]}
              value={String(form.is_active)}
              onChange={(event) => updateField('is_active', event.target.value === 'true')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={
                form.price_type === 'PER_ORANG'
                  ? 'Harga per Orang (Rp) *'
                  : form.price_type === 'PER_SESI'
                    ? 'Harga Tetap per Sesi (Rp) *'
                    : 'Harga Paket Dasar (Rp) *'
              }
              type="number"
              min="0"
              step="1000"
              placeholder="110000"
              value={form.price}
              onChange={(event) => updateField('price', event.target.value)}
              error={fieldErrors.price}
              required
            />

            {form.price_type === 'PER_KELOMPOK' && (
              <>
                <Input
                  label="Kuota Orang Dasar *"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="2"
                  value={form.included_persons}
                  onChange={(event) => updateField('included_persons', event.target.value)}
                  error={fieldErrors.included_persons}
                  hint="Jumlah orang yang tercakup harga dasar"
                  required
                />
                <Input
                  label="Tarif Tambah per Orang (Rp)"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="30000"
                  value={form.extra_person_price}
                  onChange={(event) => updateField('extra_person_price', event.target.value)}
                  error={fieldErrors.extra_person_price}
                  hint="Biaya per orang di atas kuota dasar"
                />
              </>
            )}

            <Input
              label="Minimal Orang (Opsional)"
              type="number"
              min="1"
              max="1000"
              placeholder="Kosongkan jika bebas"
              value={form.min_persons}
              onChange={(event) => updateField('min_persons', event.target.value)}
              error={fieldErrors.min_persons}
            />
            <Input
              label="Maksimal Orang (Opsional)"
              type="number"
              min="1"
              max="1000"
              placeholder="Mis. 15"
              value={form.max_persons}
              onChange={(event) => updateField('max_persons', event.target.value)}
              error={fieldErrors.max_persons}
            />
          </div>

          <Input
            label="Keterangan Durasi & Fasilitas"
            placeholder="Mis. 15 menit · cetak 4R per orang · seluruh softcopy"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            error={fieldErrors.description}
            maxLength={5000}
          />

          {/* Kotak Pratinjau Harga (Wajib SRS / README) */}
          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-brand-700 uppercase">
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  Pratinjau Perhitungan Harga Sebelum Disimpan
                </div>
                <p className="text-xs text-slate-600">
                  {form.price_type === 'PER_SESI' &&
                    `Harga tetap ${formatRupiah(form.price)} per sesi tanpa biaya tambahan orang.`}
                  {form.price_type === 'PER_ORANG' &&
                    `${preview.persons} orang × ${formatRupiah(form.price)}/orang = ${formatRupiah(preview.total)}.`}
                  {form.price_type === 'PER_KELOMPOK' &&
                    `Harga dasar ${formatRupiah(form.price)} (${preview.included ?? 0} org pertama)` +
                      (preview.extraQty > 0
                        ? ` + ${preview.extraQty} org tambahan × ${formatRupiah(preview.extraPrice)}`
                        : ' (tanpa tambahan orang)')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-600">Simulasi orang:</span>
                  {[1, 2, 4, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPreviewPersons(num)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        Number(previewPersons) === num
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-brand-100'
                      }`}
                    >
                      {num} org
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    aria-label="Jumlah orang simulasi"
                    value={previewPersons}
                    onChange={(event) => setPreviewPersons(event.target.value)}
                    className="w-16 rounded-lg border border-brand-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-800"
                  />
                </div>

                <div className="rounded-xl bg-white px-4 py-2 text-right shadow-xs">
                  <span className="block text-[11px] text-slate-500">
                    Estimasi ({preview.persons} orang)
                  </span>
                  <span className="text-lg font-bold text-brand-600">
                    {formatRupiah(preview.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-1">
            {isEditing && (
              <Button variant="neutral" onClick={onCancelEdit} disabled={savingPackage}>
                Batal Ubah
              </Button>
            )}
            <Button type="submit" variant="primary" loading={savingPackage}>
              {isEditing ? 'Simpan Perubahan Paket' : 'Simpan Paket Baru'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Pengelolaan Latar & Tambahan untuk Paket yang Sedang Dipilih */}
      {isEditing && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={`Pilihan Latar — ${selectedPackage.name}`}
            description="Latar tidak dapat dihapus; nonaktifkan latar jika sedang tidak tersedia."
          >
            <div className="space-y-4">
              {bgError && (
                <Alert variant="error" requestId={bgError.status >= 500 ? bgError.requestId : null}>
                  {bgError.message}
                </Alert>
              )}

              <form onSubmit={handleAddBackground} className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <Input
                    label="Nama Latar Baru"
                    placeholder="Mis. Putih, Abu-abu, Spotlight"
                    value={bgForm.name}
                    onChange={(event) => setBgForm((prev) => ({ ...prev, name: event.target.value }))}
                    maxLength={100}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    label="Maks. Orang"
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="Opsional"
                    value={bgForm.max_persons}
                    onChange={(event) =>
                      setBgForm((prev) => ({ ...prev, max_persons: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="submit"
                    variant="success"
                    size="md"
                    loading={savingBg}
                    className="w-full"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Tambah
                  </Button>
                </div>
              </form>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
                {backgrounds.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    Belum ada latar khusus untuk paket ini.
                  </p>
                ) : (
                  backgrounds.map((bg) => {
                    const isEditingRow = editingBgId === bg.id
                    return (
                      <div
                        key={bg.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        {isEditingRow ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={editingBgForm.name}
                              onChange={(event) =>
                                setEditingBgForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800"
                              placeholder="Nama latar"
                            />
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={editingBgForm.max_persons}
                              onChange={(event) =>
                                setEditingBgForm((prev) => ({
                                  ...prev,
                                  max_persons: event.target.value,
                                }))
                              }
                              className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800"
                              placeholder="Maks org"
                            />
                            <Button
                              size="sm"
                              variant="primary"
                              loading={savingBg}
                              onClick={() => handleUpdateBackground(bg.id)}
                            >
                              Simpan
                            </Button>
                            <Button
                              size="sm"
                              variant="neutral"
                              onClick={() => setEditingBgId(null)}
                              disabled={savingBg}
                            >
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <Layers aria-hidden="true" className="h-4 w-4 text-brand-600" />
                              <div>
                                <span className="font-semibold text-slate-800">{bg.name}</span>
                                <span className="ml-2 text-xs text-slate-500">
                                  {bg.max_persons ? `(Maks. ${bg.max_persons} orang)` : '(Sesuai kapasitas paket)'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={bg.is_active ? 'green' : 'gray'}>
                                {bg.is_active ? 'Aktif' : 'Nonaktif'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="soft"
                                onClick={() => startEditBackground(bg)}
                                disabled={savingBg}
                              >
                                Ubah
                              </Button>
                              <Button
                                size="sm"
                                variant={bg.is_active ? 'danger' : 'soft-success'}
                                onClick={() => handleToggleBackgroundActive(bg)}
                                disabled={savingBg}
                              >
                                {bg.is_active ? 'Nonaktifkan' : 'Aktifkan'}
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
          </Card>

          <Card
            title={`Tambahan Layanan Tersedia — ${selectedPackage.name}`}
            description="Centang tambahan layanan yang boleh dipilih pelanggan pada paket ini."
          >
            <div className="space-y-4">
              {addonNotice && (
                <Alert
                  variant={addonNotice.type === 'error' ? 'error' : 'success'}
                  requestId={addonNotice.requestId}
                >
                  {addonNotice.text}
                </Alert>
              )}

              {addons.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Belum ada master tambahan layanan. Buat tambahan layanan di bagian bawah halaman.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {addons.map((addon) => {
                    const checked = checkedAddonIds.includes(addon.id)
                    return (
                      <label
                        key={addon.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition ${
                          checked
                            ? 'border-brand-500 bg-brand-50/70'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddonSelection(addon.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-slate-800">
                              {addon.name}
                            </span>
                            {!addon.is_active && <Badge tone="gray">Nonaktif</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatRupiah(addon.price)} / {addon.unit}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  loading={savingAddons}
                  onClick={handleSavePackageAddons}
                >
                  <Check aria-hidden="true" className="h-4 w-4" />
                  Simpan Tambahan Paket Ini
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
