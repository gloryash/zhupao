import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Star } from 'lucide-react'

/* Small shared UI primitives that lean on the global stylesheet. */

export function Avatar({
  name,
  src,
  size = 44
}: {
  name?: string
  src?: string
  size?: number
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {src ? <img src={src} alt="" /> : initial}
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" role="presentation" />
}

export function LoadingBlock({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text
}: {
  icon: ReactNode
  title: string
  text?: string
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
    </div>
  )
}

export function Sheet({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  // Anchor lives in the normal tree; we portal the overlay up to the nearest
  // .app surface so the absolutely-positioned backdrop covers the whole phone
  // frame instead of scrolling with (and mis-hit-testing against) app__content.
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const host = anchorRef.current?.closest('.app') as HTMLElement | null
    setContainer(host ?? document.body)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const overlay = (
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__handle" />
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  )

  return (
    <>
      <span ref={anchorRef} aria-hidden style={{ display: 'none' }} />
      {container && createPortal(overlay, container)}
    </>
  )
}

export function StarRating({
  value,
  onChange,
  readOnly = false
}: {
  value: number
  onChange?: (v: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="stars" role={readOnly ? 'img' : 'radiogroup'} aria-label={`评分 ${value} 分`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          data-active={n <= value}
          disabled={readOnly}
          aria-label={`${n} 星`}
          aria-pressed={n === value}
          onClick={() => onChange?.(n)}
          style={readOnly ? { cursor: 'default' } : undefined}
        >
          <Star size={readOnly ? 16 : 30} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}
