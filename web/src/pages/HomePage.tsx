import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CloudOff,
  Flame,
  GraduationCap,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  Timer,
  Trophy,
  Zap
} from 'lucide-react'
import { Avatar, LoadingBlock, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { useSession } from '../stores/session'
import { CloudError, getUserProfile, getUserStats, updateAvailability } from '../services/api'
import { expProgress, formatDistance, tierBadge } from '../lib/format'
import type { User, UserStats } from '../types'
import type { PageProps } from './types'

/** Landing tab — live profile + stats from CloudBase, with a role-aware action
 *  set. Volunteers can flip their availability (with best-effort geolocation);
 *  runners get quick paths to publish a run or open their schedule. */
export function HomePage({ user, role, onNavigate }: PageProps) {
  const isVolunteer = role === 'volunteer'
  const toast = useToast()
  const { setUser } = useSession()

  const [profile, setProfile] = useState<User>(user)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [freshProfile, freshStats] = await Promise.all([getUserProfile(), getUserStats()])
      setProfile(freshProfile)
      setStats(freshStats)
      // Keep the session (and thus the header avatar) aligned with fresh data.
      setUser(freshProfile)
    } catch {
      // Auth-class failures are routed to login by the api layer; anything
      // else surfaces as a friendly retry below.
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [setUser])

  useEffect(() => {
    void load()
  }, [load])

  const available = Boolean(profile.isAvailable)

  const onToggleAvailability = useCallback(async () => {
    if (toggling) return
    const next = !available
    setToggling(true)
    try {
      // Only resolve a position when going online; offline never needs coords.
      const coords = next ? await getBrowserPosition() : null
      if (next && !coords) {
        toast.show('未能获取定位，已按无位置上线', 'info')
      }
      await updateAvailability(next, coords?.latitude, coords?.longitude)
      const updated: User = {
        ...profile,
        isAvailable: next,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {})
      }
      setProfile(updated)
      setUser(updated)
      toast.success(next ? '已上线，可接收附近求助' : '已下线')
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '更新失败，请稍后再试')
    } finally {
      setToggling(false)
    }
  }, [available, profile, setUser, toast, toggling])

  if (loading) {
    return <LoadingBlock label="正在加载你的数据…" />
  }

  if (error) {
    return (
      <div className="stack stagger">
        <section className="card" style={{ textAlign: 'center', padding: '34px 22px' }}>
          <div className="empty__icon" style={{ margin: '0 auto 16px' }}>
            <CloudOff size={26} />
          </div>
          <p className="empty__title">没能加载你的数据</p>
          <p className="empty__text" style={{ marginBottom: 18 }}>
            请检查网络连接后重试。
          </p>
          <button type="button" className="btn btn--accent" onClick={() => void load()}>
            <RefreshCw size={18} /> 刷新重试
          </button>
        </section>
      </div>
    )
  }

  const name = profile.nickName
  const tierName = stats?.tierName || profile.tierName || '初心跑者'
  const tierLevel = stats?.tierLevel ?? profile.tierLevel
  const points = stats?.points ?? profile.points ?? 0
  const exp = stats?.exp ?? profile.exp ?? 0
  const totalRuns = stats?.totalRuns ?? profile.totalRuns ?? 0
  const totalDistance = stats?.totalDistance ?? profile.totalDistance
  const totalTime = stats?.totalTime ?? profile.totalTime
  const completedOrders = stats?.completedOrders ?? 0
  const examPassed = stats?.examPassed ?? profile.examPassed === true
  const videoWatched = stats?.videoWatched ?? Boolean(profile.videoWatched)

  const { pct, toNext } = expProgress(exp)

  return (
    <div className="stack stagger">
      <section className="card card--ink">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Avatar name={name} src={profile.avatarUrl} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="app__eyebrow" style={{ color: 'var(--beacon)' }}>
              {isVolunteer ? '陪跑志愿者' : '视障跑者'}
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '2px 0 4px' }}>
              你好，{name}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(251, 246, 234, 0.7)' }}>
              {tierName} · {tierBadge(tierLevel)}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="row row--between" style={{ marginBottom: 7 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'rgba(251, 246, 234, 0.62)'
              }}
            >
              经验值 {exp}
            </span>
            <span style={{ fontSize: 11.5, color: 'rgba(251, 246, 234, 0.62)' }}>
              距下一级 {toNext}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 'var(--r-pill)',
              background: 'rgba(251, 246, 234, 0.14)',
              overflow: 'hidden'
            }}
            role="progressbar"
            aria-label="经验进度"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'var(--beacon)',
                borderRadius: 'var(--r-pill)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      </section>

      <div className="grid-3">
        <StatTile icon={<Route size={15} />} value={totalRuns} label="累计陪跑" />
        <StatTile icon={<MapPin size={15} />} value={formatDistance(totalDistance)} label="总里程" />
        <StatTile icon={<Timer size={15} />} value={formatDuration(totalTime)} label="总时长" />
        <StatTile icon={<Flame size={15} />} value={points} label="积分" />
        <StatTile icon={<Zap size={15} />} value={exp} label="经验值" />
        <StatTile icon={<Trophy size={15} />} value={completedOrders} label="完成订单" />
      </div>

      {isVolunteer ? (
        <div className="stack stack--sm">
          <button
            type="button"
            className="list-row"
            role="switch"
            aria-checked={available}
            aria-busy={toggling}
            disabled={toggling}
            onClick={() => void onToggleAvailability()}
          >
            <span
              className="callout__icon"
              style={{
                background: available ? 'var(--pine)' : 'var(--paper-2)',
                color: available ? '#fff' : 'var(--ink-faint)'
              }}
            >
              <Radio size={20} />
            </span>
            <div className="list-row__body">
              <div className="list-row__title">接单状态</div>
              <div className="list-row__meta">
                {available ? '在线 · 可接收附近求助' : '离线 · 暂不接收求助'}
              </div>
            </div>
            {toggling ? (
              <Spinner />
            ) : (
              <span className={available ? 'chip chip--pine' : 'chip'}>
                {available ? '在线' : '离线'}
              </span>
            )}
          </button>

          <button type="button" className="list-row" onClick={() => onNavigate('training')}>
            <span
              className="callout__icon"
              style={{ background: 'var(--beacon-tint)', color: 'var(--beacon-deep)' }}
            >
              <GraduationCap size={20} />
            </span>
            <div className="list-row__body">
              <div className="list-row__title">培训认证</div>
              <div className="list-row__meta">
                视频{videoWatched ? '已完成' : '未完成'} · 考核{examPassed ? '已通过' : '未通过'}
              </div>
            </div>
            <span className={examPassed ? 'chip chip--pine' : 'chip'}>
              {examPassed ? '已认证' : '待认证'}
            </span>
          </button>
        </div>
      ) : (
        <section className="callout callout--sky">
          <div className="callout__icon">
            <MapPin size={20} />
          </div>
          <div>
            <p className="callout__title">发起陪跑</p>
            <p className="callout__text">
              选择起点与目标距离，系统会为你匹配附近经过认证的志愿者。
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        className="btn btn--accent btn--block"
        onClick={() => onNavigate('sport')}
      >
        {isVolunteer ? '前往接单广场' : '发起一次陪跑'}
        <ArrowRight size={18} />
      </button>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => onNavigate('appointments')}
      >
        <CalendarDays size={18} />
        {isVolunteer ? '查看约跑日程' : '预约约跑'}
      </button>
    </div>
  )
}

function StatTile({
  icon,
  value,
  label
}: {
  icon: ReactNode
  value: ReactNode
  label: string
}) {
  return (
    <div className="stat">
      <div className="stat__value">
        <span style={{ marginRight: 4, verticalAlign: '-2px', display: 'inline-flex' }} aria-hidden>
          {icon}
        </span>
        {value}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

/** Best-effort browser geolocation. Resolves to null (never rejects) when the
 *  API is missing, blocked, or times out, so callers can fall back gracefully. */
function getBrowserPosition(): Promise<{ latitude: number; longitude: number } | null> {
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

/** Render an accumulated minute count as a compact 时/分 label. */
function formatDuration(minutes: number | undefined): string {
  const m = Math.round(Number(minutes) || 0)
  if (m <= 0) return '—'
  if (m < 60) return `${m} 分`
  const hours = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${hours} 时 ${rest} 分` : `${hours} 时`
}
