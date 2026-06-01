import type { Option } from '../lib/orderFilters'

/**
 * A compact segmented control built on the global `.segmented` styles. Used for
 * mutually-exclusive choices that comfortably fit one row (duration, time
 * window). `options` may be {@link Option} objects or plain strings.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: T
  options: ReadonlyArray<Option | T>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {normalized.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value as T)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
