import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  RefreshCw,
  Route,
  Send,
  Star,
  UserRound,
  Users,
  X
} from 'lucide-react'
import { Avatar, EmptyState, LoadingBlock, Sheet, Spinner, StarRating } from '../components/ui'
import { LocationPicker } from '../components/LocationPicker'
import { useToast } from '../components/Toast'
import {
  CloudError,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  getAppointments,
  getAvailableVolunteers,
  getVolunteers
} from '../services/api'
import {
  APPOINTMENT_STATUS_CHIP,
  APPOINTMENT_STATUS_LABEL,
  formatDistance,
  formatMinutes,
  formatMeters,
  todayISO
} from '../lib/format'
import type { SelectedLocation } from '../types/location'
import type { Appointment, AppointmentStatus, Volunteer } from '../types'
import type { PageProps } from './types'

/** Appointment statuses the participant can still act on. */
function isActiveAppointment(status: AppointmentStatus): boolean {
  return status === 'pending' || status === 'confirmed'
}

/** Schedule tab. Runners (视障跑者) book a certified volunteer for a future run
 *  and manage the booking; volunteers (志愿者) confirm or decline the requests
 *  addressed to them. */
export function AppointmentsPage(props: PageProps) {
  return props.role === 'volunteer' ? (
    <VolunteerAppointments {...props} />
  ) : (
    <RunnerAppointments {...props} />
  )
}

/* ============================ Runner (视障跑者) ============================ */

