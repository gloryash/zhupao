import { useState } from 'react'
import { Footprints, HeartHandshake, Wand2 } from 'lucide-react'
import { Spinner } from './ui'
import { useSession } from '../stores/session'
import { useToast } from './Toast'
import { DEMO_ACCOUNTS, type DemoAccount } from '../lib/demoAccounts'
import type { UserType } from '../types'

/* Per-role presentation for the quick-experience buttons. Reuses the shared
   .btn accents so the controls stay on-brand (amber = runner, pine = volunteer)
   and mirrors the role icons used on the auth screen. */
const ROLE_UI: Record<UserType, { icon: typeof Footprints; btnClass: string }> = {
  disabled: { icon: Footprints, btnClass: 'btn--accent' },
  volunteer: { icon: HeartHandshake, btnClass: 'btn--pine' }
}

/**
 * Desktop-preview-only shortcut that signs into a disposable demo account via
 * the real session login flow (`useSession().login` → `webAuth.login`), so the
 * phone preview lands directly on the matching role home page without manual
 * entry. Rendered beside the DeviceFrame; never shown in bare/mobile view.
 */
export function QuickExperience() {
  const { login } = useSession()
  const toast = useToast()
  const [pending, setPending] = useState<UserType | null>(null)

  const enterAs = async (account: DemoAccount) => {
    if (pending) return
    setPending(account.role)
    try {
      // Same call the manual login form makes. On success the session flips to
      // `authenticated` and the preview swaps to the role's home page.
      await login(account.identifier, account.password)
    } catch (err) {
      const detail = err instanceof Error && err.message ? `：${err.message}` : '，请稍后再试'
      toast.error(`体验登录失败${detail}`)
    } finally {
      // Clear on both success and failure so the buttons re-enable and the user
      // can switch to the other demo role from the same preview.
      setPending(null)
    }
  }

  return (
    <aside className="quick-demo" aria-label="桌面预览快捷体验">
      <span className="quick-demo__kicker">
        <Wand2 size={13} strokeWidth={2.6} />
        快速体验
      </span>
      <p className="quick-demo__hint">无需登录，一键以演示身份进入完整流程。</p>
      <div className="quick-demo__actions">
        {DEMO_ACCOUNTS.map((account) => {
          const { icon: Icon, btnClass } = ROLE_UI[account.role]
          const loading = pending === account.role
          return (
            <button
              key={account.role}
              type="button"
              className={`btn ${btnClass} btn--block`}
              disabled={pending !== null}
              aria-busy={loading}
              onClick={() => enterAs(account)}
            >
              {loading ? <Spinner /> : <Icon size={18} strokeWidth={2.4} />}
              {account.label}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
