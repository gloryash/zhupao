/**
 * Runner departure timing. The runner either sets off immediately or chooses a
 * concrete clock time within the next day. {@link buildDeparturePayload} turns
 * that choice into the fields handleOrder stores (`departureMode`,
 * `departureOffsetMinutes`, `departureAt`, `departureLabel`) plus a
 * backward-compatible `runTimeWindow`.
 *
 * The clamping + label rules mirror handleOrder's `normalizeDeparture` so the
 * value the runner sees matches what the backend persists and what volunteers
 * filter on.
 */

export type DepartureMode = 'immediate' | 'delayed'

/** The runner's raw choice, held in component state. */
export interface DepartureValue {
  mode: DepartureMode
  /** Delay in minutes from "now"; ignored when `mode` is `immediate`. */
  offsetMinutes: number
  /** Exact local clock time selected by the runner; used when delayed. */
  clockHour?: number
  clockMinute?: number
}

/** The fields submitted to handleOrder `publish`. */
export interface DeparturePayload {
  departureMode: DepartureMode
  departureOffsetMinutes: number
  departureAt: string
  departureLabel: string
  runTimeWindow: string
}

const MIN_DELAY = 1

export const DEFAULT_DEPARTURE: DepartureValue = { mode: 'immediate', offsetMinutes: 0 }

/** Default offset (30 min) applied the moment the runner switches to "delayed". */
export const DEFAULT_DELAY_MINUTES = 30

export const MAX_DELAY_MINUTES = 24 * 60 - 1

export function clampDelayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_DELAY
  return Math.max(MIN_DELAY, Math.min(MAX_DELAY_MINUTES, Math.round(minutes)))
}

/** "X小时Y分钟后出发", matching the backend's `formatDelayLabel`. */
export function formatDelayLabel(minutes: number): string {
  const total = clampDelayMinutes(minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟后出发`
  if (hours > 0) return `${hours}小时后出发`
  return `${mins}分钟后出发`
}

export function formatClockTime(hour: number, minute: number): string {
  const h = Math.max(0, Math.min(23, Math.round(hour)))
  const m = Math.max(0, Math.min(59, Math.round(minute)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function nextClockDeparture(hour: number, minute: number, now: number): Date {
  const base = new Date(now)
  const target = new Date(base)
  target.setHours(
    Math.max(0, Math.min(23, Math.round(hour))),
    Math.max(0, Math.min(59, Math.round(minute))),
    0,
    0
  )
  if (target.getTime() <= now) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

export function createClockDepartureValue(hour: number, minute: number, now: number): DepartureValue {
  const target = nextClockDeparture(hour, minute, now)
  const offsetMinutes = clampDelayMinutes(Math.ceil((target.getTime() - now) / 60_000))
  return {
    mode: 'delayed',
    offsetMinutes,
    clockHour: target.getHours(),
    clockMinute: target.getMinutes()
  }
}

export function clockFromDepartureValue(value: DepartureValue, now: number): { hour: number; minute: number } {
  if (
    value.mode === 'delayed' &&
    Number.isFinite(value.clockHour) &&
    Number.isFinite(value.clockMinute)
  ) {
    return {
      hour: Math.max(0, Math.min(23, Math.round(value.clockHour as number))),
      minute: Math.max(0, Math.min(59, Math.round(value.clockMinute as number)))
    }
  }
  const target = new Date(now + clampDelayMinutes(value.offsetMinutes || DEFAULT_DELAY_MINUTES) * 60_000)
  return { hour: target.getHours(), minute: target.getMinutes() }
}

export function formatClockDepartureLabel(target: Date, now: number): string {
  const clock = formatClockTime(target.getHours(), target.getMinutes())
  const today = localDateKey(new Date(now))
  const day = localDateKey(target)
  return `${day === today ? '今天' : '明天'} ${clock} 出发`
}

/**
 * Build the publish payload from a {@link DepartureValue}. `now` is passed in
 * (ms epoch) so callers control the clock and tests stay deterministic.
 */
export function buildDeparturePayload(value: DepartureValue, now: number): DeparturePayload {
  if (value.mode === 'delayed') {
    const hasClock =
      Number.isFinite(value.clockHour) && Number.isFinite(value.clockMinute)
    const target = hasClock
      ? nextClockDeparture(value.clockHour as number, value.clockMinute as number, now)
      : new Date(now + clampDelayMinutes(value.offsetMinutes) * 60_000)
    const offsetMinutes = clampDelayMinutes(Math.ceil((target.getTime() - now) / 60_000))
    return {
      departureMode: 'delayed',
      departureOffsetMinutes: offsetMinutes,
      departureAt: target.toISOString(),
      departureLabel: hasClock ? formatClockDepartureLabel(target, now) : formatDelayLabel(offsetMinutes),
      runTimeWindow: 'delayed'
    }
  }
  return {
    departureMode: 'immediate',
    departureOffsetMinutes: 0,
    departureAt: new Date(now).toISOString(),
    departureLabel: '立即出发',
    runTimeWindow: 'immediate'
  }
}

/** Split an offset into whole hours + remaining minutes for the stepper UI. */
export function splitOffset(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes) || 0)
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
