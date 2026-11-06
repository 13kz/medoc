import { ICON_PATHS, type IconName } from '../lib/icons'

export type { IconName }

/** Jeu d'icônes au trait, dessinées pour rester lisibles en très grand. */


export function Icon({ name, size = 24, stroke = 2, className }: { name: IconName; size?: number | string; stroke?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
