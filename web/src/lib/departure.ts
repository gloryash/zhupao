/**
 * Runner departure timing. The runner either sets off immediately or delays by
 * a number of hours / minutes. {@link buildDeparturePayload} turns that choice
 * into the fields handleOrder stores (`departureMode`, `departureOffsetMinutes`,
 * `departureAt`, `departureLabel`) plus a backward-compatible `runTimeWindow`.
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
const MAX_DELAY = 24 * 60 - 1

export const DEFAULT_DEPARTURE: DepartureValue = { mode: 'immediate', offsetMinutes: 0 }

/** Default offset (30 min) applied the moment the runner switches to "delayed". */
export const DEFAULT_DELAY_MINUTES = 30

export function clampDelayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_DELAY
  return Math.max(MIN_DELAY, Math.min(MAX_DELAY, Math.round(minutes)))
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

/**
 * Build the publish payload from a {@link DepartureValue}. `now` is passed in
 * (ms epoch) so callers control the clock and tests stay deterministic.
 */
export function buildDeparturePayload(value: DepartureValue, now: number): DeparturePayload {
  if (value.mode === 'delayed') {
    const offsetMinutes = clampDelayMinutes(value.offsetMinutes)
    return {
      departureMode: 'delayed',
      departureOffsetMinutes: offsetMinutes,
      departureAt: new Date(now + offsetMinutes * 60_000).toISOString(),
      departureLabel: formatDelayLabel(offsetMinutes),
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
