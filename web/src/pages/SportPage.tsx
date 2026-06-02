import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Footprints,
  GraduationCap,
  Hourglass,
  LocateFixed,
  MapPin,
  Navigation,
  PlayCircle,
  Radio,
  RefreshCw,
  Route,
  Send,
  SlidersHorizontal,
  Timer,
  Upload,
  X
} from 'lucide-react'
import { EmptyState, LoadingBlock, Sheet, Spinner } from '../components/ui'
import { OrderCard } from '../components/OrderCard'
import { AddressSearchField } from '../components/AddressSearchField'
import { Segmented } from '../components/Segmented'
import { ChipGroup } from '../components/ChipGroup'
import { DepartureTimeControl } from '../components/DepartureTimeControl'
import { RouteMap } from '../components/RouteMap'
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
  updateVolunteerLocation,
  type WaitingOrderFilters
} from '../services/api'
import { reverseGeocodeAddress, straightLineDistanceKm } from '../services/location'
import { isActiveOrder, formatMeters, formatMinutes } from '../lib/format'
import { getRunnerOrderVoiceCue, speakRunnerOrderVoiceCue } from '../lib/orderVoiceCue'
import { DEFAULT_DEPARTURE, buildDeparturePayload, type DepartureValue } from '../lib/departure'
import {
  AGE_FILTERS,
  CITY_MODES,
  CITY_PRESETS,
  DEFAULT_DISTANCE_METERS,
  DEPARTURE_FILTER_TYPES,
  DISTANCE_RANGE_OPTIONS,
  DURATIONS,
  GENDER_FILTERS,
  WITHIN_MINUTES_OPTIONS,
  distanceRangeLabel,
  genderLabel,
  timeWindowLabel,
  type CityMode,
  type DepartureFilterType
} from '../lib/orderFilters'
import {
  destinationAddress,
  orderDestination,
  orderRunnerPoint,
  orderStart,
  orderVolunteerPoint,
  startAddress
} from '../lib/orderGeo'
import type { GeoAddress, LatLng } from '../types/location'
import type { Order, OrderStatus } from '../types'
import type { PageProps } from './types'

const ACTIVE_VOLUNTEER_STATUS: OrderStatus[] = ['accepted', 'arrived', 'running']

/** Fallback position (People's Square, Shanghai) so local QA can still see the
 *  Shanghai test demand when browser geolocation is denied/unavailable. */
const SHANGHAI: LatLng = { latitude: 31.2304, longitude: 121.4737 }

/** Activity tab. Runners (视障跑者) publish a companion-run request by searching
 *  a start + destination address; volunteers (志愿者) browse nearby demand,
 *  inspect the route, accept, and drive it through arrive → run → complete. */
export function SportPage(props: PageProps) {
  return props.role === 'volunteer' ? <VolunteerSport {...props} /> : <RunnerSport {...props} />
}

/* ============================ Runner (视障跑者) ============================ */

