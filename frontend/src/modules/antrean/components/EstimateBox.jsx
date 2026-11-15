import { formatRupiah } from '@/shared/utils/format'
import { estimateTotal } from '../visitForm'

// Kotak biru "Estimasi Tagihan". Hanya perkiraan; total resmi dihitung backend saat disimpan.
export default function EstimateBox({ pkg, persons }) {
  const estimate = estimateTotal(pkg, persons)

  let detail = 'Pilih paket dan jumlah orang'
  if (estimate) {
    if (pkg.price_type === 'PER_ORANG') {
      detail = `${estimate.baseQty} × ${formatRupiah(estimate.price)}`
    } else if (pkg.price_type === 'PER_SESI') {
      detail = 'Harga tetap per sesi'
    } else if (estimate.extraQty > 0) {
      detail = `${formatRupiah(estimate.price)} (${pkg.included_persons} orang) + ${estimate.extraQty} × ${formatRupiah(estimate.extraPrice)}`
    } else {
      detail = pkg.included_persons == null ? 'Harga paket' : `Harga untuk ${pkg.included_persons} orang`
    }
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
      <div>
        <p className="text-sm text-brand-600">Estimasi Tagihan:</p>
        <p className="mt-0.5 text-2xl font-bold text-brand-600">{estimate ? formatRupiah(estimate.total) : 'Rp —'}</p>
      </div>
      <div className="text-right text-sm text-slate-500">
        {estimate && (
          <p>
            {pkg.name} · {Number(persons)} org
          </p>
        )}
        <p className="text-xs">{detail}</p>
      </div>
    </div>
  )
}
