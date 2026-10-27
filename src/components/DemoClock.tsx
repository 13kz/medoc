import { ConfirmButton } from './ConfirmButton'
import { useNow } from '../lib/clock'
import { formatTime } from '../lib/schedule'
import { offsetTo } from '../lib/seed'
import { useStore } from '../lib/store'

const JUMPS = [
  { label: '+5 min', ms: 5 * 60000 },
  { label: '+15 min', ms: 15 * 60000 },
  { label: '+1 h', ms: 60 * 60000 },
]

const PRESETS = ['07:55', '12:25', '19:25', '20:55', '21:55']

export function DemoClock() {
  const { state, dispatch } = useStore()
  const now = useNow()
  const fast = state.clock.speed > 1

  const goTo = (hhmm: string) => {
    // Saute à l'heure voulue du jour simulé, en gardant la vitesse courante.
    dispatch({ type: 'clockJump', deltaMs: offsetTo(hhmm, now), realNow: Date.now() })
  }

  return (
    <section className="side-card demo-clock" aria-label="Horloge de démonstration">
      <h2>Horloge de démo</h2>
      <p className="demo-time" aria-live="polite">
        {formatTime(now)}
        {fast && <span className="demo-fast">×60</span>}
      </p>
      <div className="row wrap">
        {JUMPS.map((j) => (
          <button key={j.label} onClick={() => dispatch({ type: 'clockJump', deltaMs: j.ms, realNow: Date.now() })}>
            {j.label}
          </button>
        ))}
      </div>
      <p className="muted small">Aller à</p>
      <div className="row wrap">
        {PRESETS.map((p) => (
          <button key={p} className="ghost" onClick={() => goTo(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <button
          className={fast ? 'primary' : ''}
          onClick={() => dispatch({ type: 'clockSpeed', speed: fast ? 1 : 60, realNow: Date.now() })}
        >
          {fast ? '⏸ Vitesse normale' : '⏩ 1 min par seconde'}
        </button>
        <button className="ghost" onClick={() => dispatch({ type: 'clockReset', realNow: Date.now() })}>
          Heure réelle
        </button>
      </div>
      <ConfirmButton
        className="ghost danger small-btn"
        confirmLabel="Tout effacer ? Toucher pour confirmer"
        onConfirm={() => dispatch({ type: 'reset' })}
      >
        Recommencer la démo
      </ConfirmButton>
    </section>
  )
}