function RunnerAppointments(_props: PageProps) {
  const toast = useToast()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Booking form.
  const [volunteers, setVolunteers] = useState<Volunteer[]>([])
  const [volunteersLoading, setVolunteersLoading] = useState(true)
  const [nearbyMode, setNearbyMode] = useState(false)
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('')
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Completion sheet (rate a confirmed run as done).
  const [completing, setCompleting] = useState<Appointment | null>(null)

  const loadAppointments = useCallback(async () => {
    setRefreshing(true)
    setLoadError('')
    try {
      setAppointments(await getAppointments())
    } catch (err) {
      const message = err instanceof CloudError ? err.message : '加载约跑安排失败，请稍后再试'
      setLoadError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAppointments()
  }, [loadAppointments])

  // Volunteer roster — falls back to the full certified list when no location
  // is chosen, and to nearby-available matches once the runner drops a pin.
  const lat = location?.latitude
  const lng = location?.longitude
  useEffect(() => {
    let cancelled = false
    async function loadVolunteers() {
      setVolunteersLoading(true)
      try {
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const nearby = await getAvailableVolunteers(lat, lng)
          if (cancelled) return
          if (nearby.length > 0) {
            setVolunteers(nearby)
            setNearbyMode(true)
            return
          }
        }
        const all = await getVolunteers()
        if (cancelled) return
        setVolunteers(all)
        setNearbyMode(false)
      } catch (err) {
        if (cancelled) return
        // Nearby lookup can fail without a usable position — fall back quietly.
        try {
          const all = await getVolunteers()
          if (cancelled) return
          setVolunteers(all)
          setNearbyMode(false)
        } catch (innerErr) {
          if (!cancelled && innerErr instanceof CloudError) toast.error(innerErr.message)
        }
      } finally {
        if (!cancelled) setVolunteersLoading(false)
      }
    }
    void loadVolunteers()
    return () => {
      cancelled = true
    }
  }, [lat, lng, toast])

  const submit = useCallback(async () => {
    if (submitting) return
    if (!selectedVolunteerId) {
      toast.error('请先选择一位陪跑志愿者')
      return
    }
    if (!date) {
      toast.error('请选择约跑日期')
      return
    }
    if (!time) {
      toast.error('请选择约跑时间')
      return
    }
    if (distance && !(Number(distance) > 0)) {
      toast.error('请填写有效的目标距离')
      return
    }
    if (duration && !(Number(duration) > 0)) {
      toast.error('请填写有效的预计时长')
      return
    }
    setSubmitting(true)
    try {
      const created = await createAppointment({
        volunteerId: selectedVolunteerId,
        appointmentDate: date,
        appointmentTime: time,
        address: location?.address || undefined,
        targetDistance: distance ? String(Number(distance)) : undefined,
        estimatedDuration: duration ? String(Number(duration)) : undefined,
        note: note.trim() || undefined
      })
      toast.success('约跑邀请已发送，等待志愿者确认')
      setAppointments((prev) => [created, ...prev])
      // Reset the run details but keep the location for a quick re-book.
      setSelectedVolunteerId('')
      setDate('')
      setTime('')
      setDistance('')
      setDuration('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '预约失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, selectedVolunteerId, date, time, distance, duration, location, note, toast])

  if (loading) {
    return <LoadingBlock label="正在加载约跑安排…" />
  }

  return (
    <div className="stack stagger">
      <section className="callout callout--sky">
        <div className="callout__icon">
          <CalendarPlus size={20} />
        </div>
        <div>
          <p className="callout__title">预约志愿者</p>
          <p className="callout__text">挑选认证志愿者并约定时间，确认后即可如约出发。</p>
        </div>
      </section>

      <section className="card">
        <span className="section-title" style={{ margin: '0 0 14px' }}>
          <Send size={17} /> 发起约跑
        </span>
        <div className="stack stack--sm">
          <div className="field">
            <div className="row row--between" style={{ marginBottom: 2 }}>
              <span className="field__label" style={{ margin: 0 }}>
                选择志愿者
              </span>
              <span className="faint" style={{ fontSize: '.76rem' }}>
                {nearbyMode ? '按距离排序' : '认证志愿者'}
              </span>
            </div>
            {volunteersLoading ? (
              <LoadingBlock label="正在加载志愿者…" />
            ) : volunteers.length === 0 ? (
              <p className="field__hint">暂时没有可预约的志愿者，请稍后再试。</p>
            ) : (
              <div className="vol-picker" role="radiogroup" aria-label="选择陪跑志愿者">
                {volunteers.map((v) => (
                  <VolunteerOption
                    key={v._id}
                    volunteer={v}
                    selected={v._id === selectedVolunteerId}
                    onSelect={() => setSelectedVolunteerId(v._id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="ap-date">
                约跑日期
              </label>
              <input
                id="ap-date"
                className="input"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ap-time">
                约跑时间
              </label>
              <input
                id="ap-time"
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="ap-distance">
                目标距离（公里，可选）
              </label>
              <input
                id="ap-distance"
                className="input"
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="例如：5"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ap-duration">
                预计时长（分钟，可选）
              </label>
              <input
                id="ap-duration"
                className="input"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="例如：40"
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="ap-note">
              备注（可选）
            </label>
            <textarea
              id="ap-note"
              className="textarea"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：希望陪跑节奏轻松一些，集合后电话联系。"
            />
          </div>

          <div className="field">
            <span className="field__label">集合地点（可选，用于匹配附近志愿者）</span>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          <button
            type="button"
            className="btn btn--accent btn--block"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? <Spinner /> : <Send size={18} />}
            {submitting ? '发送中…' : '发送约跑邀请'}
          </button>
        </div>
      </section>

      <div className="stack stack--sm">
        <div className="row row--between" style={{ padding: '0 2px' }}>
          <span className="section-title" style={{ margin: 0 }}>
            <CalendarDays size={17} /> 我的约跑
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void loadAppointments()}
            disabled={refreshing}
            aria-label="刷新约跑安排"
          >
            {refreshing ? <Spinner /> : <RefreshCw size={15} />}
            刷新
          </button>
        </div>

        {loadError ? (
          <section className="callout callout--coral">
            <div className="callout__icon">
              <X size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p className="callout__title">加载失败</p>
              <p className="callout__text" style={{ marginBottom: 12 }}>
                {loadError}
              </p>
              <button
                type="button"
                className="btn btn--coral btn--sm"
                onClick={() => void loadAppointments()}
              >
                <RefreshCw size={15} /> 重新加载
              </button>
            </div>
          </section>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={26} />}
            title="暂无约跑安排"
            text="在上方挑选志愿者并约定时间，约定好的日程会显示在这里。"
          />
        ) : (
          appointments.map((appt) => (
            <RunnerAppointmentCard
              key={appt._id}
              appointment={appt}
              onCancelled={loadAppointments}
              onComplete={() => setCompleting(appt)}
            />
          ))
        )}
      </div>

      {completing && (
        <CompleteSheet
          appointment={completing}
          onClose={() => setCompleting(null)}
          onDone={async () => {
            setCompleting(null)
            await loadAppointments()
          }}
        />
      )}
    </div>
  )
}

/** A selectable volunteer row in the booking form. */
function VolunteerOption({
  volunteer,
  selected,
  onSelect
}: {
  volunteer: Volunteer
  selected: boolean
  onSelect: () => void
}) {
  const meta: string[] = []
  if (volunteer.tierName) meta.push(volunteer.tierName)
  if (Number.isFinite(volunteer.totalRuns)) meta.push(`${volunteer.totalRuns} 次陪跑`)
  if (volunteer.pace) meta.push(`配速 ${volunteer.pace}`)

  return (
    <button
      type="button"
      className="vol-option"
      data-selected={selected}
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      <Avatar name={volunteer.nickName} src={volunteer.avatarUrl} size={40} />
      <span className="vol-option__body">
        <span className="vol-option__name">{volunteer.nickName || '志愿者'}</span>
        {meta.length > 0 && <span className="vol-option__meta">{meta.join(' · ')}</span>}
      </span>
      {Number.isFinite(volunteer.distance) && (
        <span className="metric-tag" style={{ flex: 'none' }}>
          <MapPin size={13} /> {formatMeters(volunteer.distance)}
        </span>
      )}
      {selected && <CheckCircle2 size={20} className="vol-option__check" aria-hidden />}
    </button>
  )
}

/** Runner-facing card with cancel + complete actions. */
function RunnerAppointmentCard({
  appointment,
  onCancelled,
  onComplete
}: {
  appointment: Appointment
  onCancelled: () => Promise<void>
  onComplete: () => void
}) {
  const toast = useToast()
  const [cancelling, setCancelling] = useState(false)

  const cancel = useCallback(async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await cancelAppointment(appointment._id)
      toast.success('已取消该约跑')
      await onCancelled()
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '取消失败，请稍后再试')
      setCancelling(false)
    }
  }, [cancelling, appointment._id, onCancelled, toast])

  return (
    <AppointmentCard
      appointment={appointment}
      party={{
        label: '陪跑志愿者',
        name: appointment.volunteerName
      }}
    >
      {appointment.status === 'confirmed' && (
        <button type="button" className="btn btn--accent btn--sm btn--block" onClick={onComplete}>
          <CheckCircle2 size={16} /> 完成并评价
        </button>
      )}
      {isActiveAppointment(appointment.status) && (
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--block"
          onClick={() => void cancel()}
          disabled={cancelling}
        >
          {cancelling ? <Spinner /> : <X size={16} />}
          {cancelling ? '取消中…' : '取消约跑'}
        </button>
      )}
    </AppointmentCard>
  )
}

/** Bottom sheet for rating a finished run before marking it complete. */
function CompleteSheet({
  appointment,
  onClose,
  onDone
}: {
  appointment: Appointment
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await completeAppointment(appointment._id, rating, comment.trim() || undefined)
      toast.success('已完成约跑，感谢你的评价')
      await onDone()
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '操作失败，请稍后再试')
      setSubmitting(false)
    }
  }, [submitting, appointment._id, rating, comment, onDone, toast])

  return (
    <Sheet title="完成并评价" onClose={onClose}>
      <div className="stack stack--sm">
        <p className="faint" style={{ fontSize: '.85rem' }}>
          为 {appointment.volunteerName || '本次陪跑志愿者'} 的陪伴打个分吧。
        </p>
        <div className="field">
          <span className="field__label">陪跑评分</span>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ap-comment">
            评价（可选）
          </label>
          <textarea
            id="ap-comment"
            className="textarea"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="说说这次陪跑的体验吧。"
          />
        </div>
        <button
          type="button"
          className="btn btn--accent btn--block"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? <Spinner /> : <CheckCircle2 size={18} />}
          {submitting ? '提交中…' : '提交评价'}
        </button>
      </div>
    </Sheet>
  )
}

