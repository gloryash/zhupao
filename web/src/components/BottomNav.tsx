import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
}

export function BottomNav({
  items,
  active,
  onSelect
}: {
  items: NavItem[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map((item) => {
        const Icon = item.icon
        const current = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            className="bottom-nav__item"
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelect(item.key)}
          >
            <span className="bottom-nav__icon">
              <Icon size={21} strokeWidth={current ? 2.6 : 2} />
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
