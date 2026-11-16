import { Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'

// Tambahan layanan yang diizinkan paket, dengan tombol −/+. value: { [addonId]: qty }.
export default function AddonPicker({ addons, value, onChange, disabled = false }) {
  if (!addons.length) return null
  return (
    <div>
      <p className="mb-1.5 text-sm text-slate-500">Tambahan</p>
      <ul className="space-y-2">
        {addons.map((addon) => {
          const qty = value[addon.id] ?? 0
          const set = (next) => onChange({ ...value, [addon.id]: next })
          return (
            <li key={addon.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-2">
              <span className="min-w-0 text-sm text-slate-700">
                {addon.name}
                <span className="ml-1.5 text-xs text-slate-400">
                  {formatRupiah(addon.price)}/{addon.unit}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Button size="sm" variant="neutral" className="px-2.5!" aria-label={`Kurangi ${addon.name}`} disabled={disabled || qty === 0} onClick={() => set(qty - 1)}>
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
                <span className="w-7 text-center text-sm font-semibold text-slate-800">{qty}</span>
                <Button size="sm" variant="neutral" className="px-2.5!" aria-label={`Tambah ${addon.name}`} disabled={disabled} onClick={() => set(qty + 1)}>
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
