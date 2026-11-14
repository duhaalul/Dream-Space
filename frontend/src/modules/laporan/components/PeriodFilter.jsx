import { CalendarRange } from 'lucide-react'
import { Button, Input, SegmentedControl } from '@/shared/components/ui'
import { REPORT_PERIODS } from '@/shared/utils/constants'

const PERIOD_OPTIONS = Object.entries(REPORT_PERIODS).map(([value, label]) => ({
  value,
  label,
}))

// Komponen pemilih periode yang dipakai bersama oleh Dashboard dan Laporan.
export default function PeriodFilter({
  period,
  from,
  to,
  onPeriodChange,
  onFromChange,
  onToChange,
  onApplyCustom,
  loading = false,
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <SegmentedControl
        label="Periode laporan"
        options={PERIOD_OPTIONS}
        value={period}
        onChange={onPeriodChange}
      />

      {period === 'custom' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onApplyCustom?.()
          }}
          className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs"
        >
          <div className="min-w-36 flex-1 sm:flex-initial">
            <Input
              label="Dari Tanggal"
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
            />
          </div>
          <div className="min-w-36 flex-1 sm:flex-initial">
            <Input
              label="Sampai Tanggal"
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
            />
          </div>
          <Button type="submit" size="md" variant="primary" loading={loading}>
            <CalendarRange aria-hidden="true" className="h-4 w-4" />
            Tampilkan
          </Button>
        </form>
      )}
    </div>
  )
}
