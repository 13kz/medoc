import { useEffect, useRef, useState } from 'react'
import { useNow } from '../lib/clock'
import { announce, daySummary, describeDose, tv } from '../lib/phrases'
import {
  canListen,
  chime,
  isConfirmation,
  isPostpone,
  listenOnce,
  speak,
  stopSpeaking,
  vibrate,
} from '../lib/platform'
import { MOMENTS, dosesForDay, formatDuration, formatTime, momentOf, nextUpcoming, pendingNow, spokenTime } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Dose } from '../lib/types'
import { Pill } from '../components/Pill'

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export function PatientApp() {
  const { state, dispatch } = useStore()
  const { patient, settings } = state
  const now = useNow()
  const doses = dosesForDay(state, now)
  const pending = pendingNow(doses)
  const next = nextUpcoming(doses)
  const mode = patient.displayMode
  const voiceFirst = mode === 'voix'

  const [unlocked, setUnlocked] = useState(false)
  const [flash, setFlash] = useState<{ text: string; undoKey?: string } | null>(null)
  const [listening, setListening] = useState(false)
  const [showDay, setShowDay] = useState(mode === 'standard')
  const announced = useRef(new Map<string, Dose['status']>())

  const say = (text: string) => speak(text, patient.voiceRate)

  // Annonce sonore et vocale dès qu'une prise devient due, puis à nouveau si elle passe en retard.
  const signature = pending.map((d) => `${d.key}:${d.status}`).join(',')
  useEffect(() => {
    if (!unlocked) return
    const fresh = pending.filter((d) => announced.current.get(d.key) !== d.status)
    for (const d of pending) announced.current.set(d.key, d.status)
    if (fresh.length === 0) return
    chime()
    vibrate()
    if (patient.autoRead || voiceFirst) {
      const late = fresh.every((d) => d.status === 'en-retard')
      const prefix = late ? tv(patient, 'Rappel. Tu n’as pas encore pris tes médicaments. ', 'Rappel. Vous n’avez pas encore pris vos médicaments. ') : ''
      setTimeout(() => say(prefix + announce(patient, pending, now)), 900)
    }
  }, [signature, unlocked])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 4000)
    return () => clearTimeout(id)
  }, [flash])

  useEffect(() => setShowDay(mode === 'standard'), [mode])

  const afterTake = (taken: Dose) => {
    const rest = pending.filter((d) => d.key !== taken.key)
    if (rest.length > 0) return `C’est noté. Ensuite : ${describeDose(rest[0])}`
    if (next) return `C’est noté. Prochaine prise à ${spokenTime(next.time)}.`
    const updated = doses.map((d): Dose => (d.key === taken.key ? { ...d, status: 'pris' } : d))
    return `C’est noté. ${daySummary(patient, updated)}`
  }

  const take = (dose: Dose) => {
    dispatch({ type: 'take', doseKey: dose.key, by: 'patient', at: now })
    vibrate()
    setFlash({ text: `✓ ${dose.med.name} : noté`, undoKey: dose.key })
    say(afterTake(dose))
  }

  const later = (dose: Dose) => {
    dispatch({ type: 'snooze', doseKey: dose.key, until: now + settings.snoozeMin * 60000 })
    announced.current.delete(dose.key)
    setFlash({ text: `⏰ Rappel dans ${settings.snoozeMin} min` })
    say(`D’accord, je ${tv(patient, 'te', 'vous')} le rappelle dans ${settings.snoozeMin} minutes.`)
  }

  const listen = () => {
    if (listening) return
    stopSpeaking()
    setListening(true)
    listenOnce((text) => {
      setListening(false)
      const dose = pending[0]
      if (!text) return say('Je n’ai rien entendu.')
      if (dose && isPostpone(text)) return later(dose)
      if (dose && isConfirmation(text)) return take(dose)
      if (/journ|reste|quoi/i.test(text)) return say(daySummary(patient, doses))
      say(dose ? tv(patient, 'Je n’ai pas compris. Dis : c’est pris, ou : plus tard.', 'Je n’ai pas compris. Dites : c’est pris, ou : plus tard.') : 'Je n’ai pas compris.')
    })
  }

  const repeat = () => say(pending.length ? announce(patient, pending, now) : nothingNow())
  const nothingNow = () =>
    next
      ? `${tv(patient, 'Tu n’as', 'Vous n’avez')} rien à prendre maintenant. Prochaine prise à ${spokenTime(next.time)} : ${next.med.name}.`
      : daySummary(patient, doses)

  const unlock = () => {
    setUnlocked(true)
    chime()
    // Le premier `speak` doit venir d'un geste de l'utilisateur pour être autorisé par le navigateur.
    say(pending.length ? announce(patient, pending, now) : `Bonjour. ${nothingNow()}`)
    for (const d of pending) announced.current.set(d.key, d.status)
  }

  const current = pending[0]
  const done = doses.filter((d) => d.status === 'pris').length

  return (
    <div className={`patient mode-${mode}`}>
      {!unlocked && (
        <button className="unlock" onClick={unlock}>
          <span className="unlock-icon" aria-hidden>
            🔊
          </span>
          <span className="unlock-title">{tv(patient, 'Touche l’écran', 'Touchez l’écran')}</span>
          <span className="unlock-sub">pour activer la voix</span>
        </button>
      )}

      <header className="p-head">
        <p className="p-clock">{formatTime(now)}</p>
        <p className="p-date">{DATE_FMT.format(now)}</p>
      </header>

      {current ? (
        <section className={`p-now ${current.status === 'en-retard' ? 'late' : ''}`} aria-label="Médicament à prendre maintenant">
          <p className="p-kicker">
            {current.status === 'en-retard' ? '⚠️ En retard' : '🔔 C’est l’heure'} · {spokenTime(current.time)}
            {pending.length > 1 && <span className="p-count">1 sur {pending.length}</span>}
          </p>
          {!voiceFirst && <Pill med={current.med} size="xl" />}
          <h1 className="p-name">{current.med.name}</h1>
          <p className="p-dose">{current.med.dose}</p>
          {current.med.instructions && <p className="p-instr">{current.med.instructions}</p>}
          <div className="p-actions">
            <button className="p-btn p-take" onClick={() => take(current)}>
              ✓ {voiceFirst ? 'C’est pris' : 'J’ai pris'}
            </button>
            <button className="p-btn p-listen" onClick={repeat}>
              🔊 {voiceFirst ? 'Répéter' : 'Écouter'}
            </button>
            <div className="p-row">
              <button className="p-btn p-small" onClick={() => later(current)}>
                ⏰ Plus tard
              </button>
              {canListen() && (
                <button className={`p-btn p-small ${listening ? 'on' : ''}`} onClick={listen}>
                  🎤 {listening ? 'J’écoute…' : 'Parler'}
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="p-now calm" aria-label="Rien à prendre maintenant">
          <p className="p-ok" aria-hidden>
            ✓
          </p>
          <h1 className="p-name">Rien à prendre maintenant</h1>
          {next ? (
            <p className="p-dose">
              Prochaine prise à <strong>{spokenTime(next.time)}</strong>
              <br />
              <span className="p-in">dans {formatDuration(next.at - now)}</span>
            </p>
          ) : (
            <p className="p-dose">{done > 0 ? 'Tout est pris pour aujourd’hui. Bravo !' : 'Aucun médicament prévu.'}</p>
          )}
          <div className="p-actions">
            <button className="p-btn p-listen" onClick={() => say(daySummary(patient, doses))}>
              🔊 Écouter ma journée
            </button>
            {canListen() && (
              <button className={`p-btn p-small ${listening ? 'on' : ''}`} onClick={listen}>
                🎤 {listening ? 'J’écoute…' : 'Parler'}
              </button>
            )}
          </div>
        </section>
      )}

      {!voiceFirst && (
        <section className="p-day" aria-label="Ma journée">
          <button className="p-day-toggle" aria-expanded={showDay} onClick={() => setShowDay((s) => !s)}>
            <span>Ma journée</span>
            <span className="p-progress">
              {done} / {doses.length} pris {showDay ? '▲' : '▼'}
            </span>
          </button>
          {showDay && <DayList doses={doses} onTake={take} onUntake={(d) => dispatch({ type: 'untake', doseKey: d.key })} />}
        </section>
      )}
      <div className="p-live" role="status" aria-live="assertive">
        {flash && (
          <div className="p-flash">
            <span>{flash.text}</span>
            {flash.undoKey && (
              <button
                className="p-undo"
                onClick={() => {
                  dispatch({ type: 'untake', doseKey: flash.undoKey! })
                  setFlash(null)
                  say('Annulé.')
                }}
              >
                Annuler
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DayList({ doses, onTake, onUntake }: { doses: Dose[]; onTake: (d: Dose) => void; onUntake: (d: Dose) => void }) {
  return (
    <div className="p-moments">
      {MOMENTS.map((m) => {
        const items = doses.filter((d) => momentOf(d.time) === m.id)
        if (items.length === 0) return null
        return (
          <div key={m.id} className="p-moment">
            <h2>
              <span aria-hidden>{m.icon}</span> {m.label}
            </h2>
            <ul>
              {items.map((d) => {
                const taken = d.status === 'pris'
                return (
                  <li key={d.key} className={`p-item st-${d.status}`}>
                    <label>
                      <input type="checkbox" checked={taken} onChange={() => (taken ? onUntake(d) : onTake(d))} />
                      <span className="p-check" aria-hidden>
                        {taken ? '✓' : ''}
                      </span>
                      <span className="p-item-text">
                        <span className="p-item-name">{d.med.name}</span>
                        <span className="p-item-meta">
                          {spokenTime(d.time)} · {d.med.dose}
                          {d.status === 'en-retard' && ' · en retard'}
                          {taken && d.intake && ` · pris à ${formatTime(Date.parse(d.intake.takenAt))}`}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
