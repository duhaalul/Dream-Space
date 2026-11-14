import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRupiah } from '@/shared/utils/format'

const DEFAULT_HOURS = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']

function formatAxisCompact(value) {
  const num = Number(value || 0)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)} jt`
  if (num >= 1_000) return `${Math.round(num / 1_000)} rb`
  return String(num)
}

function formatShortDateLabel(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(`${dateStr}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}

function buildChartData(rows, from, to) {
  const isSingleDay = !from || !to || from === to

  if (isSingleDay) {
    const totalsByHour = new Map()
    for (const h of DEFAULT_HOURS) totalsByHour.set(h, { total: 0, count: 0 })

    for (const row of rows) {
      const timePart = String(row.completed_at ?? '').split(' ')[1] ?? ''
      const hour = timePart.slice(0, 2)
      if (!hour) continue
      const current = totalsByHour.get(hour) ?? { total: 0, count: 0 }
      totalsByHour.set(hour, {
        total: current.total + Number(row.total ?? 0),
        count: current.count + 1,
      })
    }

    return Array.from(totalsByHour.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, item]) => ({
        label: `${hour}.00`,
        total: item.total,
        count: item.count,
      }))
  }

  // Multi-hari: kelompokkan per tanggal selesai
  const byDate = new Map()
  const startMs = new Date(`${from}T00:00:00Z`).getTime()
  const endMs = new Date(`${to}T00:00:00Z`).getTime()
  const daySpan = Math.round((endMs - startMs) / 86_400_000)

  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && daySpan >= 0 && daySpan <= 31) {
    for (let i = 0; i <= daySpan; i += 1) {
      const d = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10)
      byDate.set(d, { total: 0, count: 0 })
    }
  }

  for (const row of rows) {
    const datePart = String(row.completed_at ?? '').split(' ')[0]
    if (!datePart) continue
    const current = byDate.get(datePart) ?? { total: 0, count: 0 }
    byDate.set(datePart, {
      total: current.total + Number(row.total ?? 0),
      count: current.count + 1,
    })
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, item]) => ({
      label: formatShortDateLabel(dateStr),
      fullDate: dateStr,
      total: item.total,
      count: item.count,
    }))
}

// Grafik batang penjualan (Recharts ResponsiveContainer agar nyaman di HP).
export default function SalesChart({ rows = [], from, to }) {
  const data = useMemo(() => buildChartData(rows, from, to), [rows, from, to])
  const maxTotal = useMemo(() => Math.max(0, ...data.map((d) => d.total)), [data])

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
        Belum ada transaksi selesai pada periode ini.
      </div>
    )
  }

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={formatAxisCompact}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{
              borderRadius: '16px',
              borderColor: '#E2E8F0',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
            formatter={(value, _name, item) => [
              `${formatRupiah(value)} (${item?.payload?.count ?? 0} sesi)`,
              'Nilai Penjualan',
            ]}
          />
          <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={38}>
            {data.map((entry) => {
              const isPeak = maxTotal > 0 && entry.total === maxTotal
              return (
                <Cell
                  key={entry.label}
                  fill={isPeak ? '#10B981' : '#0284C7'}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
