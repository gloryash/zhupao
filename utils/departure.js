const DEFAULT_DEPARTURE = { mode: 'immediate', offsetMinutes: 0 };
const DEFAULT_DELAY_MINUTES = 30;
const MAX_DELAY_MINUTES = 24 * 60 - 1;

function clampDelayMinutes(minutes) {
  const n = Math.round(Number(minutes));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_DELAY_MINUTES, n));
}

function formatClockTime(hour, minute) {
  const h = Math.max(0, Math.min(23, Math.round(Number(hour) || 0)));
  const m = Math.max(0, Math.min(59, Math.round(Number(minute) || 0)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function nextClockDeparture(hour, minute, now) {
  const base = new Date(now);
  const target = new Date(base);
  target.setHours(Math.max(0, Math.min(23, Number(hour) || 0)), Math.max(0, Math.min(59, Number(minute) || 0)), 0, 0);
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  return target;
}

function formatClockDepartureLabel(target, now) {
  const sameDay = new Date(now).toDateString() === target.toDateString();
  return `${sameDay ? '今天' : '明天'} ${formatClockTime(target.getHours(), target.getMinutes())} 出发`;
}

function createClockDeparture(hour, minute, now = Date.now()) {
  const target = nextClockDeparture(hour, minute, now);
  return {
    mode: 'delayed',
    offsetMinutes: clampDelayMinutes(Math.ceil((target.getTime() - now) / 60000)),
    clockHour: target.getHours(),
    clockMinute: target.getMinutes()
  };
}

function buildDeparturePayload(value, now = Date.now()) {
  const v = value || DEFAULT_DEPARTURE;
  if (v.mode === 'delayed') {
    const target = Number.isFinite(Number(v.clockHour)) && Number.isFinite(Number(v.clockMinute))
      ? nextClockDeparture(v.clockHour, v.clockMinute, now)
      : new Date(now + clampDelayMinutes(v.offsetMinutes || DEFAULT_DELAY_MINUTES) * 60000);
    const offsetMinutes = clampDelayMinutes(Math.ceil((target.getTime() - now) / 60000));
    return {
      departureMode: 'delayed',
      departureOffsetMinutes: offsetMinutes,
      departureAt: target.toISOString(),
      departureLabel: formatClockDepartureLabel(target, now),
      runTimeWindow: 'delayed'
    };
  }
  return {
    departureMode: 'immediate',
    departureOffsetMinutes: 0,
    departureAt: new Date(now).toISOString(),
    departureLabel: '立即出发',
    runTimeWindow: 'immediate'
  };
}

module.exports = {
  DEFAULT_DEPARTURE,
  DEFAULT_DELAY_MINUTES,
  createClockDeparture,
  buildDeparturePayload,
  formatClockTime
};
