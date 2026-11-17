import PackageFields, { PACKAGE_GRID } from '@/modules/antrean/components/PackageFields'
import { Input, Select } from '@/shared/components/ui'
import { todayWib } from '@/shared/utils/format'
import { addonOptionsFor, chosenAddons, sessionMinutes } from '../cashier'
import AddonPicker from './AddonPicker'
import PackageSummary from './PackageSummary'

// Isian reservasi (dipakai tab Reservasi & pop-up Ubah Reservasi):
// Nama, No. WhatsApp, Paket/Latar/Jumlah Orang, Tambahan, chip kapasitas · durasi, Tanggal + Jam (jam kosong dari backend).
// Semua baris memakai lajur yang sama dengan Paket | Latar | Jumlah Orang supaya kiri-kanan lurus:
// Nama & Tanggal di lajur Paket; No. WA & Jam selebar Latar + Jumlah Orang.
// form: { customer_name, phone, date, time, package_id, background_id, persons, addons }
// onChange(form) untuk isian biasa; onSelection(perubahan paket/latar/orang). time = hasil useReservationTime().
export default function ReservationFields({ catalog, form, onChange, onSelection, errors, time, disabled = false }) {
  const pkg = catalog.packages.find((item) => String(item.id) === String(form.package_id)) ?? null
  const addonOptions = addonOptionsFor(catalog, pkg)
  const chosen = chosenAddons(addonOptions, form.addons)
  const background = catalog.backgrounds.find((item) => String(item.id) === String(form.background_id)) ?? null

  return (
    <div className="space-y-4">
      <div className={PACKAGE_GRID}>
        <Input
          label="Nama panggilan *"
          placeholder="Contoh: Citra"
          maxLength={100}
          autoComplete="off"
          value={form.customer_name}
          onChange={(event) => onChange({ ...form, customer_name: event.target.value })}
          error={errors.customer_name}
        />
        {/* Hanya angka: huruf, spasi, tanda hubung dibuang saat diketik/ditempel (maks. 15 angka). */}
        <Input
          className="sm:col-span-2"
          label="No. WhatsApp"
          type="tel"
          inputMode="numeric"
          placeholder="Contoh: 081234567890"
          autoComplete="off"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 15) })}
          error={errors.phone}
        />
      </div>
      <PackageFields catalog={catalog} value={form} onChange={onSelection} errors={errors} />
      <AddonPicker addons={addonOptions} value={form.addons} onChange={(addons) => onChange({ ...form, addons })} disabled={disabled} />
      <PackageSummary pkg={pkg} background={background} minutes={sessionMinutes(pkg, chosen)} />
      <div className={PACKAGE_GRID}>
        <Input
          label="Tanggal *"
          type="date"
          min={todayWib()}
          value={form.date}
          onChange={(event) => onChange({ ...form, date: event.target.value })}
          error={errors.date}
        />
        <Select
          className="sm:col-span-2"
          label="Jam (WIB) *"
          placeholder={time.placeholder}
          options={time.options}
          value={form.time}
          disabled={time.disabled}
          onChange={(event) => onChange({ ...form, time: event.target.value })}
          error={errors.time}
        />
      </div>
    </div>
  )
}
