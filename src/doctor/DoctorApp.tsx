import { useState } from 'react'
import { MedEditor } from '../caregiver/MedEditor'
import { asNeededLabel } from '../lib/asNeeded'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { WeekBox } from '../components/WeekBox'
import { useNow } from '../lib/clock'
import { adherence, dosesForDay, formatTime, missedByMed, rhythmLabel, spokenTime, weekGrid, type WeekDay } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Medication } from '../lib/types'
import { SAMPLE_PATIENTS, sampleWeek } from './roster'

const LIVE = 'live'

const ADVICE = [
  'Mettez le collyre juste après le dîner, avant de vous asseoir devant la télévision.',
  'Contrôlez votre glycémie avant chaque injection d’insuline.',
  'Prenez la Metformine au milieu du repas, pas à jeun.',
]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

const pctLabel = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)

/** Couleur de l'observance : bonne au-delà de 90 %, à surveiller de 75 à 90 %, à revoir en dessous. */
const level = (v: number | null) => (v === null ? 'none' : v >= 0.9 ? 'good' : v >= 0.75 ? 'watch' : 'low')

function Spark({ week }: { week: WeekDay[] }) {
  return (
    <span className="dr-spark" aria-hidden="true">
      {week.map((d) => {
        const v = adherence([d])
        return <span key={d.day} className={`lv-${level(v)}`} style={{ height: `${v === null ? 18 : 18 + v * 82}%` }} />
      })}
    </span>
  )
}

