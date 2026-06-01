import { useEffect, useRef } from 'react'
import { Minus, Plus, Rocket, Timer } from 'lucide-react'
import { Segmented } from './Segmented'
import { ChipGroup } from './ChipGroup'
import {
  DEFAULT_DELAY_MINUTES,
  clampDelayMinutes,
  formatDelayLabel,
  splitOffset,
  type DepartureValue
} from '../lib/departure'

const MODE_OPTIONS = [
  { value: 'immediate', label: '立即出发' },
  { value: 'delayed', label: '延后出发' }
] as const

const MINUTE_OPTIONS = [
  { value: '0', label: '00 分' },
  { value: '15', label: '15 分' },
  { value: '30', label: '30 分' },
  { value: '45', label: '45 分' }
]

const MAX_HOURS = 23

/**
 * Runner departure timing: set off now, or delay by a number of whole hours
 * plus a 15-minute increment. There is no day picker — the delay is always
 * relative to "now". The chosen offset is surfaced as a human label and an
 * estimated clock time so the runner knows exactly when help is expected.
 */
export function DepartureTimeControl({
  value,
  onChange
}: {
  value: DepartureValue
  onChange: (value: DepartureValue) => void
}) {
  const { hours, minutes } = splitOffset(value.offsetMinutes)

  const setMode = (mode: string) => {
    if (mode === 'delayed') {
      onChange({ mode: 'delayed', offsetMinutes: value.offsetMinutes > 0 ? value.offsetMinutes : DEFAULT_DELAY_MINUTES })
    } else {
      onChange({ mode: 'immediate', offsetMinutes: 0 })
    }
  }

  const setOffset = (h: number, m: number) => {
    const clampedH = Math.max(0, Math.min(MAX_HOURS, h))
    onChange({ mode: 'delayed', offsetMinutes: clampedH * 60 + m })
  }

  const isDelayed = value.mode === 'delayed'
  const effectiveOffset = clampDelayMinutes(value.offsetMinutes || DEFAULT_DELAY_MINUTES)
  const eta = new Date(Date.now() + effectiveOffset * 60_000)
  const etaLabel = eta.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

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
          <div className="departure__row">
            <span className="departure__cap">小时</span>
            <div className="stepper" role="group" aria-label="延后小时数">
              <button
                type="button"
                className="stepper__btn"
                aria-label="减少小时"
                disabled={hours <= 0}
                onClick={() => setOffset(hours - 1, minutes)}
              >
                <Minus size={16} />
              </button>
              <span className="stepper__value" aria-live="polite">
                {hours}
              </span>
              <button
                type="button"
                className="stepper__btn"
                aria-label="增加小时"
                disabled={hours >= MAX_HOURS}
                onClick={() => setOffset(hours + 1, minutes)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="departure__row departure__row--col">
            <span className="departure__cap">分钟</span>
            <ChipGroup
              ariaLabel="延后分钟数"
              value={String(minutes)}
              options={MINUTE_OPTIONS}
              onChange={(m) => setOffset(hours, Number(m))}
            />
          </div>
          <p className="departure__eta">
            <Timer size={13} /> {formatDelayLabel(effectiveOffset)} · 预计 {etaLabel} 出发
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
