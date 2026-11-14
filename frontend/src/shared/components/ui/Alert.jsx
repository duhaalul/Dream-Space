import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

const VARIANTS = {
  error: { box: 'border-red-200 bg-red-100 text-red-700', icon: CircleAlert },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', icon: TriangleAlert },
  info: { box: 'border-brand-200 bg-brand-50 text-brand-700', icon: Info },
}

// Untuk pesan gagal simpan yang jelas (NFR-04). requestId ditampilkan
// supaya bisa dilaporkan ke tim bila terjadi error server.
export default function Alert({ variant = 'info', children, requestId, className = '' }) {
  const { box, icon: Icon } = VARIANTS[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${box} ${className}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {children}
        {requestId && <p className="mt-1 text-xs opacity-75">Kode laporan: {requestId}</p>}
      </div>
    </div>
  )
}
