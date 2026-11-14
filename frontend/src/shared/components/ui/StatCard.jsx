const TONES = {
  brand: { box: 'border-brand-200 from-white to-brand-50', accent: 'bg-brand-600', hint: 'text-brand-600' },
  green: { box: 'border-emerald-200 from-white to-emerald-50', accent: 'bg-emerald-600', hint: 'text-emerald-600' },
}

// Kartu angka ringkasan (Dashboard, Riwayat, Laporan).
// Contoh: <StatCard label="Nilai Penjualan" value="Rp540.000" hint="Periode terpilih" />
//         <StatCard tone="green" label="Sesi Selesai" value="3 Sesi" hint="✓ 11 pelanggan terlayani" />
export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const style = TONES[tone]
  return (
    <div className={`rounded-3xl border bg-linear-to-br p-5 ${style.box}`}>
      <span aria-hidden="true" className={`block h-1 w-9 rounded-full ${style.accent}`} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {Icon && <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${style.hint}`} />}
      </div>
      <p className="mt-1 text-2xl font-bold break-words text-slate-900 xl:text-3xl">{value}</p>
      {hint && <p className={`mt-1 text-xs ${style.hint}`}>{hint}</p>}
    </div>
  )
}