/* =========================== Volunteer (志愿者) =========================== */

function VolunteerAppointments(_props: PageProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setRefreshing(true)
    setLoadError('')
    try {
      setAppointments(await getAppointments())
    } catch (err) {
      setLoadError(err instanceof CloudError ? err.message : '加载约跑邀请失败，请稍后再试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <LoadingBlock label="正在加载约跑邀请…" />
  }

  return (
    <div className="stack stagger">
      <section className="callout callout--pine">
        <div className="callout__icon">
          <Users size={20} />
        </div>
        <div>
          <p className="callout__title">约跑邀请</p>
          <p className="callout__text">跑者向你发起的约跑邀请会出现在这里，确认后请准时赴约。</p>
        </div>
      </section>

      <div className="stack stack--sm">
        <div className="row row--between" style={{ padding: '0 2px' }}>
          <span className="section-title" style={{ margin: 0 }}>
            <CalendarDays size={17} /> 我的约跑
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void load()}
            disabled={refreshing}
            aria-label="刷新约跑邀请"
          >
            {refreshing ? <Spinner /> : <RefreshCw size={15} />}
            刷新
          </button>
        </div>

        {loadError ? (
          <section className="callout callout--coral">
            <div className="callout__icon">
              <X size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p className="callout__title">加载失败</p>
              <p className="callout__text" style={{ marginBottom: 12 }}>
                {loadError}
              </p>
              <button type="button" className="btn btn--coral btn--sm" onClick={() => void load()}>
                <RefreshCw size={15} /> 重新加载
              </button>
            </div>
          </section>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={26} />}
            title="暂无约跑邀请"
            text="跑者向你发起的约跑邀请会出现在这里。"
          />
        ) : (
          appointments.map((appt) => (
            <VolunteerAppointmentCard key={appt._id} appointment={appt} onChanged={load} />
          ))
        )}
      </div>
    </div>
  )
}

