import logoDs from '@/assets/logo-ds.png'

const SIZES = {
  sm: 'h-10 w-10 rounded-xl p-1.5',
  md: 'h-14 w-14 rounded-2xl p-2',
  lg: 'h-20 w-20 rounded-3xl p-3',
}

// Logo Dream Space dalam kotak biru (Login, menu samping).
// Gambar logo: src/assets/logo-ds.png. Ganti dengan ekspor resmi dari Figma bila sudah ada.
export default function BrandLogo({ size = 'md', className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center bg-linear-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/30 ${SIZES[size]} ${className}`}
    >
      <img src={logoDs} alt="Dream Space" className="h-full w-full object-contain" />
    </span>
  )
}