export function DoctorApp() {
  const { state, dispatch } = useStore()
  const now = useNow()
  const [selected, setSelected] = useState<string>(LIVE)
  const [showList, setShowList] = useState(true)
  const [editing, setEditing] = useState<Medication | 'new' | null>(null)
  const [draft, setDraft] = useState('')

  const doctorName = state.contacts.find((c) => c.role === 'medecin')?.name ?? 'Dr Martin'
  const liveWeek = weekGrid(state, now)
  const liveAdh = adherence(liveWeek)
  const today = dosesForDay(state, now)
  const lateToday = today.filter((d) => d.status === 'en-retard').length

  const roster = [
    {
      id: LIVE,
      fullName: state.patient.fullName,
      age: state.patient.age,
      conditions: state.patient.conditions,
      week: liveWeek,
      adh: liveAdh,
      flag: lateToday > 0 ? `${lateToday} en retard aujourd’hui` : null,
    },
    ...SAMPLE_PATIENTS.map((p) => {
      const week = sampleWeek(p, now)
      return { id: p.id, fullName: p.fullName, age: p.age, conditions: p.conditions, week, adh: adherence(week), flag: p.attention[0] ?? null }
    }),
  ].sort((a, b) => (a.adh ?? 1) - (b.adh ?? 1))

  const current = roster.find((r) => r.id === selected) ?? roster[0]
  const sample = SAMPLE_PATIENTS.find((p) => p.id === current.id)
  const isLive = current.id === LIVE
  const missed = isLive ? missedByMed(state, now) : []
  const followers = isLive ? state.contacts.filter((c) => c.role !== 'medecin').map((c) => c.name) : sample?.followers ?? []
  // Seuls les oublis répétés méritent une ligne ; les oublis isolés sont regroupés.
  const repeated = missed.filter((m) => m.count >= 2)
  const isolated = missed.length - repeated.length
  const attention = isLive
    ? [
        ...repeated.map((m) => `${m.med.name} de ${spokenTime(m.time)} oublié ${m.count} fois sur 7`),
        ...(isolated > 0 ? [`${isolated} autre${isolated > 1 ? 's' : ''} oubli${isolated > 1 ? 's' : ''} isolé${isolated > 1 ? 's' : ''} dans la semaine`] : []),
      ]
    : (sample?.attention ?? [])
  const toWatch = roster.filter((r) => level(r.adh) !== 'good').length

  const send = (text: string) => {
    if (!text.trim()) return
    dispatch({
      type: 'addNote',
      note: { id: `n-${Date.now().toString(36)}`, at: new Date(now).toISOString(), from: doctorName, text: text.trim(), acknowledged: false },
    })
    setDraft('')
  }

  return (
    <div className={`dr ${showList ? 'dr-show-list' : 'dr-show-detail'}`}>
      <div className="dr-list" role="region" aria-label="Mes patients">
        <header className="dr-list-head">
          <p className="dr-who">{doctorName}</p>
          <h1>Mes patients</h1>
          <p className="dr-sub">
            {roster.length} suivis avec Medoc, {toWatch} à surveiller
          </p>
        </header>
        <ul>
          {roster.map((r) => (
            <li key={r.id}>
              <button
                className="dr-row"
                aria-current={r.id === current.id ? 'true' : undefined}
                onClick={() => {
                  setSelected(r.id)
                  setShowList(false)
                }}
              >
                <span className={`dr-avatar lv-${level(r.adh)}`}>{initials(r.fullName)}</span>
                <span className="dr-row-text">
                  <strong>{r.fullName}</strong>
                  <span>{r.flag ?? r.conditions[0]}</span>
                </span>
                <span className="dr-row-side">
                  <span className={`dr-pct lv-${level(r.adh)}`}>{pctLabel(r.adh)}</span>
                  <Spark week={r.week} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <section className="dr-detail" aria-label={`Dossier de ${current.fullName}`}>
        <button className="dr-back" onClick={() => setShowList(true)}>
          <Icon name="chevron" size={18} className="rot-back" />
          Mes patients
        </button>

        <header className="dr-head">
          <span className={`dr-avatar big lv-${level(current.adh)}`}>{initials(current.fullName)}</span>
          <div>
            <h2>{current.fullName}</h2>
            <p>
              {current.age} ans. {current.conditions.join(', ')}.
            </p>
            {followers.length > 0 && <p className="dr-followers">Proches qui suivent : {followers.join(', ')}</p>}
          </div>
        </header>

        {!isLive && (
          <p className="dr-sample">
            <Icon name="info" size={16} />
            Dossier d’exemple. Seul le dossier de {state.patient.fullName} est relié aux téléphones de la démo.
          </p>
        )}

        <div className="dr-grid">
          <section className="dr-panel dr-adh">
            <div className="dr-adh-top">
              <p className={`dr-big lv-${level(current.adh)}`}>{pctLabel(current.adh)}</p>
              <p className="dr-adh-text">
                des prises faites ces 7 derniers jours
                <span>Plein : tout pris. Croix : oublié. Vide : pas encore l’heure.</span>
              </p>
            </div>
            <WeekBox week={current.week} caption={`Semainier de ${current.fullName} sur 7 jours`} />
          </section>

          <section className="dr-panel">
            <h3>Points d’attention</h3>
            {attention.length > 0 ? (
              <ul className="dr-attn">
                {attention.map((a) => (
                  <li key={a}>
                    <Icon name="alert" size={18} stroke={2.2} />
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dr-calm">
                <Icon name="check" size={18} stroke={2.6} />
                Aucun oubli répété cette semaine.
              </p>
            )}
          </section>

          {isLive && (
            <section className="dr-panel">
              <div className="dr-panel-head">
                <h3>Traitement en cours</h3>
                <button className="dr-primary" onClick={() => setEditing('new')}>
                  <Icon name="plus" size={16} stroke={2.6} />
                  Ajouter
                </button>
              </div>
              <ul className="dr-meds">
                {state.medications.map((m) => (
                  <li key={m.id} className={m.active ? '' : 'inactive'}>
                    <Pill med={m} size="sm" />
                    <span className="dr-med-text">
                      <strong>{m.name}</strong>
                      <span>
                        {m.dose},{' '}
                        {!m.active
                          ? 'suspendu'
                          : m.asNeeded
                            ? asNeededLabel(m).toLowerCase()
                            : `${[...m.times].sort().map(spokenTime).join(' et ')}, ${rhythmLabel(m).toLowerCase()}`}
                      </span>
                    </span>
                    <button className="dr-link" onClick={() => setEditing(m)}>
                      Modifier
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isLive && (
            <section className="dr-panel">
              <h3>Conseil à {state.patient.fullName.split(' ')[0]}</h3>
              <p className="dr-hint">Le message s’affiche sur son téléphone et lui est lu à voix haute. Ses proches le voient aussi.</p>
              <div className="dr-advice">
                {ADVICE.map((a) => (
                  <button key={a} className="dr-chip" onClick={() => setDraft(a)}>
                    {a}
                  </button>
                ))}
              </div>
              <form
                className="dr-compose"
                onSubmit={(e) => {
                  e.preventDefault()
                  send(draft)
                }}
              >
                <label htmlFor="dr-note" className="sr-only">
                  Message
                </label>
                <textarea id="dr-note" rows={3} value={draft} placeholder="Écrire un conseil" onChange={(e) => setDraft(e.target.value)} />
                <button className="dr-primary" type="submit" disabled={!draft.trim()}>
                  Envoyer
                </button>
              </form>
              {state.notes.length > 0 && (
                <ul className="dr-notes">
                  {state.notes.map((n) => (
                    <li key={n.id}>
                      <p>{n.text}</p>
                      <span className={n.acknowledged ? 'ok' : ''}>
                        Envoyé à {formatTime(Date.parse(n.at))}. {n.acknowledged ? 'Lu ou écouté sur son téléphone.' : 'Pas encore lu.'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </section>

      {editing && (
        <MedEditor
          med={editing === 'new' ? undefined : editing}
          now={now}
          onClose={() => setEditing(null)}
          onSave={(med) => {
            dispatch({ type: 'upsertMed', med })
            setEditing(null)
          }}
          onDelete={(id) => {
            dispatch({ type: 'deleteMed', id })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
