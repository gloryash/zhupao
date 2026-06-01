import type { ReactNode } from 'react'
import { Clock, MapPin, Navigation, Route, UserRound, Gauge } from 'lucide-react'
import {
  ORDER_STATUS_CHIP,
  ORDER_STATUS_LABEL,
  formatDistance,
  formatMeters,
  formatMinutes
} from '../lib/format'
import { destinationAddress, startAddress } from '../lib/orderGeo'
import type { Order } from '../types'

/** Presentational summary of a single run order, shared across the runner and
 *  volunteer flows. Pass `proximity` to surface the backend distance (waiting
 *  board only) and `children` to slot in role-specific action buttons. */
export function OrderCard({
  order,
  proximity = false,
  children
}: {
  order: Order
  proximity?: boolean
  children?: ReactNode
}) {
  const near = proximity && Number.isFinite(order.distance) ? formatMeters(order.distance) : ''
  const stats = order.runningStats
  const start = startAddress(order)
  const dest = destinationAddress(order)

  return (
    <article className="card">
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <span className={`chip ${ORDER_STATUS_CHIP[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
        {near && (
          <span className="metric-tag">
            <Navigation size={13} /> {near}
          </span>
        )}
      </div>

      {dest ? (
        <div className="order-card__route">
          <p className="order-card__addr order-card__addr--start">
            <span className="addr-dot addr-dot--start" aria-hidden />
            <span>{start || '未填写起点'}</span>
          </p>
          <p className="order-card__addr order-card__addr--dest">
            <span className="addr-dot addr-dot--destination" aria-hidden />
            <span>{dest}</span>
          </p>
        </div>
      ) : (
        <p className="order-card__addr">
          <MapPin size={16} aria-hidden />
          <span>{start || '未填写地点'}</span>
        </p>
      )}

      <div className="order-card__meta">
        <span>
          <Route size={14} aria-hidden /> 目标 {formatDistance(order.targetDistance)}
        </span>
        <span>
          <Clock size={14} aria-hidden /> 预计 {formatMinutes(order.estimatedDuration)}
        </span>
      </div>

      {order.userName && (
        <p className="order-card__party">
          <UserRound size={14} aria-hidden /> 发起人 · {order.userName}
        </p>
      )}
      {order.volunteerName && (
        <p className="order-card__party">
          <UserRound size={14} aria-hidden /> 陪跑志愿者 · {order.volunteerName}
        </p>
      )}

      {stats && (stats.distance > 0 || stats.duration > 0) && (
        <p className="order-card__party">
          <Gauge size={14} aria-hidden /> 实时 · {stats.distance} km · {stats.duration} 分钟
          {stats.pace ? ` · ${stats.pace}` : ''}
        </p>
      )}

      {order.status === 'completed' && (
        <p className="order-card__party">
          <Route size={14} aria-hidden /> 完成 {formatDistance(order.actualDistance)} ·{' '}
          {formatMinutes(order.duration)}
        </p>
      )}

      {children && <div className="order-card__actions">{children}</div>}
    </article>
  )
}
