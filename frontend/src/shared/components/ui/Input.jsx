import { useId } from 'react'
import { FIELD_CLASS } from './fieldClass'
import { numberGuard } from './numberGuard'

// trailing: elemen kecil di sisi kanan dalam kolom (mis. tombol mata di PasswordInput).
// type="number" otomatis hanya menerima angka (tanpa "e", "+", "-", "."), lihat numberGuard.
export default function Input({ label, error, hint, className = '', id, trailing, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const guard = props.type === 'number' ? numberGuard(props) : {}

  const field = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      className={`${FIELD_CLASS} ${trailing ? 'pr-12' : ''} ${error ? 'border-red-300' : 'border-slate-200'}`}
      {...props}
      {...guard}
    />
  )

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm text-slate-500">
          {label}
        </label>
      )}
      {trailing ? (
        <div className="relative">
          {field}
          <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>
        </div>
      ) : (
        field
      )}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}
