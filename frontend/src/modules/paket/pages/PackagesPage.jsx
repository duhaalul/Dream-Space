import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, DoorClosed, DoorOpen, Eye, EyeOff, Layers, LayoutGrid, Pencil, Plus, Sparkles, Timer, Users } from 'lucide-react'
import { useAuth } from '@/modules/akun/useAuth'
import {
  Alert,
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  SegmentedControl,
} from '@/shared/components/ui'
import { PRICE_TYPE_LABELS, ROLES } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'
import { getAddons, getPackages, updatePackage } from '../api'
import AddonManager from '../components/AddonManager'
import PackageForm from '../components/PackageForm'

const FILTER_OPTIONS = [
  { value: 'all', label: 'Semua Paket', icon: LayoutGrid },
  { value: 'active', label: 'Aktif', icon: Eye },
  { value: 'inactive', label: 'Nonaktif', icon: EyeOff },
]

function formatCapacity(pkg) {
  const min = pkg.min_persons
  const max = pkg.max_persons
  if (min != null && max != null) return `${min} – ${max} orang`
  if (max != null) return `Maks. ${max} orang`
  if (min != null) return `Min. ${min} orang`
  return 'Tanpa batas khusus'
}

function formatPriceNote(pkg) {
  if (pkg.price_type === 'PER_ORANG') return 'per orang'
  if (pkg.price_type === 'PER_SESI') return 'per sesi'
  const baseText = `${pkg.included_persons ?? 1} org pertama`
  if (pkg.extra_person_price && Number(pkg.extra_person_price) > 0) {
    return `${baseText} · +${formatRupiah(pkg.extra_person_price)}/org`
  }
  return baseText
}

