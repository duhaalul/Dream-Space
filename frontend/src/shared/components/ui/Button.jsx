// Varian sesuai desain Figma:
//   primary      biru gradien        (Terima Pembayaran, Simpan, Masuk)
//   success      hijau→cyan gradien  (Datang Langsung, Mulai Foto, Selesaikan)
//   warning      oranye→merah        (Panggil)
//   secondary    putih bergaris      (Reservasi WhatsApp)
//   soft         biru muda           (Ke Kasir, Kembalikan ke Antrean)
//   soft-success hijau muda          (Unduh Excel)
//   danger       merah muda          (Batalkan, Unduh PDF)
//   neutral      abu-abu             (Lewati)
//   ghost        transparan          (tombol ikon)
const VARIANTS = {
  primary: 'bg-linear-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 hover:brightness-105',
  success: 'bg-linear-to-r from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/25 hover:brightness-105',
  warning: 'bg-linear-to-r from-amber-500 to-red-500 text-white shadow-md shadow-orange-500/25 hover:brightness-105',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  soft: 'bg-brand-100 text-brand-600 hover:bg-brand-200/70',
  'soft-success': 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200/70',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200/70',
  neutral: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

const SIZES = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-sm',
}

// Selama loading tombol dinonaktifkan, supaya formulir tidak terkirim dua kali (NFR-02).
export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
