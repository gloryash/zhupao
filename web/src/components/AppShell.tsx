import type { ReactNode } from 'react'
import { BottomNav, type NavItem } from './BottomNav'
import type { UserType } from '../types'

export function AppShell({
  role,
  eyebrow,
  title,
  headerAction,
  navItems,
  activeTab,
  onSelectTab,
  children
}: {
  role: UserType
  eyebrow: string
  title: string
  headerAction?: ReactNode
  navItems: NavItem[]
  activeTab: string
  onSelectTab: (key: string) => void
  children: ReactNode
}) {
  return (
    <div className="app" data-role={role}>
      <header className="app__header">
        <div className="app__header-titles">
          <p className="app__eyebrow">{eyebrow}</p>
          <h1 className="app__title">{title}</h1>
        </div>
        {headerAction}
      </header>
      <main className="app__content" key={activeTab}>
        {children}
      </main>
      <BottomNav items={navItems} active={activeTab} onSelect={onSelectTab} />
    </div>
  )
}
