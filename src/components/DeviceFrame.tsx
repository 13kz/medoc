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
        <div className="device-status" aria-hidden>
          <span>{formatTime(now)}</span>
          <span className="device-notch" />
          <span>📶 🔋</span>
        </div>
        <div className="device-screen">{children}</div>
      </div>
    </section>
  )
}
