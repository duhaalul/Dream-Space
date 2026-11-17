const ACTIVE = {
  // Hijau→cyan seperti pilihan periode di Dashboard/Laporan.
  success: 'bg-linear-to-r from-emerald-500 to-cyan-500 font-semibold text-white shadow-sm',
  // Biru seperti pilihan metode bayar di Kasir.
  brand: 'bg-brand-500 font-semibold text-white shadow-sm',
}

// Pilihan satu-dari-beberapa: periode laporan, metode bayar, tab.
// options: [{ value, label, icon?, disabled?, title? }] — icon (opsional) = komponen ikon lucide-react;
// disabled = pilihan tampil tapi belum bisa dipilih (title = alasannya, muncul saat diarahkan kursor).
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
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? ACTIVE[tone] : 'text-slate-500 enabled:hover:text-slate-700'
            }`}
          >
            {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
