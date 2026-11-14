import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { FIELD_CLASS } from './fieldClass'

// options: [{ value, label }]
export default function Select({ label, error, options = [], placeholder, className = '', id, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm text-slate-500">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={`${FIELD_CLASS} appearance-none pr-10 ${error ? 'border-red-300' : 'border-slate-200'}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
