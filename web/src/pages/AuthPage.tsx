import { useState, type CSSProperties, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Footprints,
  HeartHandshake,
  Lock,
  Sun,
  User as UserIcon
} from 'lucide-react'
import { Spinner } from '../components/ui'
import { useSession } from '../stores/session'
import { useToast } from '../components/Toast'
import type { RegisterProfile } from '../services/api'
import type { UserType, YesNo } from '../types'

type Mode = 'login' | 'register'

const ROLE_OPTIONS: {
  value: UserType
  name: string
  desc: string
  icon: typeof Footprints
  accentBg: string
}[] = [
  {
    value: 'disabled',
    name: '视障跑者',
    desc: '发起陪跑，邀请志愿者并肩奔跑',
    icon: Footprints,
    accentBg: 'var(--beacon)'
  },
  {
    value: 'volunteer',
    name: '陪跑志愿者',
    desc: '通过认证后，为跑者引导护航',
    icon: HeartHandshake,
    accentBg: 'var(--pine)'
  }
]

/** Guest entry point — email/phone + password login and registration with a
 *  role switch and role-specific profile fields. Backend errors surface through
 *  the toast host and inline beneath the form. */
export function AuthPage() {
  const { login, register } = useSession()
  const toast = useToast()

  const [mode, setMode] = useState<Mode>('login')
  const [role, setRole] = useState<UserType>('disabled')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared credentials
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Registration profile
  const [nickName, setNickName] = useState('')
  const [name, setName] = useState('')
  const [runningLocation, setRunningLocation] = useState('')
  // disabled-only
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')
  // volunteer-only
  const [runningYears, setRunningYears] = useState('')
  const [pace, setPace] = useState('')
  const [hasMarathon, setHasMarathon] = useState<YesNo>('no')
  const [hasFirstAid, setHasFirstAid] = useState<YesNo>('no')
  const [hasCompanionExp, setHasCompanionExp] = useState<YesNo>('no')

  const fail = (message: string) => {
    setError(message)
    toast.error(message)
  }

  const buildProfile = (): RegisterProfile => {
    const profile: RegisterProfile = { userType: role, nickName: nickName.trim() }
    if (name.trim()) profile.name = name.trim()
    if (runningLocation.trim()) profile.runningLocation = runningLocation.trim()
    if (role === 'disabled') {
      if (emergencyName.trim()) profile.emergencyName = emergencyName.trim()
      if (emergencyPhone.trim()) profile.emergencyPhone = emergencyPhone.trim()
      if (emergencyRelation.trim()) profile.emergencyRelation = emergencyRelation.trim()
    } else {
      if (runningYears.trim()) profile.runningYears = runningYears.trim()
      if (pace.trim()) profile.pace = pace.trim()
      profile.hasMarathon = hasMarathon
      profile.hasFirstAid = hasFirstAid
      profile.hasCompanionExp = hasCompanionExp
    }
    return profile
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!identifier.trim() || !password) {
      fail('请输入邮箱/手机号和密码')
      return
    }
    if (mode === 'register' && !nickName.trim()) {
      fail('请填写一个昵称')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password)
      } else {
        await register(identifier.trim(), password, buildProfile())
      }
      // On success the session flips to authenticated and this view unmounts.
    } catch (err) {
      fail(err instanceof Error && err.message ? err.message : '操作失败，请稍后再试')
      setSubmitting(false)
    }
  }

  const accentStyle: CSSProperties =
    mode === 'register' && role === 'volunteer'
      ? ({
          '--accent': 'var(--pine)',
          '--accent-deep': '#0c4738',
          '--accent-tint': 'var(--pine-tint)'
        } as CSSProperties)
      : {}

  return (
    <div
      className="auth"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', ...accentStyle }}
    >
      <div className="auth__hero">
        <span className="auth__logo">
          <span className="auth__logo-mark">
            <Sun size={16} strokeWidth={2.6} />
          </span>
          助盲跑
        </span>
        <h1 className="auth__headline">
          陪你<em>向光</em>
          <br />
          一起奔跑
        </h1>
        <p className="auth__sub">连接视障跑者与经过认证的陪跑志愿者，让每一段路都有人同行。</p>
      </div>

      <form className="auth__card" onSubmit={onSubmit} noValidate>
        <div className="auth__tabs" role="tablist" aria-label="登录或注册">
          <button
            type="button"
            role="tab"
            aria-pressed={mode === 'login'}
            onClick={() => {
              setMode('login')
              setError(null)
            }}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={mode === 'register'}
            onClick={() => {
              setMode('register')
              setError(null)
            }}
          >
            注册
          </button>
        </div>

        <div className="stack stack--sm">
          {mode === 'register' && (
            <div className="field">
              <span className="field__label">我是</span>
              <div className="role-pick">
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = role === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className="role-pick__option"
                      data-variant={opt.value}
                      aria-pressed={active}
                      onClick={() => setRole(opt.value)}
                    >
                      <span className="role-pick__icon" style={{ background: opt.accentBg }}>
                        <Icon size={18} strokeWidth={2.4} />
                      </span>
                      <div className="role-pick__name">{opt.name}</div>
                      <div className="role-pick__desc">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="auth-identifier">
              邮箱或手机号
            </label>
            <div className="input-group">
              <UserIcon size={18} className="faint" />
              <input
                id="auth-identifier"
                className="input"
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="you@example.com 或 手机号"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="auth-password">
              密码
            </label>
            <div className="input-group">
              <Lock size={18} className="faint" />
              <input
                id="auth-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--ink-faint)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div className="field">
                <label className="field__label" htmlFor="auth-nick">
                  昵称
                </label>
                <input
                  id="auth-nick"
                  className="input"
                  type="text"
                  placeholder="他人看到的称呼"
                  value={nickName}
                  onChange={(e) => setNickName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="auth-name">
                  真实姓名<span className="field__hint">（选填）</span>
                </label>
                <input
                  id="auth-name"
                  className="input"
                  type="text"
                  placeholder="用于陪跑时的身份核对"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="auth-loc">
                  常跑地点<span className="field__hint">（选填）</span>
                </label>
                <input
                  id="auth-loc"
                  className="input"
                  type="text"
                  placeholder="如：奥林匹克森林公园"
                  value={runningLocation}
                  onChange={(e) => setRunningLocation(e.target.value)}
                />
              </div>

              {role === 'disabled' ? (
                <div className="stack stack--sm">
                  <div className="field">
                    <label className="field__label" htmlFor="auth-em-name">
                      紧急联系人
                    </label>
                    <input
                      id="auth-em-name"
                      className="input"
                      type="text"
                      placeholder="联系人姓名"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label className="field__label" htmlFor="auth-em-phone">
                        联系电话
                      </label>
                      <input
                        id="auth-em-phone"
                        className="input"
                        type="tel"
                        inputMode="tel"
                        placeholder="手机号"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="auth-em-rel">
                        关系
                      </label>
                      <input
                        id="auth-em-rel"
                        className="input"
                        type="text"
                        placeholder="如：家人"
                        value={emergencyRelation}
                        onChange={(e) => setEmergencyRelation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stack stack--sm">
                  <div className="grid-2">
                    <div className="field">
                      <label className="field__label" htmlFor="auth-years">
                        跑龄
                      </label>
                      <input
                        id="auth-years"
                        className="input"
                        type="text"
                        placeholder="如：3 年"
                        value={runningYears}
                        onChange={(e) => setRunningYears(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="auth-pace">
                        平均配速
                      </label>
                      <input
                        id="auth-pace"
                        className="input"
                        type="text"
                        placeholder="如：6'30&quot;"
                        value={pace}
                        onChange={(e) => setPace(e.target.value)}
                      />
                    </div>
                  </div>
                  <YesNoField label="是否有马拉松经历" value={hasMarathon} onChange={setHasMarathon} />
                  <YesNoField label="是否持有急救证书" value={hasFirstAid} onChange={setHasFirstAid} />
                  <YesNoField
                    label="是否有陪跑经验"
                    value={hasCompanionExp}
                    onChange={setHasCompanionExp}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="field__error">{error}</p>}

          <button
            type="submit"
            className="btn btn--accent btn--block"
            disabled={submitting}
            style={{ marginTop: 4 }}
          >
            {submitting ? (
              <Spinner />
            ) : (
              <>
                {mode === 'login' ? '登录' : '创建账号'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

function YesNoField({
  label,
  value,
  onChange
}: {
  label: string
  value: YesNo
  onChange: (v: YesNo) => void
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="segmented">
        <button type="button" aria-pressed={value === 'yes'} onClick={() => onChange('yes')}>
          是
        </button>
        <button type="button" aria-pressed={value === 'no'} onClick={() => onChange('no')}>
          否
        </button>
      </div>
    </div>
  )
}
