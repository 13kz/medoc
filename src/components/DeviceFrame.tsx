import type { ReactNode } from 'react'
import { useNow } from '../lib/clock'
import { formatTime } from '../lib/schedule'

/** Cadre de téléphone sur grand écran ; plein écran sur un vrai mobile. Reste monté quand il est masqué. */
export function DeviceFrame({
  label,
  hidden,
  variant,
  children,
}: {
  label: string
  hidden: boolean
  variant: string
  children: ReactNode
}) {
  const now = useNow()
  return (
    <section className={`device device-${variant}`} hidden={hidden} aria-label={label}>
      <p className="device-label">{label}</p>
      <div className="device-body">
        <span className="device-btn b1" aria-hidden="true" />
        <span className="device-btn b2" aria-hidden="true" />
        <span className="device-btn b3" aria-hidden="true" />
        <div className="device-glass">
          <div className="device-status" aria-hidden="true">
            <span className="ds-time">{formatTime(now)}</span>
            <span className="device-island" />
            <span className="ds-icons">
              <svg viewBox="0 0 18 12" width="18" height="12">
                <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
                <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
                <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
              </svg>
              <svg viewBox="0 0 27 12" width="27" height="12">
                <rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".45" />
                <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill="currentColor" />
                <path d="M24.5 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".45" />
              </svg>
            </span>
          </div>
          <div className="device-screen">{children}</div>
          <span className="device-home" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
