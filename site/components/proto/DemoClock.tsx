'use client'

import { dosesForDay } from '@medoc/lib/schedule'
import { LIDS, lidOf } from '@/lib/box'
import { useStore } from '@/lib/store'
import { cx, hhmm, hm } from '@/lib/util'
import { Icon } from '../ui/Icon'

const START = 6 * 60
const END = 23 * 60 + 30

const SCENES: { at: string; label: string }[] = [
  { at: '07:58', label: 'Réveil' },
  { at: '09:05', label: 'Oubli du matin' },
  { at: '12:31', label: 'Midi' },
  { at: '19:31', label: 'Dîner' },
  { at: '22:01', label: 'Insuline' },
]

/** L'horloge de démo : un ruban de la journée, aux couleurs des couvercles. */
export function DemoClock() {
  const { state, now, dispatch } = useStore()
  const d = new Date(now)
  const minutes = d.getHours() * 60 + d.getMinutes()
  const doses = dosesForDay(state, now)
  const pct = (m: number) => `${((Math.min(Math.max(m, START), END) - START) / (END - START)) * 100}%`
  const jump = (target: number) => {
    const t = new Date(now)
    t.setHours(Math.floor(target / 60), target % 60, 0, 0)
    dispatch({ type: 'clockJump', deltaMs: t.getTime() - now, realNow: Date.now() })
  }
  const speed = state.clock.speed

  return (
    <div className="clk">
      <div className="clk-time">
        <span className="clk-label">Heure de la démo</span>
        <strong>{hm(now)}</strong>
      </div>
      <div className="clk-controls">
        <button className={cx('clk-btn', speed === 1 && 'is-on')} onClick={() => dispatch({ type: 'clockSpeed', speed: 1, realNow: Date.now() })} aria-label="Temps réel">
          <Icon name="pause" size={16} />
        </button>
        <button className={cx('clk-btn', speed === 60 && 'is-on')} onClick={() => dispatch({ type: 'clockSpeed', speed: 60, realNow: Date.now() })} aria-label="1 minute par seconde">
          <Icon name="play" size={16} /> ×60
        </button>
        <button className={cx('clk-btn', speed === 600 && 'is-on')} onClick={() => dispatch({ type: 'clockSpeed', speed: 600, realNow: Date.now() })} aria-label="10 minutes par seconde">
          <Icon name="forward" size={16} /> ×600
        </button>
      </div>
      <div className="clk-ribbon">
        <div className="clk-track">
          {LIDS.map((l, i) => {
            const bounds = [
              [START, 11 * 60],
              [11 * 60, 18 * 60],
              [18 * 60, 21 * 60],
              [21 * 60, END],
            ][i]
            return <span key={l.id} className="clk-seg" style={{ left: pct(bounds[0]), width: `calc(${pct(bounds[1])} - ${pct(bounds[0])})`, ['--tone' as string]: l.tone }} />
          })}
          {doses.map((x) => {
            const [h, m] = x.time.split(':').map(Number)
            return <span key={x.key} className="clk-tick" data-status={x.status} style={{ left: pct(h * 60 + m), ['--tone' as string]: LIDS.find((l) => l.id === lidOf(x.time))!.tone }} title={`${x.time} ${x.med.name}`} />
          })}
          <span className="clk-now" style={{ left: pct(minutes) }} />
        </div>
        <input
          className="clk-range"
          type="range"
          min={START}
          max={END}
          step={5}
          value={Math.min(Math.max(minutes, START), END)}
          onChange={(e) => jump(Number(e.target.value))}
          aria-label="Déplacer l’heure de la démo"
        />
        <div className="clk-hours" aria-hidden="true">
          {[6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h} style={{ left: pct(h * 60) }}>
              {h} h
            </span>
          ))}
        </div>
      </div>
      <div className="clk-scenes">
        {SCENES.map((s) => (
          <button
            key={s.at}
            onClick={() => {
              const [h, m] = s.at.split(':').map(Number)
              jump(h * 60 + m)
            }}
          >
            <span>{hhmm(s.at)}</span>
            {s.label}
          </button>
        ))}
        <button className="clk-reset" onClick={() => dispatch({ type: 'reset' })}>
          <Icon name="reset" size={15} /> Recommencer
        </button>
      </div>
    </div>
  )
}
