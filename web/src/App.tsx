import { useMemo, useState, type ComponentType } from 'react'
import {
  CalendarDays,
  CircleUser,
  ClipboardList,
  Footprints,
  GraduationCap,
  Home
} from 'lucide-react'
import { DeviceFrame } from './components/DeviceFrame'
import { AppShell } from './components/AppShell'
import type { NavItem } from './components/BottomNav'
import { Avatar, LoadingBlock } from './components/ui'
import { useSession } from './stores/session'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { SportPage } from './pages/SportPage'
import { TrainingPage } from './pages/TrainingPage'
import { OrdersPage } from './pages/OrdersPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { MinePage } from './pages/MinePage'
import type { PageProps } from './pages/types'
import type { User, UserType } from './types'

interface TabDef extends NavItem {
  eyebrow: string
  title: string
  Page: ComponentType<PageProps>
}

/** Build the role-aware tab set. The third slot swaps between the volunteer
 *  training path and the runner order list — everything else is shared. */
function buildTabs(role: UserType): TabDef[] {
  const isVolunteer = role === 'volunteer'
  const eyebrow = isVolunteer ? '陪跑志愿者' : '视障跑者'

  const variant: TabDef = isVolunteer
    ? { key: 'training', label: '培训', icon: GraduationCap, eyebrow, title: '陪跑培训', Page: TrainingPage }
    : { key: 'orders', label: '订单', icon: ClipboardList, eyebrow, title: '我的订单', Page: OrdersPage }

  return [
    { key: 'home', label: '首页', icon: Home, eyebrow, title: '向光奔跑', Page: HomePage },
    {
      key: 'sport',
      label: isVolunteer ? '接单' : '陪跑',
      icon: Footprints,
      eyebrow,
      title: isVolunteer ? '接单广场' : '发起陪跑',
      Page: SportPage
    },
    variant,
    { key: 'appointments', label: '约跑', icon: CalendarDays, eyebrow, title: '约跑日程', Page: AppointmentsPage },
    { key: 'mine', label: '我的', icon: CircleUser, eyebrow, title: '个人中心', Page: MinePage }
  ]
}

function LoadingScreen() {
  return (
    <div
      className="app"
      data-role="disabled"
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <LoadingBlock label="正在唤醒向光之路…" />
    </div>
  )
}

function AuthenticatedApp({ user }: { user: User }) {
  const role = user.userType
  const tabs = useMemo(() => buildTabs(role), [role])
  const [activeTab, setActiveTab] = useState(tabs[0].key)

  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0]
  const Page = current.Page
  const navItems: NavItem[] = tabs.map(({ key, label, icon }) => ({ key, label, icon }))

  return (
    <AppShell
      role={role}
      eyebrow={current.eyebrow}
      title={current.title}
      navItems={navItems}
      activeTab={current.key}
      onSelectTab={setActiveTab}
      headerAction={
        <button
          type="button"
          aria-label="个人中心"
          onClick={() => setActiveTab('mine')}
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Avatar name={user.nickName} src={user.avatarUrl} size={42} />
        </button>
      }
    >
      <Page user={user} role={role} onNavigate={setActiveTab} />
    </AppShell>
  )
}

export default function App() {
  const { status, user } = useSession()

  return (
    <DeviceFrame>
      {status === 'loading' && <LoadingScreen />}
      {status === 'guest' && <AuthPage />}
      {status === 'authenticated' &&
        (user ? <AuthenticatedApp user={user} /> : <LoadingScreen />)}
    </DeviceFrame>
  )
}
