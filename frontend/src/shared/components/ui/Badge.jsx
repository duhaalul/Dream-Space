const TONES = {
  gray: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-100 text-brand-600',
  blue: 'bg-brand-100 text-brand-600',
  indigo: 'bg-indigo-100 text-indigo-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
}

// Label kecil berbentuk pil, mis. "Belum Lunas" (amber), "DP Rp50.000" (green), "Kosong" (brand).
// tone untuk status kunjungan: lihat VISIT_STATUS_TONES di shared/utils/constants.js
export default function Badge({ tone = 'gray', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
