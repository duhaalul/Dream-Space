import { Input, Select } from '@/shared/components/ui'
import { activeBackgrounds, activePackages, backgroundLabel, packageLabel } from '../visitForm'

// Kolom 3 lajur Paket | Latar | Jumlah Orang. Baris lain yang ingin sejajar memakai kelas yang sama
// (mis. form Reservasi: Nama di lajur Paket, No. WA selebar Latar + Jumlah Orang dengan sm:col-span-2).
export const PACKAGE_GRID = 'grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)]'

// Kolom Pilihan Paket, Latar, dan Jumlah Orang (sejajar 3 kolom; di HP bertumpuk).
// Info kapasitas/durasi/urutan ditampilkan terpisah (kasir/components/PackageSummary).
// Dipakai form datang langsung (wajib) dan reservasi (optional: paket boleh menyusul).
// value: { package_id, background_id, persons } (string), errors: { package_id, background_id, persons }
export default function PackageFields({ catalog, value, onChange, errors = {}, optional = false, disabled = false }) {
  const star = optional ? '' : ' *'
  const packages = activePackages(catalog.packages)
  const pkg = catalog.packages.find((item) => String(item.id) === String(value.package_id)) ?? null
  const backgrounds = pkg ? activeBackgrounds(catalog.backgrounds, pkg.id) : []

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
    <div className={PACKAGE_GRID}>
      <Select
        label={`Pilihan Paket${star}`}
        placeholder={optional ? 'Belum dipilih' : 'Pilih paket'}
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
    </div>
  )
}
