import { useEffect, useRef } from 'react'
import { Rocket, Timer } from 'lucide-react'
import { Segmented } from './Segmented'
import {
  DEFAULT_DELAY_MINUTES,
  buildDeparturePayload,
  clockFromDepartureValue,
  createClockDepartureValue,
  type DepartureValue
} from '../lib/departure'

const MODE_OPTIONS = [
  { value: 'immediate', label: '立即出发' },
  { value: 'delayed', label: '延后出发' }
] as const

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i)

/**
 * Runner departure timing: set off now, or select an exact local clock time
 * within the next day with hour/minute wheels.
 */
export function DepartureTimeControl({
  value,
  onChange
}: {
  value: DepartureValue
  onChange: (value: DepartureValue) => void
}) {
  const clock = clockFromDepartureValue(value, Date.now())

  const setMode = (mode: string) => {
    if (mode === 'delayed') {
      const initial = value.offsetMinutes > 0
        ? clock
        : clockFromDepartureValue(
            { mode: 'delayed', offsetMinutes: DEFAULT_DELAY_MINUTES },
            Date.now()
          )
      onChange(createClockDepartureValue(initial.hour, initial.minute, Date.now()))
    } else {
      onChange({ mode: 'immediate', offsetMinutes: 0 })
    }
  }

  const setClock = (hour: number, minute: number) =>
    onChange(createClockDepartureValue(hour, minute, Date.now()))

  const isDelayed = value.mode === 'delayed'
  const departureLabel = isDelayed ? buildDeparturePayload(value, Date.now()).departureLabel : ''

  // When the runner switches to delayed mode, the delay panel can render below
  // the fixed bottom TabBar. Scroll it into a safe, visible position so the
  // hour/minute controls are reachable instead of being tapped through the nav.
  const delayRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isDelayed) return
    const id = requestAnimationFrame(() => {
      delayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [isDelayed])


  return (
    <div className="departure">
      <Segmented
        ariaLabel="出发时间"
        value={value.mode}
        options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={setMode}
      />

      {isDelayed ? (
        <div className="departure__delay" ref={delayRef}>
          <div className="time-wheel-picker" aria-label="选择延后出发时间">
            <TimeWheel
              label="小时"
              value={clock.hour}
              options={HOUR_OPTIONS}
              suffix="时"
              onChange={(hour) => setClock(hour, clock.minute)}
            />
            <TimeWheel
              label="分钟"
              value={clock.minute}
              options={MINUTE_OPTIONS}
              suffix="分"
              onChange={(minute) => setClock(clock.hour, minute)}
            />
          </div>
          <p className="departure__eta" aria-live="polite">
            <Timer size={13} /> {departureLabel}
          </p>
        </div>
      ) : (
        <p className="departure__eta">
          <Rocket size={13} /> 立即匹配志愿者，尽快出发陪跑
        </p>
      )}
    </div>
  )
}

function TimeWheel({
  label,
  value,
  options,
  suffix,
  onChange
}: {
  label: string
  value: number
  options: number[]
  suffix: string
  onChange: (value: number) => void
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [value])

  return (
    <div className="time-wheel-col">
      <span className="departure__cap">{label}</span>
      <div className="time-wheel" role="listbox" aria-label={`选择${label}`} tabIndex={0}>
        {options.map((option) => {
          const active = option === value
          const text = String(option).padStart(2, '0')
          return (
            <button
              key={option}
              ref={active ? selectedRef : undefined}
              type="button"
              className="time-wheel__option"
              role="option"
              aria-selected={active}
              data-active={active || undefined}
              onClick={() => onChange(option)}
            >
              <span>{text}</span>
              <small>{suffix}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}
