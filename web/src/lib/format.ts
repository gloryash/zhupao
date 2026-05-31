import type { AppointmentStatus, OrderStatus } from '../types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  waiting: '等待接单',
  accepted: '已接单',
  arrived: '已到达',
  running: '陪跑中',
  completed: '已完成',
  cancelled: '已取消'
}

export const ORDER_STATUS_CHIP: Record<OrderStatus, string> = {
  waiting: 'chip--sky',
  accepted: 'chip--accent',
  arrived: 'chip--accent',
  running: 'chip--pine',
  completed: 'chip',
  cancelled: 'chip--coral'
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消'
}

export const APPOINTMENT_STATUS_CHIP: Record<AppointmentStatus, string> = {
  pending: 'chip--sky',
  confirmed: 'chip--pine',
  completed: 'chip',
  cancelled: 'chip--coral'
}

export function formatDistance(value: number | string | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${n} km`
}

export function formatMeters(m: number | undefined): string {
  if (!m || !Number.isFinite(m)) return ''
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

/** Render a minute count (string or number) as a compact 分钟 label. */
export function formatMinutes(value: number | string | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${n} 分钟`
}

/** Order statuses that are still in progress (cancellable / actionable). */
export function isActiveOrder(status: OrderStatus): boolean {
  return status !== 'completed' && status !== 'cancelled'
}

export function tierBadge(level?: number): string {
  return `Lv.${level || 1}`
}

export function expProgress(exp = 0): { pct: number; toNext: number; level: number } {
  const level = Math.floor(exp / 100) + 1
  const into = exp % 100
  return { pct: into, toNext: 100 - into, level }
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
