import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Award,
  Clock,
  Footprints,
  Gauge,
  HeartPulse,
  LogOut,
  Mail,
  Medal,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  User as UserIcon,
  Users
} from 'lucide-react'
import { Avatar, Spinner } from '../components/ui'
import { formatDistance, tierBadge } from '../lib/format'
import { useSession } from '../stores/session'
import { useToast } from '../components/Toast'
import { CloudError, getUserProfile, updateEmergencyContact, updateProfile } from '../services/api'
import type { User, YesNo } from '../types'
import type { PageProps } from './types'

/** Account tab — fresh profile fetch, editable identity + emergency contact
 *  (runners) / read-only certification details (volunteers), and sign-out.
 *  The session user (passed in via props) is the local fallback: if the fresh
 *  fetch fails the page still renders from it and offers a retry. */
export function MinePage({ user, role }: PageProps) {
  const { logout, setUser } = useSession()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Pull the canonical profile on mount; on success it replaces the session
  // user, on failure we silently keep the cached fallback and surface a retry.
  const loadProfile = useCallback(async () => {
    setRefreshing(true)
    setLoadError(false)
    try {
      const fresh = await getUserProfile()
      setUser(fresh)
    } catch (err) {
      setLoadError(true)
      if (err instanceof CloudError) toast.error(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [setUser, toast])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const onLogout = async () => {
    setSigningOut(true)
    try {
      await logout()
      toast.success('已退出登录')
    } catch {
      setSigningOut(false)
    }
  }

  const isVolunteer = role === 'volunteer'

  return (
    <div className="stack stagger">
      {loadError && (
        <div className="callout callout--coral">
          <div className="callout__icon">
            <RefreshCw size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="callout__title">资料同步失败</p>
            <p className="callout__text">当前显示本地缓存资料，可重试获取最新内容。</p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ border: '1.5px solid var(--line)', flex: 'none' }}
            onClick={() => void loadProfile()}
          >
            重试
          </button>
        </div>
      )}

      {/* Identity header */}
      <section className="card">
        <div className="row">
          <Avatar name={user.nickName} src={user.avatarUrl} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, margin: 0 }}>
              {user.nickName || '未设置昵称'}
            </h2>
            <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
              {isVolunteer ? '陪跑志愿者' : '视障跑者'} · {tierBadge(user.tierLevel)}
              {user.tierName ? ` · ${user.tierName}` : ''}
            </p>
          </div>
          {refreshing && <Spinner />}
        </div>
      </section>

      {/* Lifetime stats */}
      <div className="grid-3">
        <div className="stat">
          <div className="stat__value">{user.totalRuns ?? 0}</div>
          <div className="stat__label">陪跑次数</div>
        </div>
        <div className="stat">
          <div className="stat__value">{formatDistance(user.totalDistance)}</div>
          <div className="stat__label">总里程</div>
        </div>
        <div className="stat">
          <div className="stat__value">{user.points ?? 0}</div>
          <div className="stat__label">积分</div>
        </div>
      </div>

      {/* Editable identity */}
      <ProfileForm user={user} />

      {/* Role-specific section */}
      {isVolunteer ? (
        <VolunteerDetails user={user} />
      ) : (
        <EmergencyContactForm user={user} />
      )}

      {/* Account / session detail */}
      <AccountDetails user={user} isVolunteer={isVolunteer} />

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={onLogout}
        disabled={signingOut}
      >
        {signingOut ? <Spinner /> : <LogOut size={18} />}
        退出登录
      </button>
    </div>
  )
}