/** Volunteer-facing card with confirm + cancel actions. */
function VolunteerAppointmentCard({
  appointment,
  onChanged
}: {
  appointment: Appointment
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

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
        // Clear busy whether the reload succeeded or failed — on success the
        // card re-renders with its new status and must not stay disabled.
        setBusy(false)
      }
    },
    [busy, onChanged, toast]
  )

  return (
    <AppointmentCard
      appointment={appointment}
      party={{ label: '跑者', name: appointment.blindName }}
    >
      {appointment.status === 'pending' && (
        <button
          type="button"
          className="btn btn--pine btn--sm btn--block"
          onClick={() => run('已确认约跑邀请', () => confirmAppointment(appointment._id))}
          disabled={busy}
        >
          {busy ? <Spinner /> : <CheckCircle2 size={16} />}
          {busy ? '处理中…' : '确认邀请'}
        </button>
      )}
      {isActiveAppointment(appointment.status) && (
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--block"
          onClick={() => run('已取消该约跑', () => cancelAppointment(appointment._id))}
          disabled={busy}
        >
          {busy ? <Spinner /> : <X size={16} />}
          {busy ? '处理中…' : appointment.status === 'pending' ? '拒绝邀请' : '取消约跑'}
        </button>
      )}
    </AppointmentCard>
  )
}

/* -------------------------- shared presentation --------------------------- */

/** Presentational summary of a single appointment, shared by both roles. The
 *  `party` describes the other person on the booking; `children` slot in the
 *  role-specific action buttons. */
function AppointmentCard({
  appointment,
  party,
  children
}: {
  appointment: Appointment
  party: { label: string; name?: string }
  children?: ReactNode
}) {
  const a = appointment
  return (
    <article className="card">
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <span className={`chip ${APPOINTMENT_STATUS_CHIP[a.status]}`}>
          {APPOINTMENT_STATUS_LABEL[a.status]}
        </span>
        <span className="metric-tag">
          <CalendarDays size={13} /> {a.appointmentDate || '待定'}
        </span>
      </div>

      <div className="order-card__meta">
        <span>
          <Clock size={14} aria-hidden /> {a.appointmentTime || '待定'}
        </span>
        {a.targetDistance && (
          <span>
            <Route size={14} aria-hidden /> 目标 {formatDistance(a.targetDistance)}
          </span>
        )}
        {a.estimatedDuration && (
          <span>
            <Clock size={14} aria-hidden /> 预计 {formatMinutes(a.estimatedDuration)}
          </span>
        )}
      </div>

      {a.address && (
        <p className="order-card__addr">
          <MapPin size={16} aria-hidden />
          <span>{a.address}</span>
        </p>
      )}

      <p className="order-card__party">
        <UserRound size={14} aria-hidden /> {party.label} · {party.name || '—'}
      </p>

      {a.note && (
        <p className="order-card__party">
          <MessageSquare size={14} aria-hidden /> {a.note}
        </p>
      )}

      {a.status === 'completed' && Number.isFinite(a.rating) && (
        <p className="order-card__party">
          <Star size={14} aria-hidden /> 评分 {a.rating} 分{a.comment ? ` · ${a.comment}` : ''}
        </p>
      )}

      {children && <div className="order-card__actions">{children}</div>}
    </article>
  )
}
