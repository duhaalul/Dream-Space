// Judul halaman. "code" = kode halaman di SRS (T-01 s.d. T-11).
export default function PageHeader({ title, code, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {title}
          {code && <span className="ml-2 align-middle text-xs font-normal text-slate-400">{code}</span>}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
