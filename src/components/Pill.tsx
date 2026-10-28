import type { Medication } from '../lib/types'

/**
 * Dessin du médicament dans sa forme réelle et sa couleur, pour le reconnaître d'un coup d'œil.
 * Avec `photo`, la photo de la boîte remplace le dessin quand l'aidant en a pris une.
 */
export function Pill({ med, size = 'md', photo = false }: { med: Medication; size?: 'xs' | 'sm' | 'md' | 'xl'; photo?: boolean }) {
  if (photo && med.photo) {
    return (
      <span className={`pill pill-${size} pill-photo`}>
        <img src={med.photo} alt={`Boîte de ${med.name}`} />
      </span>
    )
  }
  const c = med.color
  const ink = 'var(--pill-ink, #1b2420)'
  let shape
  switch (med.form) {
    case 'comprime':
      shape = (
        <>
          <path d="M9 22v5c0 4.4 6.7 8 15 8s15-3.6 15-8v-5" fill={c} stroke={ink} strokeWidth="2.5" />
          <ellipse cx="24" cy="22" rx="15" ry="8" fill={c} stroke={ink} strokeWidth="2.5" />
          <path d="M18 22h12" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity=".5" />
        </>
      )
      break
    case 'gelule':
      shape = (
        <g transform="rotate(-35 24 24)">
          <path d="M24 15h-6a9 9 0 000 18h6z" fill={c} stroke={ink} strokeWidth="2.5" />
          <path d="M24 15h6a9 9 0 010 18h-6z" fill="#fbfbf7" stroke={ink} strokeWidth="2.5" />
        </g>
      )
      break
    case 'sachet':
      shape = (
        <>
          <path d="M13 14l2.75-2 2.75 2 2.75-2 2.75 2 2.75-2 2.75 2 2.75-2 2.75 2V36H13z" fill={c} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M18 24h12 M18 29h8" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity=".55" />
        </>
      )
      break
    case 'injection':
      shape = (
        <g transform="rotate(-40 24 24)">
          <rect x="11" y="19" width="20" height="10" rx="3" fill={c} stroke={ink} strokeWidth="2.5" />
          <rect x="31" y="21" width="5" height="6" rx="1" fill="#fbfbf7" stroke={ink} strokeWidth="2.5" />
          <path d="M36 24h5 M6 24h5" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M17 22v4 M21 22v4" stroke={ink} strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
        </g>
      )
      break
    case 'gouttes':
      shape = <path d="M24 9s-11 12-11 19.5a11 11 0 0022 0C35 21 24 9 24 9z" fill={c} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      break
    default:
      shape = (
        <>
          <rect x="12" y="12" width="24" height="24" rx="6" fill={c} stroke={ink} strokeWidth="2.5" />
          <path d="M24 18v12 M18 24h12" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )
  }
  return (
    <span className={`pill pill-${size}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="100%" height="100%">
        {shape}
      </svg>
    </span>
  )
}
