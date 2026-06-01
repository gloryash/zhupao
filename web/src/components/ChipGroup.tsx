import type { Option } from '../lib/orderFilters'

/**
 * A wrap-around group of single-select chips, for choice sets that are too
 * large for a one-row {@link Segmented} control (age ranges, city presets,
 * departure windows). Selection is stable and inline — no native dropdown that
 * can detach to a viewport corner.
 */
export function ChipGroup<T extends string>({
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
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {normalized.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            className={`chip chip-toggle${on ? ' chip-toggle--on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(opt.value as T)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
