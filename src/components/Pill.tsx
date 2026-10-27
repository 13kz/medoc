import type { CSSProperties } from 'react'
import { formIcon } from '../lib/schedule'
import type { Medication } from '../lib/types'

/** Pastille de couleur rappelant la boîte ou le comprimé. */
export function Pill({ med, size = 'md' }: { med: Medication; size?: 'md' | 'xl' }) {
  return (
    <span className={`pill pill-${size}`} style={{ '--pill': med.color } as CSSProperties} aria-hidden>
      {formIcon(med.form)}
    </span>
  )
}
