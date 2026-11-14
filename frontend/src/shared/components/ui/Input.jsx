import { useId } from 'react'

export default function Input({ label, error, hint, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? 'border-red-400' : 'border-slate-300'
        }`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}
