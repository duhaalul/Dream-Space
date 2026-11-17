import { ChevronDown } from 'lucide-react'

function cell(column, row) {
  return column?.render ? column.render(row) : row[column?.key] ?? '-'
}

export default function ReportMobileRows({ code, columns, rows }) {
  const summaryKeys = code === 'sales'
    ? ['customer_name', 'amount', 'status', 'paid_at']
    : ['name', 'sales', 'payments', 'rank']
  const [name, amount, status, caption] = summaryKeys.map(key => columns.find(column => column.key === key))
  const details = columns.filter(column => !summaryKeys.includes(column.key))

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500 sm:hidden">Belum ada data pada periode ini.</p>
  }

  return (
    <ul className="divide-y divide-slate-100 sm:hidden">
      {rows.map(row => {
        const summary = (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-start gap-x-2 gap-y-1">
            <span className="break-words text-sm font-semibold text-slate-800">{cell(name, row)}</span>
            <span className="text-right text-sm wrap-anywhere">{cell(amount, row)}</span>
            <span className="text-xs text-slate-500">{cell(caption, row)}</span>
            <span className="justify-self-end">{cell(status, row)}</span>
          </div>
        )
        return (
          <li key={row.row_key ?? row.package_id} className="py-3">
            {details.length ? (
              <details className="group">
                <summary className="cursor-pointer list-none rounded-xl [&::-webkit-details-marker]:hidden">
                  {summary}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                    Detail pembayaran <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
                  </span>
                </summary>
                <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                  {details.map(column => (
                    <div key={column.key} className="grid grid-cols-2 gap-2">
                      <dt className="text-slate-500">{column.header}</dt>
                      <dd className="text-right wrap-anywhere text-slate-800">{cell(column, row)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : summary}
          </li>
        )
      })}
    </ul>
  )
}
