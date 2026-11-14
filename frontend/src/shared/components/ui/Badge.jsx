const TONES = {
  gray: 'bg-slate-100 text-slate-700',
  blue: 'bg-sky-100 text-sky-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
}

// tone untuk status kunjungan: lihat VISIT_STATUS_TONES di shared/utils/constants.js
export default function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}
