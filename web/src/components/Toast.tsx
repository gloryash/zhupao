import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

type ToastKind = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Lets the app register the element toasts should render into — see
 *  DeviceFrame, which points it at the phone screen so desktop-preview toasts
 *  stay inside the device instead of the outer page. */
const ToastViewportContext = createContext<(el: HTMLElement | null) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const idRef = useRef(0)

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error')
  }

  const host = (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.kind === 'success' && <CheckCircle2 size={16} />}
          {t.kind === 'error' && <XCircle size={16} />}
          {t.kind === 'info' && <Info size={16} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )

  return (
    <ToastContext.Provider value={api}>
      <ToastViewportContext.Provider value={setViewport}>
        {children}
        {/* Portal into the registered viewport (the phone screen) when present;
            fall back to inline rendering before/without one. */}
        {viewport ? createPortal(host, viewport) : host}
      </ToastViewportContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/** Register the DOM element toasts should render into. Pass as a callback ref. */
export function useToastViewport(): (el: HTMLElement | null) => void {
  return useContext(ToastViewportContext)
}
