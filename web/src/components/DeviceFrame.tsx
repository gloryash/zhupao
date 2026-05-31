import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { StatusBar } from './StatusBar'
import { useToastViewport } from './Toast'
import { QuickExperience } from './QuickExperience'

export interface DeviceSpec {
  id: string
  label: string
  width: number
  height: number
}

export const DEVICE_SPECS: DeviceSpec[] = [
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'iphone-15-pro-max', label: '15 Pro Max', width: 430, height: 932 }
]

/** Width below which we drop the frame and render the pure app (real mobile). */
const BARE_BREAKPOINT = 620

function useIsBare(): boolean {
  const [bare, setBare] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.innerWidth < BARE_BREAKPOINT || !window.matchMedia('(pointer: fine)').matches
  )
  useEffect(() => {
    const update = () =>
      setBare(window.innerWidth < BARE_BREAKPOINT || !window.matchMedia('(pointer: fine)').matches)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bare
}

/**
 * DeviceFrame renders a realistic phone preview on desktop (status bar,
 * Dynamic Island, home indicator, safe areas) and the bare full-screen app on
 * small screens / touch devices. It is preview-only chrome — business pages
 * never reference it.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const bare = useIsBare()
  const [specIndex, setSpecIndex] = useState(0)
  const spec = DEVICE_SPECS[specIndex]
  // Toasts mount into whichever surface is live so they stay inside the phone
  // screen on desktop preview (and the full-screen app on mobile).
  const registerToastViewport = useToastViewport()

  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (bare) return
    const fit = () => {
      const padding = 96
      const availH = window.innerHeight - padding
      const availW = window.innerWidth - padding
      const next = Math.min(1, availH / spec.height, availW / spec.width)
      setScale(Number(next.toFixed(3)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [bare, spec.height, spec.width])

  if (bare) {
    return (
      <div className="bare-stage" ref={registerToastViewport}>
        {children}
      </div>
    )
  }

  return (
    <div className="preview-stage" ref={stageRef}>
      <div className="preview-stage__brand">
        <h1>
          <span className="preview-stage__dot" /> 助盲跑
        </h1>
        <p>移动端预览 · 由微信小程序迁移而来，与原小程序共享同一 CloudBase 后端。</p>
      </div>

      {/* Preview-only shortcut to enter as a demo role (left blank area). */}
      <QuickExperience />

      <div
        className="device"
        style={{
          width: spec.width,
          height: spec.height,
          transform: `scale(${scale})`
        }}
      >
        <div className="device__island" />
        <div
          className="device__screen"
          ref={registerToastViewport}
          style={{ ['--safe-top' as string]: '0px', ['--safe-bottom' as string]: '24px' }}
        >
          <StatusBar />
          {children}
          <div className="device__home-indicator" />
        </div>
      </div>

      <div className="device-switch" role="group" aria-label="选择预览机型">
        {DEVICE_SPECS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={i === specIndex}
            onClick={() => setSpecIndex(i)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
