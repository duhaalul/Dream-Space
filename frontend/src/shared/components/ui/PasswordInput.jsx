import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Input from './Input'

// Kolom kata sandi dengan tombol mata (sama dengan halaman Login):
// mata terbuka = kata sandi terlihat, mata dicoret = tersembunyi (bintang). Props lain sama dengan Input.
export default function PasswordInput(props) {
  const [shown, setShown] = useState(false)

  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          title={shown ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
        >
          {shown ? <Eye aria-hidden="true" className="h-5 w-5" /> : <EyeOff aria-hidden="true" className="h-5 w-5" />}
        </button>
      }
    />
  )
}
