import { useMemo, useState, type ReactNode } from 'react'
import {
  Clock,
  Gauge,
  Hash,
  MapPin,
  Navigation,
  Phone,
  Route,
  ShieldCheck,
  UserRound
} from 'lucide-react'
import { Avatar, Sheet } from './ui'
import {
  ORDER_STATUS_CHIP,
  ORDER_STATUS_LABEL,
  formatDistance,
  formatMeters,
  formatMinutes
} from '../lib/format'
import { destinationAddress, startAddress } from '../lib/orderGeo'
import { getOrderCounterparty, type OrderParty } from '../lib/orderParties'
import type { Order, UserType } from '../types'

/** Presentational summary of a single run order, shared across the runner and
 *  volunteer flows. Pass `proximity` to surface the backend distance (waiting
 *  board only) and `children` to slot in role-specific action buttons. */
export function OrderCard({
  order,
  proximity = false,
  viewerRole,
  children
}: {
  order: Order
  proximity?: boolean
  viewerRole?: UserType
  children?: ReactNode
}) {
  const [detailParty, setDetailParty] = useState<OrderParty | null>(null)
  const near = proximity && Number.isFinite(order.distance) ? formatMeters(order.distance) : ''
  const stats = order.runningStats
  const start = startAddress(order)
  const dest = destinationAddress(order)
  const counterparty = useMemo(
    () => (viewerRole ? getOrderCounterparty(order, viewerRole) : null),
    [order, viewerRole]
  )

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

      {counterparty ? (
        <button
          type="button"
          className="order-card__party order-card__party-btn"
          onClick={() => setDetailParty(counterparty)}
          aria-label={`查看${counterparty.label}${counterparty.name}账号详情${
            counterparty.phone ? `，电话${counterparty.phone}` : ''
          }`}
        >
          <UserRound size={14} aria-hidden />
          <span className="order-card__party-main">
            {counterparty.label} · {counterparty.name}
          </span>
          {counterparty.phone && (
            <span className="order-card__party-phone">
              <Phone size={13} aria-hidden /> {counterparty.phone}
            </span>
          )}
          {!counterparty.phone && counterparty.account && (
            <span className="order-card__party-account">
              <Hash size={13} aria-hidden /> {counterparty.account}
            </span>
          )}
        </button>
      ) : (
        <>
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
        </>
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

      {detailParty && (
        <AccountDetailSheet party={detailParty} onClose={() => setDetailParty(null)} />
      )}
    </article>
  )
}

function AccountDetailSheet({ party, onClose }: { party: OrderParty; onClose: () => void }) {
  return (
    <Sheet title="账号详情" onClose={onClose}>
      <div className="account-sheet stack stack--sm">
        <section className="account-sheet__hero">
          <Avatar name={party.name} src={party.avatarUrl} size={58} />
          <div className="account-sheet__identity">
            <span className={`chip ${party.role === 'volunteer' ? 'chip--pine' : 'chip--accent'}`}>
              {party.label}
            </span>
            <h3>{party.name}</h3>
            {party.account && (
              <p>
                <Hash size={13} aria-hidden /> {party.account}
              </p>
            )}
          </div>
        </section>

        {party.phone && (
          <a className="btn btn--accent btn--block account-sheet__phone" href={`tel:${party.phone}`}>
            <Phone size={18} /> {party.phone}
          </a>
        )}

        <div className="account-sheet__details">
          {party.details.map((row) => (
            <div className="account-sheet__row" key={`${row.label}-${row.value}`}>
              <span>
                {detailIcon(row.label)}
                {row.label}
              </span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

function detailIcon(label: string) {
  if (label.includes('手机')) return <Phone size={14} aria-hidden />
  if (label.includes('账号')) return <Hash size={14} aria-hidden />
  if (label.includes('身份') || label.includes('认证') || label.includes('证书')) {
    return <ShieldCheck size={14} aria-hidden />
  }
  if (label.includes('配速') || label.includes('里程') || label.includes('次数')) {
    return <Gauge size={14} aria-hidden />
  }
  return <UserRound size={14} aria-hidden />
}
