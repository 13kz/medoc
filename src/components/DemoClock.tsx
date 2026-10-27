import { useNow } from '../lib/clock'
import { dosesForDay, formatTime } from '../lib/schedule'
import { offsetTo } from '../lib/seed'
import { useStore } from '../lib/store'
import { ConfirmButton } from './ConfirmButton'
import { Icon } from './Icon'

const JUMPS = [
  { label: '+5 min', ms: 5 * 60000 },
  { label: '+15 min', ms: 15 * 60000 },
  { label: '+1 h', ms: 60 * 60000 },
]

const DAY_START = 6 * 60
const DAY_END = 24 * 60 - 1

const minutesOf = (ms: number) => {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

const pct = (min: number) => ((min - DAY_START) / (DAY_END - DAY_START)) * 100

/** Horloge de démo : curseur sur la journée, avec les heures de prise repérées. */
export function DemoClock() {
  const { state, dispatch } = useStore()
  const now = useNow()
  const fast = state.clock.speed > 1
  const doses = dosesForDay(state, now)
  const nowMin = minutesOf(now)
  const marks = [...new Set(doses.map((d) => d.time))].map((t) => {
    const [h, m] = t.split(':').map(Number)
    const min = h * 60 + m
    const st = doses.filter((d) => d.time === t)
    const state = st.every((d) => d.status === 'pris') ? 'done' : st.some((d) => d.status === 'en-retard') ? 'late' : min <= nowMin ? 'now' : 'later'
    return { t, min, state }
  })

  const jumpTo = (min: number) => {
    const hh = String(Math.floor(min / 60)).padStart(2, '0')
    const mm = String(min % 60).padStart(2, '0')
    dispatch({ type: 'clockJump', deltaMs: offsetTo(`${hh}:${mm}`, now), realNow: Date.now() })
  }

  return (
    <section className="side-card demo-clock" aria-label="Horloge de démonstration">
      <div className="dc-head">
        <h2>Horloge de démo</h2>
        {fast && <span className="dc-fast">×60</span>}
      </div>
      <p className="dc-time" aria-live="polite">
        {formatTime(now)}
      </p>

      <div className="dc-track">
        <div className="dc-marks" aria-hidden="true">
          {marks.map((m) => (
            <span key={m.t} className={`dc-mark dc-${m.state}`} style={{ left: `${pct(m.min)}%` }} title={m.t} />
          ))}
        </div>
        <input
          id="demo-time"
          type="range"
          min={DAY_START}
          max={DAY_END}
          step={5}
          value={Math.max(DAY_START, nowMin)}
          aria-label="Heure de la journée"
          aria-valuetext={formatTime(now)}
          onChange={(e) => jumpTo(Number(e.target.value))}
        />
        <div className="dc-scale" aria-hidden="true">
          <span>6 h</span>
          <span>12 h</span>
          <span>18 h</span>
          <span>24 h</span>
        </div>
      </div>

      <div className="dc-row">
        {JUMPS.map((j) => (
          <button key={j.label} onClick={() => dispatch({ type: 'clockJump', deltaMs: j.ms, realNow: Date.now() })}>
            {j.label}
          </button>
        ))}
      </div>
      <div className="dc-row">
        <button
          className={fast ? 'primary' : ''}
          aria-pressed={fast}
          onClick={() => dispatch({ type: 'clockSpeed', speed: fast ? 1 : 60, realNow: Date.now() })}
        >
          <Icon name={fast ? 'pause' : 'forward'} size={16} />
          {fast ? 'Ralentir' : 'Accélérer'}
        </button>
        <button onClick={() => dispatch({ type: 'clockReset', realNow: Date.now() })}>Heure réelle</button>
      </div>
      <ConfirmButton className="dc-reset" confirmLabel="Toucher à nouveau pour tout effacer" onConfirm={() => dispatch({ type: 'reset' })}>
        <Icon name="reset" size={16} />
        Recommencer la démo
      </ConfirmButton>
    </section>
  )
}
