import type { MouseEvent, ReactNode } from 'react'
import { BottomNav, type NavItem } from './BottomNav'
import type { UserType } from '../types'
import { getSpokenLabel, speakVoiceCue } from '../lib/voiceCue'
import brandLogo from '../assets/xinban-run-logo.jpg'

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
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (role !== 'disabled') return
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!button || !event.currentTarget.contains(button)) return
    const label = getSpokenLabel(button)
    if (label) speakVoiceCue(label)
  }

  return (
    <div className="app" data-role={role} onClickCapture={onClickCapture}>
      <header className="app__header">
        <div className="app__header-titles">
          <div className="app__brand" aria-label="助跑精灵">
            <span className="app__brand-mark" aria-hidden>
              <img src={brandLogo} alt="" />
            </span>
            <span className="app__brand-name">助跑精灵</span>
          </div>
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