/* ------------------------------ profile form ------------------------------ */

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useSession()
  const toast = useToast()
  const [nickName, setNickName] = useState(user.nickName || '')
  const [name, setName] = useState(user.name || '')
  const [saving, setSaving] = useState(false)

  const dirty =
    nickName.trim() !== (user.nickName || '').trim() || name.trim() !== (user.name || '').trim()

  // Re-sync when the profile is refreshed elsewhere, but never clobber edits
  // already in progress.
  useEffect(() => {
    if (dirty) return
    setNickName(user.nickName || '')
    setName(user.name || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.nickName, user.name])

  const save = async () => {
    const nextNick = nickName.trim()
    if (!nextNick) {
      toast.error('昵称不能为空')
      return
    }
    if (saving) return
    setSaving(true)
    try {
      const updated = await updateProfile({ nickName: nextNick, name: name.trim() })
      setUser(updated)
      toast.success('资料已更新')
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '保存失败，请稍后再试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <span className="section-title" style={{ margin: '0 0 14px' }}>
        <UserIcon size={17} /> 账号资料
      </span>

      <div className="stack stack--sm">
        <div className="field">
          <label className="field__label" htmlFor="mine-nick">
            昵称
          </label>
          <input
            id="mine-nick"
            className="input"
            type="text"
            placeholder="他人看到的称呼"
            value={nickName}
            onChange={(e) => setNickName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="mine-name">
            真实姓名<span className="field__hint">（用于陪跑身份核对）</span>
          </label>
          <input
            id="mine-name"
            className="input"
            type="text"
            placeholder="选填"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn--accent btn--block"
          style={{ marginTop: 4 }}
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? <Spinner /> : <Save size={18} />}
          {saving ? '保存中…' : '保存资料'}
        </button>
      </div>
    </section>
  )
}

/* -------------------------- emergency contact form ------------------------ */

function EmergencyContactForm({ user }: { user: User }) {
  const { setUser } = useSession()
  const toast = useToast()
  const [emergencyName, setEmergencyName] = useState(user.emergencyName || '')
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergencyPhone || '')
  const [emergencyRelation, setEmergencyRelation] = useState(user.emergencyRelation || '')
  const [saving, setSaving] = useState(false)

  const dirty =
    emergencyName.trim() !== (user.emergencyName || '').trim() ||
    emergencyPhone.trim() !== (user.emergencyPhone || '').trim() ||
    emergencyRelation.trim() !== (user.emergencyRelation || '').trim()

  useEffect(() => {
    if (dirty) return
    setEmergencyName(user.emergencyName || '')
    setEmergencyPhone(user.emergencyPhone || '')
    setEmergencyRelation(user.emergencyRelation || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.emergencyName, user.emergencyPhone, user.emergencyRelation])

  const save = async () => {
    const nextName = emergencyName.trim()
    const nextPhone = emergencyPhone.trim()
    const nextRelation = emergencyRelation.trim()
    if (!nextName || !nextPhone) {
      toast.error('请填写联系人姓名和电话')
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await updateEmergencyContact({
        emergencyName: nextName,
        emergencyPhone: nextPhone,
        emergencyRelation: nextRelation
      })
      // The action returns no body; merge optimistically into the session user.
      setUser({
        ...user,
        emergencyName: nextName,
        emergencyPhone: nextPhone,
        emergencyRelation: nextRelation
      })
      toast.success('紧急联系人已更新')
    } catch (err) {
      toast.error(err instanceof CloudError ? err.message : '保存失败，请稍后再试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <span className="section-title" style={{ margin: '0 0 6px' }}>
        <Phone size={17} /> 紧急联系人
      </span>
      <p className="callout__text" style={{ margin: '0 0 14px' }}>
        陪跑过程中如遇突发情况，志愿者可第一时间联系到 TA。
      </p>

      <div className="stack stack--sm">
        <div className="field">
          <label className="field__label" htmlFor="mine-em-name">
            联系人姓名
          </label>
          <input
            id="mine-em-name"
            className="input"
            type="text"
            placeholder="联系人姓名"
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="mine-em-phone">
              联系电话
            </label>
            <input
              id="mine-em-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="手机号"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="mine-em-rel">
              关系<span className="field__hint">（选填）</span>
            </label>
            <input
              id="mine-em-rel"
              className="input"
              type="text"
              placeholder="如：家人"
              value={emergencyRelation}
              onChange={(e) => setEmergencyRelation(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn btn--accent btn--block"
          style={{ marginTop: 4 }}
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? <Spinner /> : <Save size={18} />}
          {saving ? '保存中…' : '保存联系人'}
        </button>
      </div>
    </section>
  )
}

/* --------------------------- volunteer details ---------------------------- */

function VolunteerDetails({ user }: { user: User }) {
  return (
    <section className="card">
      <span className="section-title" style={{ margin: '0 0 14px' }}>
        <Footprints size={17} /> 陪跑资料
      </span>

      <div className="stack stack--sm">
        <div className="list-row" role="group" style={{ cursor: 'default' }}>
          <span
            className="callout__icon"
            style={{ background: 'var(--pine-tint)', color: 'var(--pine)' }}
          >
            {user.isAvailable ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </span>
          <div className="list-row__body">
            <div className="list-row__title">接单状态</div>
            <div className="list-row__meta">{user.isAvailable ? '在线 · 可接单' : '离线'}</div>
          </div>
          <span className={user.isAvailable ? 'chip chip--pine' : 'chip'}>
            {user.isAvailable ? '在线' : '离线'}
          </span>
        </div>

        <DetailRow icon={<Clock size={15} />} label="跑龄" value={user.runningYears || '未填写'} />
        <DetailRow icon={<Gauge size={15} />} label="平均配速" value={user.pace || '未填写'} />
        <DetailRow
          icon={<Medal size={15} />}
          label="马拉松经历"
          value={yesNoLabel(user.hasMarathon)}
        />
        <DetailRow
          icon={<HeartPulse size={15} />}
          label="急救证书"
          value={yesNoLabel(user.hasFirstAid)}
        />
        <DetailRow
          icon={<Users size={15} />}
          label="陪跑经验"
          value={yesNoLabel(user.hasCompanionExp)}
        />
      </div>

      <p className="field__hint" style={{ marginTop: 12 }}>
        陪跑资料在注册时填写，如需修改请联系平台管理员。
      </p>
    </section>
  )
}

/* ---------------------------- account details ----------------------------- */

function AccountDetails({ user, isVolunteer }: { user: User; isVolunteer: boolean }) {
  const certified = user.examPassed === true && Boolean(user.certificateNo)

  return (
    <section className="card">
      <span className="section-title" style={{ margin: '0 0 14px' }}>
        <ShieldCheck size={17} /> 账号信息
      </span>

      <div className="stack stack--sm">
        {user.phone && (
          <DetailRow icon={<Phone size={15} />} label="手机号" value={user.phone} />
        )}
        {user.email && (
          <DetailRow icon={<Mail size={15} />} label="邮箱" value={user.email} />
        )}
        {!user.phone && !user.email && (
          <DetailRow icon={<UserIcon size={15} />} label="登录方式" value="已登录" />
        )}

        <DetailRow
          icon={<UserIcon size={15} />}
          label="身份"
          value={isVolunteer ? '陪跑志愿者' : '视障跑者'}
        />

        {user.createdAt && (
          <DetailRow
            icon={<Clock size={15} />}
            label="注册时间"
            value={formatDate(user.createdAt)}
          />
        )}

        {isVolunteer && (
          <DetailRow
            icon={certified ? <Award size={15} /> : <ShieldCheck size={15} />}
            label="陪跑认证"
            value={
              certified
                ? `已认证 · ${user.certificateNo}`
                : user.examPassed === true
                  ? '考核已通过'
                  : user.videoWatched
                    ? '认证进行中'
                    : '未开始认证'
            }
          />
        )}
      </div>
    </section>
  )
}

/* -------------------------------- helpers --------------------------------- */

function DetailRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="row row--between" style={{ gap: 12, alignItems: 'flex-start' }}>
      <span
        className="faint"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, flex: 'none' }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: 13.5,
          textAlign: 'right',
          wordBreak: 'break-word',
          minWidth: 0
        }}
      >
        {value}
      </span>
    </div>
  )
}

function yesNoLabel(value: YesNo | undefined): string {
  if (value === 'yes') return '有'
  if (value === 'no') return '无'
  return '未填写'
}

/** Render an ISO-ish date string as YYYY-MM-DD; falls back to the raw value. */
function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value
}
