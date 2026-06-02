import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDeparturePayload,
  clampDelayMinutes,
  createClockDepartureValue,
  formatDelayLabel,
  nextClockDeparture,
  splitOffset
} from './departure.ts'

// A stable local 08:00 clock for departureAt assertions.
const NOW = new Date(2026, 5, 1, 8, 0, 0).getTime()

test('immediate departure produces immediate window + now timestamp', () => {
  const p = buildDeparturePayload({ mode: 'immediate', offsetMinutes: 0 }, NOW)
  assert.equal(p.departureMode, 'immediate')
  assert.equal(p.departureOffsetMinutes, 0)
  assert.equal(p.runTimeWindow, 'immediate')
  assert.equal(p.departureLabel, '立即出发')
  assert.equal(p.departureAt, new Date(NOW).toISOString())
})

test('delayed departure offsets departureAt and uses the delayed window', () => {
  const p = buildDeparturePayload({ mode: 'delayed', offsetMinutes: 90 }, NOW)
  assert.equal(p.departureMode, 'delayed')
  assert.equal(p.departureOffsetMinutes, 90)
  assert.equal(p.runTimeWindow, 'delayed')
  assert.equal(p.departureLabel, '1小时30分钟后出发')
  assert.equal(p.departureAt, new Date(NOW + 90 * 60_000).toISOString())
})

test('delayed offset is clamped to the backend-allowed range', () => {
  assert.equal(buildDeparturePayload({ mode: 'delayed', offsetMinutes: 0 }, NOW).departureOffsetMinutes, 1)
  assert.equal(clampDelayMinutes(99999), 24 * 60 - 1)
  assert.equal(clampDelayMinutes(-5), 1)
})

test('formatDelayLabel renders hours, minutes, or both', () => {
  assert.equal(formatDelayLabel(30), '30分钟后出发')
  assert.equal(formatDelayLabel(120), '2小时后出发')
  assert.equal(formatDelayLabel(135), '2小时15分钟后出发')
})

test('splitOffset decomposes minutes into hours + minutes', () => {
  assert.deepEqual(splitOffset(0), { hours: 0, minutes: 0 })
  assert.deepEqual(splitOffset(45), { hours: 0, minutes: 45 })
  assert.deepEqual(splitOffset(135), { hours: 2, minutes: 15 })
})

test('clock departure uses the selected hour and minute today when still future', () => {
  const p = buildDeparturePayload({ mode: 'delayed', offsetMinutes: 0, clockHour: 10, clockMinute: 12 }, NOW)
  assert.equal(p.departureMode, 'delayed')
  assert.equal(p.departureOffsetMinutes, 132)
  assert.equal(p.departureLabel, '今天 10:12 出发')
  assert.equal(p.departureAt, new Date(2026, 5, 1, 10, 12, 0).toISOString())
})

test('clock departure rolls past times to tomorrow', () => {
  const target = nextClockDeparture(7, 45, NOW)
  assert.equal(target.toISOString(), new Date(2026, 5, 2, 7, 45, 0).toISOString())

  const value = createClockDepartureValue(7, 45, NOW)
  assert.equal(value.clockHour, 7)
  assert.equal(value.clockMinute, 45)
  assert.equal(value.offsetMinutes, 24 * 60 - 15)
})
