import type { UserType } from '../types'

/**
 * Disposable demo accounts powering the desktop-preview "quick experience"
 * entry. These are throwaway credentials shared with the QA/e2e fixtures; the
 * defaults are intentionally baked in so the local demo works with zero env
 * setup. Override them per-environment via VITE_DEMO_* vars when needed (e.g.
 * after rotating the fixtures) without touching component code.
 */
export interface DemoAccount {
  role: UserType
  /** Exact button label shown in the desktop preview. */
  label: string
  identifier: string
  password: string
}

const env = import.meta.env
const DEFAULT_PASSWORD = 'Passw0rd!1780200869'
const password = env.VITE_DEMO_PASSWORD || DEFAULT_PASSWORD

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'disabled',
    label: '我想体验视障跑者',
    identifier: env.VITE_DEMO_DISABLED_EMAIL || 'e2e.blind.1780200869@example.com',
    password
  },
  {
    role: 'volunteer',
    label: '我想体验志愿者',
    identifier: env.VITE_DEMO_VOLUNTEER_EMAIL || 'e2e.volunteer.1780200869@example.com',
    password
  }
]
