import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PAYMENT_METHOD_LABELS } from '@/shared/utils/constants'
import { formatRupiah } from '@/shared/utils/format'

const METHOD_META = [
  { key: 'TUNAI', label: PAYMENT_METHOD_LABELS.TUNAI, color: '#10B981' },
  { key: 'TRANSFER', label: PAYMENT_METHOD_LABELS.TRANSFER, color: '#F59E0B' },
  { key: 'QRIS', label: PAYMENT_METHOD_LABELS.QRIS, color: '#00A5E5' },
]

// Grafik cincin (donut) dan rincian penjualan per metode pembayaran (Tunai, Transfer, QRIS).
// methods = dashboard.methods: [{ method, amount }] (uang dari transaksi lunas, tanpa yang dibatalkan).
// Satu transaksi bisa dua metode (DP QRIS + pelunasan Tunai); jumlah semua metode = total penjualan.
export default function SalesMethodChart({ methods = [], total = 0 }) {
  const summary = useMemo(() => {
    const amounts = new Map(methods.map((row) => [row.method, Number(row.amount ?? 0)]))
    return METHOD_META.map((item) => {
      const amount = amounts.get(item.key) ?? 0
      return { ...item, amount, chartValue: Math.max(0, amount) }
    })
  }, [methods])

  const hasPositiveChart = summary.some((item) => item.chartValue > 0)
  const pieData = hasPositiveChart
    ? summary.filter((item) => item.chartValue > 0)
    : [{ key: 'EMPTY', label: 'Belum ada', chartValue: 1, color: '#E2E8F0' }]

  return (
    // Kartu ini sempit di layar laptop (lg–xl), jadi donat dan rincian ditumpuk ke bawah di sana.
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="chartValue"
              nameKey="label"
              innerRadius={54}
              outerRadius={76}
              paddingAngle={hasPositiveChart ? 3 : 0}
              strokeWidth={0}
            >
              {pieData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            {hasPositiveChart && (
              <Tooltip
                formatter={(value) => formatRupiah(value)}
                contentStyle={{ borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '12px' }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-[11px] text-slate-500">Total</span>
          <span className="mt-0.5 text-sm font-bold text-slate-800">{formatRupiah(total)}</span>
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-3">
        {summary.map((item) => (
          <div
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
            <span className="text-sm font-bold whitespace-nowrap text-slate-800">{formatRupiah(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
