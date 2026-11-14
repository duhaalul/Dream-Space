import { useId } from 'react'

// options: [{ value, label }]
export default function Select({ label, error, options = [], placeholder, className = '', id, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? 'border-red-400' : 'border-slate-300'
        }`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
