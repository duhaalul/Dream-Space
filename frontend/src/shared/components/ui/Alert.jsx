const VARIANTS = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

// Untuk pesan gagal simpan yang jelas (NFR-04). requestId ditampilkan
// supaya bisa dilaporkan ke tim bila terjadi error server.
export default function Alert({ variant = 'info', children, requestId, className = '' }) {
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${VARIANTS[variant]} ${className}`}>
      {children}
      {requestId && <p className="mt-1 text-xs opacity-75">Kode laporan: {requestId}</p>}
    </div>
  )
}
