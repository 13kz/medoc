/** Jeu d'icônes au trait, dessinées pour rester lisibles en très grand. */

const PATHS = {
  check: 'M4.5 12.5l5 5L19.5 7',
  speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 010 6 M18 6.5a7.5 7.5 0 010 11',
  snooze: 'M12 21a8 8 0 100-16 8 8 0 000 16z M12 9v4l2.5 2 M5 3.5L2.5 6 M19 3.5L21.5 6',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z M5.5 11a6.5 6.5 0 0013 0 M12 17.5V21 M8.5 21h7',
  bell: 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z M10 20.5a2 2 0 004 0',
  alert: 'M12 4l9 16H3z M12 10v4.5 M12 17.5v.01',
  plus: 'M12 5v14 M5 12h14',
  chevron: 'M9.5 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  list: 'M9 6.5h11 M9 12h11 M9 17.5h11 M4.5 6.5h.01 M4.5 12h.01 M4.5 17.5h.01',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 13.5a7.6 7.6 0 000-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 00-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 007 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 000 3l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 002.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 002.6-1.5l2.4 1 2-3.5z',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4z M4 8l8 4 8-4 M12 12v8',
  phone: 'M8 2.5h8a1.5 1.5 0 011.5 1.5v16a1.5 1.5 0 01-1.5 1.5H8A1.5 1.5 0 016.5 20V4A1.5 1.5 0 018 2.5z M11 18.5h2',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14 M16 5v14',
  forward: 'M4 6l8 6-8 6z M12 6l8 6-8 6z',
  reset: 'M4 12a8 8 0 108-8 8 8 0 00-6.5 3.3 M4 4v4h4',
  sunrise: 'M4 18h16 M7 18a5 5 0 0110 0 M12 4v5 M9.5 6.5L12 4l2.5 2.5 M4.5 12.5l1.5 1 M19.5 12.5l-1.5 1',
  sun: 'M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4',
  sunset: 'M4 18h16 M7 18a5 5 0 0110 0 M12 9V4 M9.5 6.5L12 9l2.5-2.5 M4.5 12.5l1.5 1 M19.5 12.5l-1.5 1',
  moon: 'M19.5 14.5A8 8 0 119.5 4.5a6.5 6.5 0 0010 10z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4.5 20.5a7.5 7.5 0 0115 0',
  stethoscope: 'M6 3.5v5a4 4 0 008 0v-5 M10 12.5v2a5 5 0 0010 0v-2 M20 12.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  heart: 'M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0112 7a4.5 4.5 0 017.5 3c0 5.5-7.5 10-7.5 10z',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5.5 M12 7.5v.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  glass: 'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13z M15.5 15.5l5 5',
  ear: 'M7 9a5 5 0 0110 0c0 3-3 4-3 7a3 3 0 01-5.5 1.5 M10 9.5a2 2 0 014 0',
  trash: 'M4.5 6.5h15 M9.5 6.5V4h5v2.5 M6.5 6.5l1 13.5h9l1-13.5',
  meal: 'M7 3v8 M5 3v5a2 2 0 004 0V3 M7 11v10 M17 3c-2 0-3 2.5-3 6h3v12',
  water: 'M12 3.5s-6 6.5-6 11a6 6 0 0012 0c0-4.5-6-11-6-11z',
} as const

export type IconName = keyof typeof PATHS

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
      <path d={PATHS[name]} />
    </svg>
  )
}