function RunnerSport(_props: PageProps) {
  const toast = useToast()
  const [start, setStart] = useState<GeoAddress | null>(null)
  const [destination, setDestination] = useState<GeoAddress | null>(null)
  const [duration, setDuration] = useState(45)
  const [departure, setDeparture] = useState<DepartureValue>(DEFAULT_DEPARTURE)
  const [submitting, setSubmitting] = useState(false)

  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null)

  // Resolve a best-effort position once so map-pick mode opens near the user.
  useEffect(() => {
    let active = true
    void bestEffortPosition().then((p) => {
      if (active && p) setMapCenter(p)
    })
    return () => {
      active = false
    }
  }, [])

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

  const targetDistance = useMemo(() => {
    if (!start || !destination) return 0
    return straightLineDistanceKm(
      start.latitude,
      start.longitude,
      destination.latitude,
      destination.longitude
    )
  }, [start, destination])

  const ready = Boolean(start && destination)

  const departureLabel = useMemo(
    () => buildDeparturePayload(departure, Date.now()).departureLabel,
    [departure]
  )

  const submit = useCallback(async () => {
    if (submitting || !start || !destination) return
    setSubmitting(true)
    try {
      const dep = buildDeparturePayload(departure, Date.now())
      const order = await publishOrder({
        origin: {
          latitude: start.latitude,
          longitude: start.longitude,
          address: start.address,
          city: start.city
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address,
          city: destination.city
        },
        targetDistance,
        estimatedDuration: duration,
        runTimeWindow: dep.runTimeWindow,
        departureMode: dep.departureMode,
        departureOffsetMinutes: dep.departureOffsetMinutes,
        departureAt: dep.departureAt,
        departureLabel: dep.departureLabel,
        city: start.city || destination.city
      })
      toast.success(getRunnerOrderVoiceCue('publishSuccess'))
      speakRunnerOrderVoiceCue('publishSuccess')
      // Use the order returned by publish directly — no extra reload.
      setActiveOrder(order)
      // Keep the start for a quick re-publish; clear the destination.
      setDestination(null)
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '发布失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, start, destination, targetDistance, duration, departure, toast])

  const cancel = useCallback(async () => {
    if (!activeOrder || cancelling) return
    setCancelling(true)
    try {
      await cancelOrder(activeOrder._id)
      toast.success(getRunnerOrderVoiceCue('cancelSuccess'))
      speakRunnerOrderVoiceCue('cancelSuccess')
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
          <p className="callout__text">像打车一样，搜索起点与终点地址，我们会匹配附近的认证志愿者。</p>
        </div>
      </section>

      <section className="card">
        <span className="section-title" style={{ margin: '0 0 14px' }}>
          <Send size={17} /> 陪跑请求
        </span>
        <div className="stack stack--sm">
          <AddressSearchField
            field="start"
            tone="start"
            label="起点"
            placeholder="搜索小区 / 地标 / 街道，如「世纪公园」"
            value={start}
            onChange={setStart}
            mapCenter={mapCenter}
          />
          <AddressSearchField
            field="destination"
            tone="destination"
            label="终点"
            placeholder="搜索目的地，如「徐家汇」"
            value={destination}
            onChange={setDestination}
            mapCenter={mapCenter}
          />

          <div className="field">
            <span className="field__label">
              <Timer size={14} /> 预计时长
            </span>
            <Segmented
              ariaLabel="预计时长"
              value={String(duration)}
              options={DURATIONS.map((d) => ({ value: String(d), label: `${d} 分钟` }))}
              onChange={(v) => setDuration(Number(v))}
            />
          </div>

          <div className="field">
            <span className="field__label">
              <Clock size={14} /> 出发时间
            </span>
            <DepartureTimeControl value={departure} onChange={setDeparture} />
          </div>
        </div>
      </section>

      {ready && start && destination ? (
        <section className="card confirm">
          <span className="section-title" style={{ margin: '0 0 12px' }}>
            <CheckCircle2 size={17} /> 确认并发布
          </span>
          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={() => void submit()}
            disabled={submitting}
            style={{ marginBottom: 14 }}
          >
            {submitting ? <Spinner /> : <Send size={18} />}
            {submitting ? '发布中…' : '确认发布陪跑需求'}
          </button>
          <dl className="confirm__grid">
            <div>
              <dt>
                <span className="addr-dot addr-dot--start" aria-hidden /> 起点
              </dt>
              <dd>{start.address}</dd>
            </div>
            <div>
              <dt>
                <span className="addr-dot addr-dot--destination" aria-hidden /> 终点
              </dt>
              <dd>{destination.address}</dd>
            </div>
            <div className="confirm__row">
              <span>
                <Route size={14} /> 直线距离 {targetDistance} km
              </span>
              <span>
                <Timer size={14} /> {formatMinutes(duration)}
              </span>
              <span>
                <Clock size={14} /> {departureLabel}
              </span>
            </div>
          </dl>
        </section>
      ) : (
        <p className="faint" style={{ textAlign: 'center', fontSize: 13, padding: '2px 8px' }}>
          选择起点与终点后即可确认并发布陪跑请求。
        </p>
      )}

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
            text="搜索起点与终点即可发起一次陪跑。"
          />
        )}
      </div>
    </div>
  )
}

/* =========================== Volunteer (志愿者) =========================== */

interface BoardFilters {
  maxDistance: number
  gender: string
  ageRange: string
  departureType: DepartureFilterType
  departureWithinMinutes: number
  departureHour: number
  departureDate: string
  cityMode: CityMode
  cityValue: string
}

const DEFAULT_FILTERS: BoardFilters = {
  maxDistance: DEFAULT_DISTANCE_METERS,
  gender: 'all',
  ageRange: 'all',
  departureType: 'all',
  departureWithinMinutes: 30,
  departureHour: new Date().getHours(),
  departureDate: '',
  cityMode: 'all',
  cityValue: ''
}

/** Resolve the city string sent to the backend from the city-mode selection. */
function resolveCityFilter(filters: BoardFilters, currentCity: string): string {
  if (filters.cityMode === 'current') return currentCity || 'all'
  if (filters.cityMode === 'custom') return filters.cityValue.trim() || 'all'
  return 'all'
}

function VolunteerSport({ onNavigate }: PageProps) {
  const toast = useToast()
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [waitingOrders, setWaitingOrders] = useState<Order[]>([])
  const [trainingRequired, setTrainingRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [pos, setPos] = useState<LatLng | null>(null)
  const [posFallback, setPosFallback] = useState(false)
  const [currentCity, setCurrentCity] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  // Resolve the volunteer's position once, falling back to Shanghai.
  useEffect(() => {
    let active = true
    void bestEffortPosition().then((p) => {
      if (!active) return
      if (p) {
        setPos(p)
        setPosFallback(false)
      } else {
        setPos(SHANGHAI)
        setPosFallback(true)
      }
    })
    return () => {
      active = false
    }
  }, [])

  // Reverse-geocode the position into a city so the "当前城市" filter can match.
  useEffect(() => {
    if (!pos) return
    let active = true
    void reverseGeocodeAddress(pos.latitude, pos.longitude).then((geo) => {
      if (active && geo.city) setCurrentCity(geo.city)
    })
    return () => {
      active = false
    }
  }, [pos])

  const load = useCallback(async () => {
    if (!pos) return
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
      const query: WaitingOrderFilters = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        maxDistance: filters.maxDistance,
        distanceBasis: 'origin',
        gender: filters.gender,
        ageRange: filters.ageRange,
        city: resolveCityFilter(filters, currentCity),
        departureFilterType: filters.departureType,
        departureWithinMinutes: filters.departureType === 'within' ? filters.departureWithinMinutes : undefined,
        departureHour: filters.departureType === 'hour' ? filters.departureHour : undefined,
        departureDate: filters.departureType === 'date' ? filters.departureDate : undefined
      }
      const waiting = await getWaitingOrders(query)
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
  }, [pos, filters, currentCity, toast])

  useEffect(() => {
    void load()
  }, [load])

  const accept = useCallback(
    async (order: Order) => {
      try {
        await acceptOrder(order._id, pos ?? undefined)
        toast.success('接单成功，请尽快前往集合点')
        // Clear the open detail and collapse the filter panel so its controls
        // can't sit above/overlap the detail action area after accepting.
        setSelected(null)
        setShowFilters(false)
        await load()
      } catch (err) {
        toast.error(err instanceof CloudError ? err.message : '接单失败，请稍后再试')
        throw err
      }
    },
    [pos, load, toast]
  )

  if (loading) {
    return <LoadingBlock label="正在加载附近需求…" />
  }

  const activeFilterCount = countActiveFilters(filters)
  const selectedDistanceLabel = distanceRangeLabel(filters.maxDistance)

  return (
    <div className="stack stagger">
      <section className="callout callout--pine">
        <div className="callout__icon">
          <Radio size={20} />
        </div>
        <div>
          <p className="callout__title">附近陪跑需求 · {selectedDistanceLabel}内</p>
          <p className="callout__text">
            {posFallback
              ? '未获取到定位，已使用上海市中心作为参考位置。'
              : `已按你的当前位置筛选方圆 ${selectedDistanceLabel}内的陪跑请求，距离默认按起点地址计算。`}
          </p>
        </div>
      </section>

      {activeOrders.length > 0 && (
        <div className="stack stack--sm">
          <span className="section-title" style={{ margin: '2px 2px' }}>
            <Footprints size={17} /> 进行中的陪跑
          </span>
          {activeOrders.map((order) => (
            <VolunteerActiveOrder
              key={order._id}
              order={order}
              volunteerPos={pos}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <div className="stack stack--sm">
        <div className="row row--between" style={{ padding: '0 2px' }}>
          <span className="section-title" style={{ margin: 0 }}>
            <Radio size={17} /> 等待接单
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ border: '1.5px solid var(--line)' }}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={15} /> 筛选
              {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
            </button>
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
        </div>

        {showFilters && (
          <VolunteerFilterPanel
            filters={filters}
            currentCity={currentCity}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
        )}

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
            <DemandRow
              key={order._id}
              order={order}
              onSelect={() => {
                // Collapse the filter panel when opening a demand so its
                // controls can't overlap the detail's Accept action.
                setShowFilters(false)
                setSelected(order)
              }}
            />
          ))
        ) : (
          <EmptyState
            icon={<Footprints size={26} />}
            title="附近暂无匹配需求"
            text={`放宽筛选条件，或稍后再来看看 ${selectedDistanceLabel}内的陪跑请求。`}
          />
        )}
      </div>

      {selected && (
        <DemandDetail
          order={selected}
          volunteerPos={pos}
          onClose={() => setSelected(null)}
          onAccept={() => accept(selected)}
        />
      )}
    </div>
  )
}

/* ----------------------------- filter controls ---------------------------- */

/** Count of non-default filters, shown as a badge on the 筛选 button. */
function countActiveFilters(f: BoardFilters): number {
  let n = 0
  if (f.maxDistance !== DEFAULT_DISTANCE_METERS) n += 1
  if (f.gender !== 'all') n += 1
  if (f.ageRange !== 'all') n += 1
  if (f.departureType !== 'all') n += 1
  if (f.cityMode !== 'all') n += 1
  return n
}

/**
 * In-page filter panel for the waiting board. Everything is a stable inline
 * control — segmented toggles, wrap-around chip groups, a stepper, and a date
 * field — so nothing detaches into a floating native dropdown. Choices map
 * directly onto handleOrder's filter params.
 */
function VolunteerFilterPanel({
  filters,
  currentCity,
  onChange,
  onReset
}: {
  filters: BoardFilters
  currentCity: string
  onChange: (next: BoardFilters) => void
  onReset: () => void
}) {
  const set = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <section className="card filter-panel">
      <div className="filter-panel__field">
        <span className="field__label">
          <Navigation size={13} /> 距离范围
        </span>
        <ChipGroup
          ariaLabel="距离范围筛选"
          value={String(filters.maxDistance)}
          options={DISTANCE_RANGE_OPTIONS}
          onChange={(v) => set('maxDistance', Number(v))}
        />
        <p className="filter-panel__note">
          <MapPin size={12} /> 默认按陪跑起点地址计算距离
        </p>
      </div>

      <div className="filter-panel__field">
        <span className="field__label">
          <Clock size={13} /> 出发时间
        </span>
        <ChipGroup
          ariaLabel="出发时间筛选"
          value={filters.departureType}
          options={DEPARTURE_FILTER_TYPES}
          onChange={(v) => set('departureType', v as DepartureFilterType)}
        />
        {filters.departureType === 'within' && (
          <div className="filter-panel__sub">
            <span className="field__label faint">
              <Hourglass size={12} /> 时间范围
            </span>
            <ChipGroup
              ariaLabel="即将出发时间范围"
              value={String(filters.departureWithinMinutes)}
              options={WITHIN_MINUTES_OPTIONS}
              onChange={(v) => set('departureWithinMinutes', Number(v))}
            />
          </div>
        )}
        {filters.departureType === 'hour' && (
          <div className="filter-panel__sub">
            <span className="field__label faint">整点时段</span>
            <div className="stepper" role="group" aria-label="出发整点">
              <button
                type="button"
                className="stepper__btn"
                aria-label="减少小时"
                disabled={filters.departureHour <= 0}
                onClick={() => set('departureHour', Math.max(0, filters.departureHour - 1))}
              >
                <span aria-hidden>−</span>
              </button>
              <span className="stepper__value">{String(filters.departureHour).padStart(2, '0')}:00</span>
              <button
                type="button"
                className="stepper__btn"
                aria-label="增加小时"
                disabled={filters.departureHour >= 23}
                onClick={() => set('departureHour', Math.min(23, filters.departureHour + 1))}
              >
                <span aria-hidden>+</span>
              </button>
            </div>
          </div>
        )}
        {filters.departureType === 'date' && (
          <div className="filter-panel__sub">
            <label className="field__label faint" htmlFor="filter-departure-date">
              <CalendarDays size={12} /> 出发日期
            </label>
            <input
              id="filter-departure-date"
              className="input"
              type="date"
              value={filters.departureDate}
              onChange={(e) => set('departureDate', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="filter-panel__field">
        <span className="field__label">性别</span>
        <Segmented
          ariaLabel="性别筛选"
          value={filters.gender}
          options={GENDER_FILTERS}
          onChange={(v) => set('gender', v)}
        />
      </div>

      <div className="filter-panel__field">
        <span className="field__label">年龄段</span>
        <ChipGroup
          ariaLabel="年龄段筛选"
          value={filters.ageRange}
          options={AGE_FILTERS}
          onChange={(v) => set('ageRange', v)}
        />
      </div>

      <div className="filter-panel__field">
        <span className="field__label">
          <Building2 size={13} /> 城市
        </span>
        <Segmented
          ariaLabel="城市筛选方式"
          value={filters.cityMode}
          options={CITY_MODES}
          onChange={(v) => set('cityMode', v as CityMode)}
        />
        {filters.cityMode === 'current' && (
          <p className="filter-panel__note">
            <LocateFixed size={12} /> {currentCity ? `当前定位城市：${currentCity}` : '正在识别当前城市…'}
          </p>
        )}
        {filters.cityMode === 'custom' && (
          <div className="filter-panel__sub">
            <ChipGroup
              ariaLabel="常用城市"
              value={filters.cityValue}
              options={CITY_PRESETS}
              onChange={(v) => set('cityValue', v)}
            />
            <input
              className="input"
              type="text"
              inputMode="text"
              placeholder="或输入城市名，如「苏州」"
              value={filters.cityValue}
              onChange={(e) => set('cityValue', e.target.value)}
            />
          </div>
        )}
      </div>

      <button type="button" className="btn btn--ghost btn--sm filter-panel__reset" onClick={onReset}>
        <X size={14} /> 重置筛选
      </button>
    </section>
  )
}

/* ------------------------------- demand list ------------------------------ */

/** Shared meta chips (distance / duration / time-window / gender / age). */
function DemandMeta({ order }: { order: Order }) {
  const distance = Number.isFinite(order.distance) ? formatMeters(order.distance) : ''
  const gender = genderLabel(order.runnerGender)
  const ageNum = Number(order.runnerAge)
  const age = Number.isFinite(ageNum) && ageNum > 0 ? `${ageNum}岁` : ''
  return (
    <div className="demand-row__meta">
      {distance && (
        <span className="chip chip--pine">
          <Navigation size={12} /> 距起点 {distance}
        </span>
      )}
      <span className="chip">
        <Timer size={12} /> {formatMinutes(order.estimatedDuration)}
      </span>
      <span className="chip">
        <Clock size={12} /> {order.departureLabel || timeWindowLabel(order.runTimeWindow)}
      </span>
      {gender && <span className="chip">{gender}</span>}
      {age && <span className="chip">{age}</span>}
      {order.city && <span className="chip">{order.city}</span>}
    </div>
  )
}

/** A waiting demand on the board. Tapping it opens the detail/route sheet. */
function DemandRow({ order, onSelect }: { order: Order; onSelect: () => void }) {
  const start = startAddress(order)
  const dest = destinationAddress(order)
  return (
    <button type="button" className="demand-row" onClick={onSelect}>
      <div className="demand-row__route">
        <span className="demand-row__addr">
          <span className="addr-dot addr-dot--start" aria-hidden />
          <span className="demand-row__text">{start || '未填写起点'}</span>
        </span>
        <span className="demand-row__addr">
          <span className="addr-dot addr-dot--destination" aria-hidden />
          <span className="demand-row__text">{dest || '未填写终点'}</span>
        </span>
      </div>
      <DemandMeta order={order} />
    </button>
  )
}

/** Detail sheet: route map + summary, with the real accept action. */
function DemandDetail({
  order,
  volunteerPos,
  onClose,
  onAccept
}: {
  order: Order
  volunteerPos: LatLng | null
  onClose: () => void
  onAccept: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const start = orderStart(order)
  const dest = orderDestination(order)
  const startAddr = startAddress(order)
  const destAddr = destinationAddress(order)

  const accept = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onAccept()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Sheet title="陪跑需求详情" onClose={onClose}>
      <div className="stack stack--sm">
        <div className="route-card">
          <RouteMap phase="running" start={start} destination={dest} volunteer={volunteerPos} />
          <RouteLegend phase="running" />
        </div>

        <dl className="confirm__grid">
          <div>
            <dt>
              <span className="addr-dot addr-dot--start" aria-hidden /> 起点
            </dt>
            <dd>{startAddr || '未填写起点'}</dd>
          </div>
          <div>
            <dt>
              <span className="addr-dot addr-dot--destination" aria-hidden /> 终点
            </dt>
            <dd>{destAddr || '未填写终点'}</dd>
          </div>
        </dl>

        <DemandMeta order={order} />

        <button
          type="button"
          className="btn btn--pine btn--block"
          onClick={() => void accept()}
          disabled={busy}
        >
          {busy ? <Spinner /> : <CheckCircle2 size={18} />}
          {busy ? '接单中…' : '接受订单并出发'}
        </button>
      </div>
    </Sheet>
  )
}

/* ----------------------------- active order ------------------------------- */

function RouteLegend({ phase }: { phase: 'pickup' | 'running' }) {
  return (
    <div className="route-legend">
      {phase === 'pickup' ? (
        <>
          <span>
            <span className="route-walker route-walker--mini" aria-hidden /> 你的位置
          </span>
          <span>
            <span className="addr-dot addr-dot--start" aria-hidden /> 起跑点
          </span>
        </>
      ) : (
        <>
          <span>
            <span className="addr-dot addr-dot--start" aria-hidden /> 起点
          </span>
          <span>
            <span className="addr-dot addr-dot--destination" aria-hidden /> 终点
          </span>
        </>
      )}
    </div>
  )
}

/** An accepted order the volunteer is fulfilling. Drives the status flow
 *  accepted → arrived → running → completed, plus a live route map and
 *  simulated location uploads. */
function VolunteerActiveOrder({
  order,
  volunteerPos,
  onChanged
}: {
  order: Order
  volunteerPos: LatLng | null
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [actualDistance, setActualDistance] = useState(String(order.targetDistance ?? ''))
  const [duration, setDuration] = useState(String(order.estimatedDuration ?? ''))
  const uploadsRef = useRef(0)

  const start = orderStart(order)
  const dest = orderDestination(order)
  const volunteer = orderVolunteerPoint(order) ?? volunteerPos
  const phase: 'pickup' | 'running' = order.status === 'running' ? 'running' : 'pickup'

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
  const startRun = () => run('陪跑开始，注意安全', () => updateOrderStatus(order._id, 'running'))

  const upload = () =>
    run('已上传实时定位与配速', async () => {
      uploadsRef.current += 1
      const step = uploadsRef.current
      const coords = await bestEffortPosition()
      const fallback = orderRunnerPoint(order)
      const dist = round2(step * 0.5)
      const dur = step * 4
      await updateVolunteerLocation({
        orderId: order._id,
        latitude: coords?.latitude ?? fallback?.latitude ?? 0,
        longitude: coords?.longitude ?? fallback?.longitude ?? 0,
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
    <div className="stack stack--sm">
      {(start || dest) && (
        <div className="route-card">
          <div className="route-card__head">
            {phase === 'pickup' ? (
              <span>
                <Navigation size={14} /> 前往集合点
              </span>
            ) : (
              <span>
                <Route size={14} /> 陪跑路线
              </span>
            )}
          </div>
          <RouteMap phase={phase} start={start} destination={dest} volunteer={volunteer} />
          <RouteLegend phase={phase} />
        </div>
      )}

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
            onClick={startRun}
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
    </div>
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
