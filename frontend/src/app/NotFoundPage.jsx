import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-semibold text-indigo-600">404</p>
      <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-1 text-sm text-slate-500">Alamat yang dibuka tidak ada di aplikasi Dream Space.</p>
      <Link to="/" className="mt-6 text-sm font-medium text-indigo-600 hover:underline">
        Kembali ke halaman awal
      </Link>
    </div>
  )
}
