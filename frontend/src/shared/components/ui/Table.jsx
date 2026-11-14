const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' }

// Tabel sesuai desain (kepala abu-abu, huruf kapital). Di layar sempit bisa digeser ke samping.
// columns: [{ key, header, align?: 'left' | 'center' | 'right', render?: (row) => isi }]
// rows: array objek; rowKey: nama field unik per baris (bawaan 'id').
// Contoh:
//   <Table
//     columns={[
//       { key: 'transaction_no', header: 'No', render: (r) => <b className="text-brand-600">{r.transaction_no}</b> },
//       { key: 'total', header: 'Total Tagihan', align: 'right', render: (r) => formatRupiah(r.total) },
//     ]}
//     rows={rows}
//   />
export default function Table({ columns, rows = [], rowKey = 'id', empty = 'Belum ada data.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={`bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase ${
                  ALIGN[column.align ?? 'left']
                } ${index === 0 ? 'rounded-l-xl' : ''} ${index === columns.length - 1 ? 'rounded-r-xl' : ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={row[rowKey] ?? rowIndex}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`border-b border-slate-100 px-4 py-3.5 text-slate-700 ${ALIGN[column.align ?? 'left']}`}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
