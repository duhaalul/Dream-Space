// Judul halaman bergaya desain (font display biru) + tombol aksi di kanan.
// Prop `code` (kode halaman SRS, mis. "T-03") boleh dikirim sebagai catatan, tapi tidak ditampilkan.
export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="font-display text-4xl font-black text-brand-600 font-soft sm:text-5xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
