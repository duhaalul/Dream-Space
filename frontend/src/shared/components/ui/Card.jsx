// Kartu putih sesuai desain. description = subjudul abu-abu di bawah judul (opsional).
export default function Card({ title, description, actions, className = '', children }) {
  return (
    <section className={`rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-bold text-slate-800">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
