import { useId } from 'react'
import { FIELD_CLASS } from './fieldClass'

export default function Input({ label, error, hint, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm text-slate-500">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} ${error ? 'border-red-300' : 'border-slate-200'}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}
