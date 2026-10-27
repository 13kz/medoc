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
import type { Dose, DoseStatus } from '../lib/types'
import { Icon } from '../components/Icon'
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
  const [flash, setFlash] = useState<{ kind: 'ok' | 'later'; text: string; undoKey?: string } | null>(null)
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
    setFlash({ kind: 'ok', text: `${dose.med.name} : c’est noté`, undoKey: dose.key })
    say(afterTake(dose))
  }

  const later = (dose: Dose) => {
    dispatch({ type: 'snooze', doseKey: dose.key, until: now + settings.snoozeMin * 60000 })
    announced.current.delete(dose.key)
    setFlash({ kind: 'later', text: `Rappel dans ${settings.snoozeMin} minutes` })
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

  const moments = MOMENTS.map((m) => {
    const items = doses.filter((d) => momentOf(d.time) === m.id)
    const has = (st: DoseStatus) => items.some((d) => d.status === st)
    const state = items.length === 0 ? null : items.every((d) => d.status === 'pris') ? 'done' : has('en-retard') ? 'late' : has('a-prendre') ? 'now' : 'later'
    return { ...m, items, state }
  }).filter((m) => m.state !== null)

  return (
    <div className={`patient mode-${mode}`}>
      {!unlocked && (
        <button className="unlock" onClick={unlock}>
          <span className="unlock-ring">
            <Icon name="speaker" size="56%" stroke={2.2} />
          </span>
          <span className="unlock-title">{tv(patient, 'Touche l’écran', 'Touchez l’écran')}</span>
          <span className="unlock-sub">pour activer la voix</span>
        </button>
      )}

      <header className="p-head">
        <p className="p-hello">Bonjour {patient.name}</p>
        <p className="p-clock">{formatTime(now)}</p>
        <p className="p-date">{DATE_FMT.format(now)}</p>
      </header>

      {!voiceFirst && moments.length > 0 && (
        <ol className="pillbox" aria-label="Mon pilulier du jour">
          {moments.map((m) => (
            <li key={m.id} className={`pb-cell pb-${m.state}`}>
              <span className="pb-icon">
                <Icon name={m.state === 'done' ? 'check' : m.icon} size="100%" stroke={m.state === 'done' ? 3 : 2} />
              </span>
              <span className="pb-label">{m.label}</span>
              <span className="sr-only">
                {m.state === 'done' ? 'tout est pris' : m.state === 'late' ? 'en retard' : m.state === 'now' ? 'à prendre maintenant' : 'plus tard'}
              </span>
            </li>
          ))}
        </ol>
      )}

      {current ? (
        <section className={`p-now ${current.status === 'en-retard' ? 'late' : 'due'}`} aria-label="Médicament à prendre maintenant">
          <div className="p-now-top">
            <p className="p-kicker">
              <Icon name={current.status === 'en-retard' ? 'alert' : 'bell'} size="1.1em" stroke={2.4} />
              {current.status === 'en-retard' ? 'En retard' : 'C’est l’heure'}
              <span className="p-kicker-time">{spokenTime(current.time)}</span>
            </p>
            {pending.length > 1 && (
              <p className="p-steps" aria-label={`Médicament 1 sur ${pending.length}`}>
                {pending.map((d, i) => (
                  <span key={d.key} className={i === 0 ? 'on' : ''} />
                ))}
              </p>
            )}
          </div>
          <div className="p-med">
            {!voiceFirst && <Pill med={current.med} size="xl" />}
            <h1 className="p-name">{current.med.name}</h1>
            <p className="p-dose">{current.med.dose}</p>
            {current.med.instructions && (
              <p className="p-instr">
                <Icon name="info" size="1.1em" />
                {current.med.instructions}
              </p>
            )}
          </div>
          <div className="p-actions">
            <button className="p-btn p-take" onClick={() => take(current)}>
              <Icon name="check" size="1.3em" stroke={3.2} />
              {voiceFirst ? 'C’est pris' : 'J’ai pris'}
            </button>
            <div className="p-row">
              <button className="p-btn p-sec p-listen" onClick={repeat}>
                <Icon name="speaker" size="1.2em" />
                {voiceFirst ? 'Répéter' : 'Écouter'}
              </button>
              <button className="p-btn p-sec" onClick={() => later(current)}>
                <Icon name="snooze" size="1.2em" />
                Plus tard
              </button>
            </div>
            {canListen() && (
              <button className={`p-btn p-ghost ${listening ? 'on' : ''}`} onClick={listen} aria-pressed={listening}>
                <Icon name="mic" size="1.1em" />
                {listening ? 'J’écoute…' : 'Répondre à voix haute'}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="p-now calm" aria-label="Rien à prendre maintenant">
          <span className="p-ok">
            <Icon name="check" size="55%" stroke={3.2} />
          </span>
          <h1 className="p-name">Rien à prendre maintenant</h1>
          {next ? (
            <div className="p-next">
              <Pill med={next.med} size="md" />
              <div>
                <p className="p-next-when">
                  Prochaine prise à <strong>{spokenTime(next.time)}</strong>
                </p>
                <p className="p-next-what">
                  {next.med.name} · dans {formatDuration(next.at - now)}
                </p>
              </div>
            </div>
          ) : (
            <p className="p-dose">{done > 0 ? 'Tout est pris pour aujourd’hui. Bravo !' : 'Aucun médicament prévu.'}</p>
          )}
          <div className="p-actions">
            <button className="p-btn p-sec p-listen" onClick={() => say(daySummary(patient, doses))}>
              <Icon name="speaker" size="1.2em" />
              Écouter ma journée
            </button>
            {canListen() && (
              <button className={`p-btn p-ghost ${listening ? 'on' : ''}`} onClick={listen} aria-pressed={listening}>
                <Icon name="mic" size="1.1em" />
                {listening ? 'J’écoute…' : 'Poser une question'}
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
              {done} sur {doses.length}
              <Icon name="chevron" size="1em" className={showDay ? 'rot-up' : 'rot-down'} />
            </span>
          </button>
          {showDay && <DayList doses={doses} onTake={take} onUntake={(d) => dispatch({ type: 'untake', doseKey: d.key })} />}
        </section>
      )}

      <div className="p-live" role="status" aria-live="assertive">
        {flash && (
          <div className={`p-flash ${flash.kind}`}>
            <Icon name={flash.kind === 'ok' ? 'check' : 'snooze'} size="1.3em" stroke={3} />
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
              <Icon name={m.icon} size="1.1em" />
              {m.label}
            </h2>
            <ul>
              {items.map((d) => {
                const taken = d.status === 'pris'
                return (
                  <li key={d.key} className={`p-item st-${d.status}`}>
                    <label>
                      <input type="checkbox" checked={taken} onChange={() => (taken ? onUntake(d) : onTake(d))} />
                      <span className="p-check">{taken && <Icon name="check" size="75%" stroke={3.4} />}</span>
                      <span className="p-item-text">
                        <span className="p-item-name">{d.med.name}</span>
                        <span className="p-item-meta">
                          {spokenTime(d.time)} · {d.med.dose}
                          {d.status === 'en-retard' && ' · en retard'}
                          {taken && d.intake && ` · pris à ${formatTime(Date.parse(d.intake.takenAt))}`}
                        </span>
                      </span>
                      <Pill med={d.med} size="sm" />
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