// T-07 Kelola Paket — Owner mengelola paket dan tambahan layanan, Admin hanya melihat paket.
export default function PackagesPage() {
  const { user } = useAuth()
  const isOwner = user.role === ROLES.OWNER

  const [packages, setPackages] = useState([])
  const [backgrounds, setBackgrounds] = useState([])
  const [allowedAddons, setAllowedAddons] = useState([])
  const [addons, setAddons] = useState([])
  const [filter, setFilter] = useState('all')
  // Pop-up Kelola Paket: null = tertutup, 'new' = paket baru, angka = id paket yang diubah.
  const [editing, setEditing] = useState(null)
  const [savedNotice, setSavedNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const [error, setError] = useState(null)
  // Paket yang ditolak dinonaktifkan karena masih dipakai (backend PACKAGE_IN_USE): { name, message } → pop-up.
  const [inUse, setInUse] = useState(null)
  const loadData = useCallback(async () => {
    try {
      const [pkgRes, addonList] = await Promise.all([getPackages(), getAddons()])
      setPackages(pkgRes?.packages ?? [])
      setBackgrounds(pkgRes?.backgrounds ?? [])
      setAllowedAddons(pkgRes?.allowed_addons ?? [])
      setAddons(addonList ?? [])
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getPackages(), getAddons()])
      .then(([pkgRes, addonList]) => {
        if (!active) return
        setPackages(pkgRes?.packages ?? [])
        setBackgrounds(pkgRes?.backgrounds ?? [])
        setAllowedAddons(pkgRes?.allowed_addons ?? [])
        setAddons(addonList ?? [])
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (filter === 'active') return Boolean(pkg.is_active)
      if (filter === 'inactive') return !pkg.is_active
      return true
    })
  }, [packages, filter])

  const editingPackage = typeof editing === 'number' ? packages.find((pkg) => pkg.id === editing) ?? null : null
  const editingAddonIds = editingPackage
    ? allowedAddons.filter((item) => item.package_id === editingPackage.id).map((item) => item.addon_id)
    : []

  // Tambahan yang masih tercentang di paket: { [addonId]: [nama paket] } (tidak bisa dihapus).
  const addonUsage = useMemo(() => {
    const names = new Map(packages.map((pkg) => [pkg.id, pkg.name]))
    const usage = {}
    for (const link of allowedAddons) {
      if (!names.has(link.package_id)) continue
      if (!usage[link.addon_id]) usage[link.addon_id] = []
      usage[link.addon_id].push(names.get(link.package_id))
    }
    return usage
  }, [packages, allowedAddons])

  const addonMap = useMemo(() => {
    const map = new Map()
    for (const addon of addons) map.set(addon.id, addon)
    return map
  }, [addons])

  function openEditor(target) {
    setSavedNotice(null)
    setEditing(target)
  }

  async function handleTogglePackageActive(pkg) {
    setTogglingId(pkg.id)
    setError(null)
    try {
      await updatePackage(pkg.id, {
        name: pkg.name,
        queue_code: pkg.queue_code,
        price_type: pkg.price_type,
        price: Number(pkg.price),
        included_persons:
          pkg.price_type === 'PER_KELOMPOK' && pkg.included_persons != null
            ? Number(pkg.included_persons)
            : null,
        extra_person_price:
          pkg.price_type === 'PER_KELOMPOK' && pkg.extra_person_price != null
            ? Number(pkg.extra_person_price)
            : null,
        min_persons: pkg.min_persons != null ? Number(pkg.min_persons) : null,
        max_persons: pkg.max_persons != null ? Number(pkg.max_persons) : null,
        duration_minutes: pkg.duration_minutes != null ? Number(pkg.duration_minutes) : null,
        description: pkg.description ?? null,
        is_active: !pkg.is_active,
      })
      await loadData()
    } catch (err) {
      // Masih ada antrean/sesi/reservasi di paket ini → pop-up penjelasan, bukan pesan error biasa.
      if (err?.code === 'PACKAGE_IN_USE') setInUse({ name: pkg.name, message: err.message })
      else setError(err)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title={isOwner ? 'Kelola Paket' : 'Paket'}
        code="T-07"
        actions={
          <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full max-sm:min-w-0">
            <SegmentedControl
              label="Filter status paket"
              className="max-sm:grid max-sm:w-full max-sm:grid-cols-3 max-sm:[&>button]:px-1.5 max-sm:[&>button]:whitespace-normal"
              options={FILTER_OPTIONS}
              value={filter}
              onChange={setFilter}
            />
            {isOwner && (
              <Button variant="primary" className="max-sm:min-h-11 max-sm:w-full" onClick={() => openEditor('new')}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Paket Baru
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-8">
        {error && (
          <Alert variant="error" requestId={error.status >= 500 ? error.requestId : null}>
            {error.message}
          </Alert>
        )}
        {savedNotice && <Alert variant="success">{savedNotice}</Alert>}

        {/* Daftar Kartu Paket sesuai Desain Figma */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white p-5"
              />
            ))}
          </div>
        ) : filteredPackages.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada paket yang sesuai dengan filter ini.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {filteredPackages.map((pkg) => {
              const pkgBackgrounds = backgrounds.filter((bg) => bg.package_id === pkg.id)
              const pkgAddonIds = allowedAddons
                .filter((item) => item.package_id === pkg.id)
                .map((item) => item.addon_id)
              const pkgAddons = pkgAddonIds.map((id) => addonMap.get(id)).filter(Boolean)
              const isOpen = Boolean(pkg.is_open)
              const isActive = Boolean(pkg.is_active)

              return (
                <article
                  key={pkg.id}
                  className={`flex flex-col justify-between overflow-hidden rounded-3xl border bg-white shadow-xs transition ${
                    isActive ? 'border-slate-200/90' : 'border-slate-200 bg-slate-50/60 opacity-85'
                  }`}
                >
                  <div>
                    {/* Visual Header Kartu Paket */}
                    <div
                      className={`relative overflow-hidden px-5 py-4 text-white ${
                        isActive
                          ? 'bg-linear-to-r from-brand-500 via-cyan-500 to-emerald-500'
                          : 'bg-slate-500'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/15"
                      />
                      <div className="relative flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block rounded-xl bg-white/20 px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase backdrop-blur-xs">
                            Kode {pkg.queue_code}
                          </span>
                          <h2 className="mt-2 text-lg font-bold leading-snug">{pkg.name}</h2>
                        </div>
                        <span className="font-display text-3xl font-black text-white/90 font-soft">
                          {pkg.queue_code}
                        </span>
                      </div>

                      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge tone={isActive ? 'green' : 'gray'}>
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                        <Badge tone={isOpen ? 'brand' : 'red'}>
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1">
                              <DoorOpen aria-hidden="true" className="h-3 w-3" />
                              Ruangan Buka
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <DoorClosed aria-hidden="true" className="h-3 w-3" />
                              Ditutup Sementara
                            </span>
                          )}
                        </Badge>
                      </div>
                    </div>

                    {/* Isi Kartu Paket */}
                    <div className="space-y-3.5 p-5">
                      {pkg.description ? (
                        <p className="text-xs leading-relaxed text-slate-500">{pkg.description}</p>
                      ) : (
                        <p className="text-xs italic text-slate-400">
                          Belum ada keterangan fasilitas.
                        </p>
                      )}

                      {!isOpen && pkg.closed_reason && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <b>Alasan tutup:</b> {pkg.closed_reason}
                        </div>
                      )}

                      <div className="rounded-2xl bg-slate-50 p-3.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xl font-bold text-brand-600">
                            {formatRupiah(pkg.price)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {PRICE_TYPE_LABELS[pkg.price_type] ?? pkg.price_type}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">{formatPriceNote(pkg)}</p>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Users aria-hidden="true" className="h-3.5 w-3.5 text-brand-600" />
                            Kapasitas:
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatCapacity(pkg)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Timer aria-hidden="true" className="h-3.5 w-3.5 text-brand-600" />
                            Durasi:
                          </span>
                          <span className="font-semibold text-slate-800">
                            {pkg.duration_minutes ? `${pkg.duration_minutes} menit` : 'Belum diisi'}
                          </span>
                        </div>

                        <div>
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Layers aria-hidden="true" className="h-3.5 w-3.5 text-brand-600" />
                            Pilihan Latar ({pkgBackgrounds.filter((b) => b.is_active).length} aktif):
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {pkgBackgrounds.length === 0 ? (
                              <span className="text-[11px] text-slate-400">Tanpa pilihan latar</span>
                            ) : (
                              pkgBackgrounds.map((bg) => (
                                <span
                                  key={bg.id}
                                  className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                                    bg.is_active
                                      ? 'bg-brand-50 text-brand-700'
                                      : 'bg-slate-100 text-slate-400 line-through'
                                  }`}
                                >
                                  {bg.name}
                                  {bg.max_persons ? ` (≤${bg.max_persons})` : ''}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-brand-600" />
                            Tambahan Tersedia:
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {pkgAddons.length === 0 ? (
                              <span className="text-[11px] text-slate-400">Tidak ada tambahan</span>
                            ) : (
                              pkgAddons.map((addon) => (
                                <span
                                  key={addon.id}
                                  className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                                >
                                  {addon.name}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Khusus Owner (Admin Hanya Melihat) */}
                  {isOwner && (
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
                      <Button size="sm" variant="soft" className="flex-1" onClick={() => openEditor(pkg.id)}>
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Ubah
                      </Button>
                      <Button
                        size="sm"
                        variant={isActive ? 'danger' : 'soft-success'}
                        loading={togglingId === pkg.id}
                        onClick={() => handleTogglePackageActive(pkg)}
                      >
                        {togglingId !== pkg.id &&
                          (isActive ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />)}
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {/* Bagian Pengelolaan Khusus Owner */}
        {isOwner && (
          <>
            {editing !== null && (editing === 'new' || editingPackage) && (
              <PackageForm
                key={editing}
                pkg={editingPackage}
                backgrounds={editingPackage ? backgrounds.filter((bg) => bg.package_id === editingPackage.id) : []}
                addons={addons}
                allowedAddonIds={editingAddonIds}
                onClose={() => setEditing(null)}
                onSaved={async (saved) => {
                  setEditing(null)
                  setSavedNotice(`Paket "${saved.name}" disimpan.`)
                  await loadData()
                }}
              />
            )}

            <Card title="Tambahan Layanan">
              <AddonManager addons={addons} usage={addonUsage} onChanged={loadData} />
            </Card>

            {inUse && (
              <Modal
                open
                title={`${inUse.name} belum bisa dinonaktifkan`}
                onClose={() => setInUse(null)}
                footer={
                  <Button variant="primary" onClick={() => setInUse(null)}>
                    <Check aria-hidden="true" className="h-4 w-4" /> Mengerti
                  </Button>
                }
              >
                <div className="space-y-3 text-sm text-slate-600">
                  <p>{inUse.message}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Sesi & antrean: selesaikan di menu <strong>Antrean</strong>.
                    </li>
                    <li>
                      Reservasi: <strong>Antrean › Reservasi</strong> → Batalkan, atau <strong>Detail › Ubah Reservasi</strong> untuk pindah paket.
                    </li>
                  </ul>
                </div>
              </Modal>
            )}
          </>
        )}
      </div>
    </>
  )
}
