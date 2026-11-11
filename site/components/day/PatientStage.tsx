'use client'

import { useState } from 'react'
import { cx, speak } from '@/lib/util'
import { HoldToTake } from './Moments'

type Mode = 'grand' | 'voix' | 'standard'

const MODES: { id: Mode; label: string }[] = [
  { id: 'grand', label: 'Gros caractères' },
  { id: 'voix', label: 'Voix d’abord' },
  { id: 'standard', label: 'Standard' },
]

/**
 * 8 h 00. La section devient le téléphone de Mireille : on peut changer son affichage comme le ferait Naz.
 */
export function PatientStage() {
  const [mode, setMode] = useState<Mode>('grand')
  return (
    <div className={cx('pst', `pst-${mode}`)}>
      <div className="pst-modes" role="radiogroup" aria-label="Affichage du téléphone de Mireille, réglé par un proche">
        <span>Réglé par Naz :</span>
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} className={cx(mode === m.id && 'is-on')} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'voix' ? (
        <div className="pst-voice">
          <button className="pst-zone pst-zone-a" onClick={() => speak('Il est huit heures. Metformine, un comprimé, pendant le repas. Ramipril, une gélule, avec un verre d’eau.')}>
            Répéter
          </button>
          <HoldToTake />
        </div>
      ) : (
        <div className="pst-main">
          <p className="pst-kicker">C’est l’heure</p>
          <ul className="pst-meds">
            <li>
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="M9 22v5c0 4.4 6.7 8 15 8s15-3.6 15-8v-5" fill="#f5f5f5" stroke="#111" strokeWidth="2.5" />
                <ellipse cx="24" cy="22" rx="15" ry="8" fill="#f5f5f5" stroke="#111" strokeWidth="2.5" />
              </svg>
              <strong>Metformine</strong>
              <span>1 comprimé · pendant le repas</span>
            </li>
            <li>
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <g transform="rotate(-35 24 24)">
                  <path d="M24 15h-6a9 9 0 000 18h6z" fill="#f2a33a" stroke="#111" strokeWidth="2.5" />
                  <path d="M24 15h6a9 9 0 010 18h-6z" fill="#fbfbf7" stroke="#111" strokeWidth="2.5" />
                </g>
              </svg>
              <strong>Ramipril</strong>
              <span>1 gélule · avec un verre d’eau</span>
            </li>
          </ul>
          <HoldToTake />
        </div>
      )}
    </div>
  )
}
