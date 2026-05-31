import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Flag,
  Footprints,
  GraduationCap,
  MapPin,
  PlayCircle,
  Radio,
  RefreshCw,
  Send,
  Upload,
  X
} from 'lucide-react'
import { EmptyState, LoadingBlock, Spinner } from '../components/ui'
import { OrderCard } from '../components/OrderCard'
import { LocationPicker } from '../components/LocationPicker'
import { useToast } from '../components/Toast'
import {
  CloudError,
  acceptOrder,
  cancelOrder,
  completeOrder,
  getMyOrders,
  getOrderDetail,
  getWaitingOrders,
  publishOrder,
  updateOrderStatus,
  updateVolunteerLocation
} from '../services/api'
import { isActiveOrder } from '../lib/format'
import type { SelectedLocation } from '../types/location'
import type { Order, OrderStatus } from '../types'
import type { PageProps } from './types'

const ACTIVE_VOLUNTEER_STATUS: OrderStatus[] = ['accepted', 'arrived', 'running']

/** Activity tab. Runners (视障跑者) publish an immediate run request and watch
 *  its status; volunteers (志愿者) work the order board and drive an accepted
 *  run through arrive → run → complete. */
export function SportPage(props: PageProps) {
  return props.role === 'volunteer' ? <VolunteerSport {...props} /> : <RunnerSport {...props} />
}

/* ============================ Runner (视障跑者) ============================ */

