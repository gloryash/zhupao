import { useEffect, useState } from 'react'
import { Signal, Wifi } from 'lucide-react'

/** Simulated iOS-style status bar — only rendered inside the desktop device frame. */
export function StatusBar() {
  const [time, setTime] = useState(formatTime)

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 15_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="statusbar" aria-hidden>
      <span className="statusbar__time">{time}</span>
      <div className="statusbar__right">
        <Signal size={16} strokeWidth={2.4} />
        <Wifi size={16} strokeWidth={2.4} />
        <span className="statusbar__battery">
          <span className="statusbar__battery-shell">
            <span className="statusbar__battery-fill" style={{ width: '82%' }} />
          </span>
        </span>
      </div>
    </div>
  )
}

function formatTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
