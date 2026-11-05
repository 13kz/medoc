'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { changeSentence } from '@medoc/lib/changes'
import { glucoseAdvice, needsGlucose, unitsForGlucose } from '@medoc/lib/glucose'
import { announce, daySummary, tv } from '@medoc/lib/phrases'
import { dosesForDay, nextUpcoming, pendingNow } from '@medoc/lib/schedule'
import type { Dose } from '@medoc/lib/types'
import { LIDS, lidOf } from '@/lib/box'
import { useStore } from '@/lib/store'
import { cx, hhmm, hm, speak } from '@/lib/util'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'

/**
 * Le téléphone du patient. Une seule chose à la fois : ce qu'il faut prendre maintenant.
 * Pas de statistiques, pas d'alertes, pas de stock : ce qui compte pour lui, c'est le geste.
 */
export function PatientView() {
  const { state, now, dispatch } = useStore()
  const p = state.patient
  const doses = dosesForDay(state, now)
  const pending = pendingNow(doses)
  const next = nextUpcoming(doses)
  const note = state.notes.find((n) => !n.acknowledged)
  const change = state.changes.find((c) => !c.acknowledged)
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const glucoseDose = pending.find((d) => needsGlucose(state, d))

  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 4000)
    return () => clearTimeout(t)
  }, [confirm])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 3200)
    return () => clearTimeout(t)
  }, [done])

  const take = () => {
    if (!confirm) return setConfirm(true)
    for (const d of pending) dispatch({ type: 'take', doseKey: d.key, by: 'patient', at: now })
    setConfirm(false)
    const msg = tv(p, 'C’est noté. Bravo !', 'C’est noté. Bravo !')
    setDone(msg)
    if (p.autoRead) speak(msg, p.voiceRate)
  }
  const later = () => {
    for (const d of pending) dispatch({ type: 'snooze', doseKey: d.key, until: now + state.settings.snoozeMin * 60000 })
    speak(tv(p, `D’accord, je te le redis dans ${state.settings.snoozeMin} minutes.`, `D’accord, je vous le redis dans ${state.settings.snoozeMin} minutes.`), p.voiceRate)
  }
  const listen = () => speak(pending.length ? announce(p, pending, now) : daySummary(p, doses), p.voiceRate)

  const mode = p.displayMode

  return (
    <div className={cx('pt', `pt-${mode}`)} style={{ fontSize: `${p.textScale}em` }}>
      <header className="pt-top">
        <span className="pt-hello">{tv(p, 'Bonjour', 'Bonjour')} {p.name}</span>
        <span className="pt-clock">{hm(now)}</span>
      </header>

      <AnimatePresence>
        {done && (
          <motion.div className="pt-done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} role="status">
            <motion.span className="pt-done-ring" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              <Icon name="check" size="1em" stroke={2.6} />
            </motion.span>
            <p>{done}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {(note || change) && !pending.length && (
        <section className="pt-msg">
          <p className="pt-msg-from">
            <Icon name="stethoscope" size="1.1em" /> {note ? `Message de ${note.from}` : 'Votre traitement change'}
          </p>
          <p className="pt-msg-text">{note ? note.text : changeSentence(p, change!)}</p>
          <div className="pt-row">
            <button className="pt-btn pt-btn-ghost" onClick={() => speak(note ? note.text : changeSentence(p, change!), p.voiceRate)}>
              <Icon name="speaker" size="1.1em" /> Écouter
            </button>
            <button
              className="pt-btn pt-btn-main pt-btn-sm"
              onClick={() => dispatch(note ? { type: 'ackNote', id: note.id } : { type: 'ackChange', id: change!.id })}
            >
              J’ai compris
            </button>
          </div>
        </section>
      )}

      {mode === 'voix' ? (
        <VoiceMode pending={pending} next={next} onTake={take} onListen={listen} confirm={confirm} />
      ) : pending.length > 0 ? (
        <section className="pt-now" aria-live="polite">
          <p className="pt-kicker">{pending.some((d) => d.status === 'en-retard') ? 'Un peu en retard' : 'C’est l’heure'}</p>
          <ul className="pt-meds">
            {pending.map((d) => (
              <li key={d.key}>
                <Pill med={d.med} size="xl" />
                <div>
                  <strong>{d.med.name.replace(/ \d.*$/, '')}</strong>
                  <span>{glucoseDose?.key === d.key ? 'Mesurer la glycémie d’abord' : d.med.dose}</span>
                  {d.med.instructions && <em>{d.med.instructions}</em>}
                </div>
              </li>
            ))}
          </ul>
          {glucoseDose ? (
            <GlucoseEntry dose={glucoseDose} />
          ) : (
            <>
              <button className={cx('pt-take', confirm && 'is-confirm')} onClick={take}>
                <Icon name="check" size="1.2em" stroke={3} />
                {confirm ? 'Touchez encore pour confirmer' : 'J’ai pris'}
              </button>
              <div className="pt-row">
                <button className="pt-btn pt-btn-ghost" onClick={later}>
                  <Icon name="snooze" size="1.1em" /> Plus tard
                </button>
                <button className="pt-btn pt-btn-ghost" onClick={listen}>
                  <Icon name="speaker" size="1.1em" /> Écouter
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="pt-rest">
          <p className="pt-kicker">Rien à prendre maintenant</p>
          {next ? (
            <>
              <p className="pt-next-time">{hhmm(next.time)}</p>
              <Pill med={next.med} size="xl" />
              <p className="pt-next-what">
                Prochaine prise : <strong>{next.med.name.replace(/ \d.*$/, '')}</strong>
                {next.status === 'reporte' && ' (reportée)'}
              </p>
            </>
          ) : (
            <p className="pt-next-what">{daySummary(p, doses)}</p>
          )}
          <button className="pt-btn pt-btn-ghost pt-wide" onClick={listen}>
            <Icon name="speaker" size="1.1em" /> Ma journée
          </button>
        </section>
      )}

      {mode === 'standard' && <DayList doses={doses} />}

      <footer className="pt-day" aria-label="Ma journée">
        {LIDS.map((l) => {
          const items = doses.filter((d) => lidOf(d.time) === l.id)
          if (!items.length) return null
          const ok = items.every((d) => d.status === 'pris')
          return (
            <span key={l.id} className={cx('pt-day-dot', ok && 'is-ok')} style={{ ['--tone' as string]: l.tone }}>
              {ok ? <Icon name="check" size="0.9em" stroke={3} /> : null}
              <small>{l.label}</small>
            </span>
          )
        })}
      </footer>
    </div>
  )
}

function VoiceMode({ pending, next, onTake, onListen, confirm }: { pending: Dose[]; next?: Dose; onTake: () => void; onListen: () => void; confirm: boolean }) {
  return (
    <section className="pt-voice">
      <p className="pt-voice-hint">
        {pending.length ? `${pending.length} médicament${pending.length > 1 ? 's' : ''} à prendre` : next ? `Prochaine prise à ${hhmm(next.time)}` : 'Journée terminée'}
      </p>
      <button className="pt-zone pt-zone-repeat" onClick={onListen}>
        <Icon name="speaker" size="2.2em" />
        Répéter
      </button>
      <button className={cx('pt-zone pt-zone-take', confirm && 'is-confirm')} onClick={onTake} disabled={!pending.length}>
        <Icon name="check" size="2.2em" stroke={3} />
        {confirm ? 'Encore une fois' : 'C’est pris'}
      </button>
    </section>
  )
}

function GlucoseEntry({ dose }: { dose: Dose }) {
  const { state, now, dispatch } = useStore()
  const [v, setV] = useState(1.3)
  const units = unitsForGlucose(dose.med, v)
  const submit = () => {
    dispatch({ type: 'glucose', reading: { id: `g-${now}`, at: new Date(now).toISOString(), value: v, doseKey: dose.key, by: 'patient' } })
    speak(glucoseAdvice(state.patient, state.settings, dose.med, v), state.patient.voiceRate)
  }
  return (
    <div className="pt-gly">
      <p className="pt-gly-label">Ma glycémie</p>
      <div className="pt-gly-row">
        <button className="pt-step" onClick={() => setV((x) => Math.max(0.3, Math.round((x - 0.05) * 100) / 100))} aria-label="Moins">
          −
        </button>
        <output>{v.toFixed(2).replace('.', ',')}</output>
        <button className="pt-step" onClick={() => setV((x) => Math.min(4, Math.round((x + 0.05) * 100) / 100))} aria-label="Plus">
          +
        </button>
      </div>
      <p className="pt-gly-unit">g/L {units !== null && <>· {units} unités à injecter</>}</p>
      <button className="pt-take" onClick={submit}>
        Valider la mesure
      </button>
    </div>
  )
}

function DayList({ doses }: { doses: Dose[] }) {
  const { now, dispatch } = useStore()
  return (
    <ul className="pt-list">
      {doses.map((d) => (
        <li key={d.key} data-status={d.status}>
          <label>
            <input
              type="checkbox"
              checked={d.status === 'pris'}
              onChange={(e) => dispatch(e.target.checked ? { type: 'take', doseKey: d.key, by: 'patient', at: now } : { type: 'untake', doseKey: d.key })}
            />
            <span className="pt-list-time">{hhmm(d.time)}</span>
            <span className="pt-list-name">{d.med.name}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