function RunnerSport(_props: PageProps) {
  const toast = useToast()
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const loadActive = useCallback(async () => {
    setLoading(true)
    try {
      setActiveOrder(await getOrderDetail())
    } catch (err) {
      if (err instanceof CloudError) toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadActive()
  }, [loadActive])

  const submit = useCallback(async () => {
    if (submitting) return
    if (!location) {
      toast.error('请先在地图上选择起跑地点')
      return
    }
    const target = Number(distance)
    const est = Number(duration)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('请填写有效的目标距离')
      return
    }
    if (!Number.isFinite(est) || est <= 0) {
      toast.error('请填写有效的预计时长')
      return
    }
    setSubmitting(true)
    try {
      const order = await publishOrder({
        targetDistance: target,
        estimatedDuration: est,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address
      })
      toast.success('已发布陪跑请求，正在为你匹配志愿者')
      setActiveOrder(order)
      // Keep the chosen location for a quick re-publish; clear the run targets.
      setDistance('')
      setDuration('')
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '发布失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, location, distance, duration, toast])

  const cancel = useCallback(async () => {
    if (!activeOrder || cancelling) return
    setCancelling(true)
    try {
      await cancelOrder(activeOrder._id)
      toast.success('已取消该陪跑请求')
      await loadActive()
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '取消失败，请稍后再试')
    } finally {
      setCancelling(false)
    }
  }, [activeOrder, cancelling, loadActive, toast])

  const hasActiveRequest = activeOrder ? isActiveOrder(activeOrder.status) : false

  return (
    <div className="stack stagger">
      <section className="callout callout--sky">
        <div className="callout__icon">
          <MapPin size={20} />
        </div>
        <div>
          <p className="callout__title">发起陪跑</p>
          <p className="callout__text">选择起跑地点与目标距离，我们会匹配附近的认证志愿者。</p>
        </div>
      </section>

      <section className="card">
        <span className="section-title" style={{ margin: '0 0 14px' }}>
          <Send size={17} /> 陪跑请求
        </span>
        <div className="stack stack--sm">
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="sp-distance">
                目标距离（公里）
              </label>
              <input
                id="sp-distance"
                className="input"
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="例如：5"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="sp-duration">
                预计时长（分钟）
              </label>
              <input
                id="sp-duration"
                className="input"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="例如：40"
              />
            </div>
          </div>

          <LocationPicker value={location} onChange={setLocation} />

          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? <Spinner /> : <Send size={18} />}
            {submitting ? '发布中…' : '发布陪跑请求'}
          </button>
        </div>
      </section>

      <div className="stack stack--sm">
        <span className="section-title" style={{ margin: '2px 2px' }}>
          <Footprints size={17} /> 最近的订单
        </span>
        {loading ? (
          <LoadingBlock label="正在读取订单…" />
        ) : activeOrder ? (
          <OrderCard order={activeOrder}>
            {hasActiveRequest && (
              <button
                type="button"
                className="btn btn--coral btn--sm btn--block"
                onClick={() => void cancel()}
                disabled={cancelling}
              >
                {cancelling ? <Spinner /> : <X size={16} />}
                {cancelling ? '取消中…' : '取消请求'}
              </button>
            )}
          </OrderCard>
        ) : (
          <EmptyState
            icon={<Footprints size={26} />}
            title="还没有进行中的请求"
            text="填写上方表单即可发起一次陪跑。"
          />
        )}
      </div>
    </div>
  )
}

/* =========================== Volunteer (志愿者) =========================== */

function VolunteerSport({ onNavigate }: PageProps) {
  const toast = useToast()
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [waitingOrders, setWaitingOrders] = useState<Order[]>([])
  const [trainingRequired, setTrainingRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    // Orders I've already taken on — independent of the training gate.
    try {
      const mine = await getMyOrders()
      setActiveOrders(mine.filter((o) => ACTIVE_VOLUNTEER_STATUS.includes(o.status)))
    } catch (err) {
      if (err instanceof CloudError) toast.error(err.message)
    }
    // The waiting board is gated behind certification.
    try {
      const coords = await bestEffortPosition()
      const waiting = await getWaitingOrders(coords?.latitude, coords?.longitude)
      setWaitingOrders(waiting)
      setTrainingRequired(false)
    } catch (err) {
      if (err instanceof CloudError && err.code === 'TRAINING_REQUIRED') {
        setTrainingRequired(true)
        setWaitingOrders([])
      } else if (err instanceof CloudError) {
        toast.error(err.message)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <LoadingBlock label="正在加载接单广场…" />
  }

  return (
    <div className="stack stagger">
      <section className="callout callout--pine">
        <div className="callout__icon">
          <Radio size={20} />
        </div>
        <div>
          <p className="callout__title">接单广场</p>
          <p className="callout__text">接收附近的陪跑请求，认证通过后即可接单并全程陪伴。</p>
        </div>
      </section>

      {activeOrders.length > 0 && (
        <div className="stack stack--sm">
          <span className="section-title" style={{ margin: '2px 2px' }}>
            <Footprints size={17} /> 进行中的陪跑
          </span>
          {activeOrders.map((order) => (
            <VolunteerActiveOrder key={order._id} order={order} onChanged={load} />
          ))}
        </div>
      )}

      <div className="stack stack--sm">
        <div className="row row--between" style={{ padding: '0 2px' }}>
          <span className="section-title" style={{ margin: 0 }}>
            <Radio size={17} /> 等待接单
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void load()}
            disabled={refreshing}
            aria-label="刷新"
          >
            {refreshing ? <Spinner /> : <RefreshCw size={15} />}
            刷新
          </button>
        </div>

        {trainingRequired ? (
          <section className="callout callout--coral">
            <div className="callout__icon">
              <GraduationCap size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p className="callout__title">需完成陪跑认证</p>
              <p className="callout__text" style={{ marginBottom: 12 }}>
                完成培训视频与在线考核后即可接单。
              </p>
              <button
                type="button"
                className="btn btn--coral btn--sm"
                onClick={() => onNavigate('training')}
              >
                <GraduationCap size={16} /> 前往培训认证
              </button>
            </div>
          </section>
        ) : waitingOrders.length > 0 ? (
          waitingOrders.map((order) => (
            <WaitingOrder key={order._id} order={order} onAccepted={load} />
          ))
        ) : (
          <EmptyState
            icon={<Footprints size={26} />}
            title="暂无新的求助"
            text="附近暂时没有等待陪跑的跑者，稍后再来看看。"
          />
        )}
      </div>
    </div>
  )
}

/** A waiting order on the board, with an accept action. */
function WaitingOrder({ order, onAccepted }: { order: Order; onAccepted: () => Promise<void> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const accept = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await acceptOrder(order._id)
      toast.success('接单成功，请尽快前往集合点')
      await onAccepted()
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '接单失败，请稍后再试')
      setBusy(false)
    }
  }, [busy, order._id, onAccepted, toast])

  return (
    <OrderCard order={order} proximity>
      <button
        type="button"
        className="btn btn--pine btn--sm btn--block"
        onClick={() => void accept()}
        disabled={busy}
      >
        {busy ? <Spinner /> : <CheckCircle2 size={16} />}
        {busy ? '接单中…' : '接受订单'}
      </button>
    </OrderCard>
  )
}

