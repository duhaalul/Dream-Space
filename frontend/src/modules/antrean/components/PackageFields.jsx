import { UsersRound } from 'lucide-react'
import { Badge, Input, Select } from '@/shared/components/ui'
import {
  activeBackgrounds,
  activePackages,
  backgroundLabel,
  capacityInfo,
  packageLabel,
} from '../visitForm'

// "Kapasitas Ruangan" hanya informasi: sengaja tanpa kotak/garis kolom isian
// supaya tidak dikira bisa diisi. Tinggi baris isi disamakan dengan kotak input
// agar sejajar dengan Jumlah Orang.
function CapacityInfo({ info }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-slate-500">Kapasitas Ruangan</p>
      <div className="flex min-h-11.5 flex-col justify-center">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <UsersRound aria-hidden="true" className={`h-4 w-4 shrink-0 ${info ? 'text-brand-500' : 'text-slate-400'}`} />
          <span className={`text-sm ${info ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
            {info ? info.limitText : 'Pilih paket dulu'}
          </span>
          {info && (
            <Badge tone={info.isOpen ? 'green' : 'red'} className="px-2.5 py-0.5">
              {info.isOpen ? 'Buka' : 'Ditutup'}
            </Badge>
          )}
        </div>
        {info && <p className="mt-0.5 pl-6.5 text-xs text-slate-500">{info.sourceText}</p>}
      </div>
    </div>
  )
}

// Kolom Pilihan Paket, Latar, Jumlah Orang, dan Kapasitas Ruangan.
// Dipakai form datang langsung (wajib) dan reservasi (optional: paket boleh menyusul).
// value: { package_id, background_id, persons } (string), errors: { package_id, background_id, persons }
export default function PackageFields({ catalog, value, onChange, errors = {}, optional = false, disabled = false }) {
  const star = optional ? '' : ' *'
  const packages = activePackages(catalog.packages)
  const pkg = catalog.packages.find((item) => String(item.id) === String(value.package_id)) ?? null
  const backgrounds = pkg ? activeBackgrounds(catalog.backgrounds, pkg.id) : []
  const background = backgrounds.find((item) => String(item.id) === String(value.background_id)) ?? null

  function changePackage(packageId) {
    const options = packageId ? activeBackgrounds(catalog.backgrounds, packageId) : []
    // Latar lama tidak berlaku untuk paket lain; bila hanya ada satu latar, langsung dipilih.
    onChange({
      ...value,
      package_id: packageId,
      background_id: options.length === 1 ? String(options[0].id) : '',
      persons: packageId ? value.persons : '',
    })
  }

  // Tanda * mengikuti aturan backend: latar wajib bila paket punya latar aktif.
  const backgroundStar = (pkg ? backgrounds.length > 0 : !optional) ? ' *' : ''
  const personsStar = pkg || !optional ? ' *' : ''

  let backgroundPlaceholder = 'Pilih latar'
  if (!pkg) backgroundPlaceholder = 'Pilih paket dulu'
  else if (backgrounds.length === 0) backgroundPlaceholder = 'Tanpa pilihan latar'

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label={`Pilihan Paket${star}`}
        placeholder={optional ? 'Belum dipilih (bisa menyusul)' : 'Pilih paket'}
        options={packages.map((item) => ({ value: String(item.id), label: packageLabel(item) }))}
        value={value.package_id}
        onChange={(event) => changePackage(event.target.value)}
        error={errors.package_id}
        disabled={disabled}
      />
      <Select
        label={`Pilihan Latar${backgroundStar}`}
        placeholder={backgroundPlaceholder}
        options={backgrounds.map((item) => ({ value: String(item.id), label: backgroundLabel(item) }))}
        value={value.background_id}
        onChange={(event) => onChange({ ...value, background_id: event.target.value })}
        error={errors.background_id}
        disabled={disabled || backgrounds.length === 0}
      />
      <Input
        label={`Jumlah Orang${personsStar}`}
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        placeholder={pkg ? 'Contoh: 2' : 'Pilih paket dulu'}
        value={value.persons}
        onChange={(event) => onChange({ ...value, persons: event.target.value })}
        error={errors.persons}
        disabled={disabled || !pkg}
      />
      <CapacityInfo info={capacityInfo(pkg, background)} />
    </div>
  )
}
