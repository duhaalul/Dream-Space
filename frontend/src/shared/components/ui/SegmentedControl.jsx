const ACTIVE = {
  // Hijau→cyan seperti pilihan periode di Dashboard/Laporan.
  success: 'bg-linear-to-r from-emerald-500 to-cyan-500 font-semibold text-white shadow-sm',
  // Biru seperti pilihan metode bayar di Kasir.
  brand: 'bg-brand-500 font-semibold text-white shadow-sm',
}

// Pilihan satu-dari-beberapa: periode laporan, metode bayar, tab.
// options: [{ value, label }]
// Contoh: <SegmentedControl label="Periode" options={periodOptions} value={period} onChange={setPeriod} />
export default function SegmentedControl({ options, value, onChange, tone = 'success', label, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-4 py-2 text-sm whitespace-nowrap transition-colors ${
              active ? ACTIVE[tone] : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