/** An accepted order the volunteer is fulfilling. Drives the status flow
 *  accepted → arrived → running → completed, plus simulated location uploads. */
function VolunteerActiveOrder({
  order,
  onChanged
}: {
  order: Order
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [actualDistance, setActualDistance] = useState(String(order.targetDistance ?? ''))
  const [duration, setDuration] = useState(String(order.estimatedDuration ?? ''))
  const uploadsRef = useRef(0)

  const run = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      if (busy) return
      setBusy(true)
      try {
        await action()
        toast.success(label)
        await onChanged()
      } catch (err) {
        toast.error(err instanceof CloudError ? err.message : '操作失败，请稍后再试')
      } finally {
        setBusy(false)
      }
    },
    [busy, onChanged, toast]
  )

  const arrive = () => run('已标记到达集合点', () => updateOrderStatus(order._id, 'arrived'))
  const start = () => run('陪跑开始，注意安全', () => updateOrderStatus(order._id, 'running'))

  const upload = () =>
    run('已上传实时定位与配速', async () => {
      uploadsRef.current += 1
      const step = uploadsRef.current
      const coords = await bestEffortPosition()
      const dist = round2(step * 0.5)
      const dur = step * 4
      await updateVolunteerLocation({
        orderId: order._id,
        latitude: coords?.latitude ?? order.latitude ?? 0,
        longitude: coords?.longitude ?? order.longitude ?? 0,
        runningStats: { distance: dist, duration: dur, pace: computePace(dist, dur) }
      })
    })

  const complete = () => {
    const dist = Number(actualDistance)
    const dur = Number(duration)
    if (!Number.isFinite(dist) || dist <= 0) {
      toast.error('请填写有效的实际距离')
      return
    }
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error('请填写有效的陪跑时长')
      return
    }
    void run('陪跑已完成，感谢你的付出', () => completeOrder(order._id, dist, dur))
  }

  const cancel = () => run('已取消该订单', () => cancelOrder(order._id))

  return (
    <OrderCard order={order}>
      {order.status === 'accepted' && (
        <button
          type="button"
          className="btn btn--accent btn--sm btn--block"
          onClick={arrive}
          disabled={busy}
        >
          {busy ? <Spinner /> : <Flag size={16} />} 标记已到达
        </button>
      )}

      {order.status === 'arrived' && (
        <button
          type="button"
          className="btn btn--pine btn--sm btn--block"
          onClick={start}
          disabled={busy}
        >
          {busy ? <Spinner /> : <PlayCircle size={16} />} 开始陪跑
        </button>
      )}

      {order.status === 'running' && (
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--block"
            style={{ border: '1.5px solid var(--line)' }}
            onClick={upload}
            disabled={busy}
          >
            {busy ? <Spinner /> : <Upload size={16} />} 上传定位 / 配速
          </button>
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor={`done-dist-${order._id}`}>
                实际距离（公里）
              </label>
              <input
                id={`done-dist-${order._id}`}
                className="input"
                inputMode="decimal"
                value={actualDistance}
                onChange={(e) => setActualDistance(e.target.value)}
                placeholder="例如：5"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`done-dur-${order._id}`}>
                陪跑时长（分钟）
              </label>
              <input
                id={`done-dur-${order._id}`}
                className="input"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="例如：40"
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn--accent btn--sm btn--block"
            onClick={complete}
            disabled={busy}
          >
            {busy ? <Spinner /> : <CheckCircle2 size={16} />} 完成陪跑
          </button>
        </>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--sm btn--block"
        onClick={cancel}
        disabled={busy}
      >
        <X size={16} /> 取消订单
      </button>
    </OrderCard>
  )
}

/* -------------------------------- helpers --------------------------------- */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Format a pace (minutes per km) as m'ss"/km from distance + duration. */
function computePace(distanceKm: number, durationMin: number): string {
  if (distanceKm <= 0) return ''
  const perKm = durationMin / distanceKm
  const min = Math.floor(perKm)
  const sec = Math.round((perKm - min) * 60)
  return `${min}'${String(sec).padStart(2, '0')}"/km`
}

/** Best-effort browser geolocation; resolves to null instead of rejecting so
 *  callers can fall back to a stored coordinate. */
function bestEffortPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  })
}
