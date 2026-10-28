import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Pill } from '../components/Pill'
import { WeekBox } from '../components/WeekBox'
import { deliveredAlerts, resolvedMessage } from '../lib/alerts'
import { asNeededLabel, asNeededMeds, asNeededStatus } from '../lib/asNeeded'
import { refills, stockLabel } from '../lib/stock'
import { useNow } from '../lib/clock'
import { systemNotify, vibrate } from '../lib/platform'
import { MOMENTS, adherence, dayKey, dosesForDay, rhythmLabel, weekGrid, formatDuration, formatTime, momentOf, nextUpcoming, spokenTime } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { DisplayMode, DoseStatus, Medication } from '../lib/types'
import { MedEditor } from './MedEditor'
import { SettingsTab } from './SettingsTab'

type Tab = 'jour' | 'ordonnance' | 'alertes' | 'reglages'

const STATUS_LABEL: Record<DoseStatus, string> = {
  pris: 'Pris',
  'a-venir': 'À venir',
  'a-prendre': 'À prendre',
  reporte: 'Reporté',
  'en-retard': 'En retard',
}

const MODE_LABEL: Record<DisplayMode, string> = {
  voix: 'Voix d’abord',
  malvoyant: 'Gros caractères',
  standard: 'Affichage standard',
}

const TABS: [Tab, IconName, string][] = [
  ['jour', 'list', 'Aujourd’hui'],
  ['ordonnance', 'box', 'Ordonnance'],
  ['alertes', 'bell', 'Alertes'],
  ['reglages', 'settings', 'Réglages'],
]

export function CaregiverApp() {
  const { state, dispatch } = useStore()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('jour')
  const [editing, setEditing] = useState<Medication | 'new' | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const doses = dosesForDay(state, now)
  const alerts = deliveredAlerts(state, now)
  const unread = alerts.filter((a) => !a.read).length
  const lastAlert = useRef(alerts[0]?.id)
  const resolvedSeen = useRef(new Set(alerts.filter((a) => a.resolvedAt).map((a) => a.id)))
  const done = doses.filter((d) => d.status === 'pris').length
  const late = doses.filter((d) => d.status === 'en-retard')
  const next = nextUpcoming(doses)
  const activeMeds = state.medications.filter((m) => m.active).length
  const week = weekGrid(state, now)
  const pctWeek = adherence(week)

  // Bandeau façon notification push quand une alerte arrive, puis quand la prise finit par être faite.
  useEffect(() => {
    let message: string | null = null
    const latest = alerts[0]
    if (latest && latest.id !== lastAlert.current && !latest.resolvedAt) {
      lastAlert.current = latest.id
      message = latest.message
    }
    for (const a of alerts) {
      if (!a.resolvedAt || resolvedSeen.current.has(a.id)) continue
      resolvedSeen.current.add(a.id)
      message ??= resolvedMessage(state, a)
    }
    if (!message) return
    setBanner(message)
    vibrate()
    systemNotify('Medoc', message)
    const id = setTimeout(() => setBanner(null), 6000)
    return () => clearTimeout(id)
  }, [alerts.map((a) => `${a.id}:${a.resolvedAt ?? ''}`).join(',')])

  useEffect(() => {
    if (tab === 'alertes' && unread > 0) dispatch({ type: 'readAlerts' })
  }, [tab, unread, dispatch])

  return (
    <div className="cg">
      {banner && (
        <button
          className="cg-banner"
          role="alert"
          onClick={() => {
            setBanner(null)
            setTab('alertes')
          }}
        >
          <span className="cg-banner-icon">
            <Icon name="alert" size={18} stroke={2.4} />
          </span>
          <span className="cg-banner-text">
            <span className="cg-banner-app">Medoc, maintenant</span>
            <span>{banner}</span>
          </span>
        </button>
      )}

      <header className="cg-head">
        <span className="cg-avatar" aria-hidden="true">
          {state.patient.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="cg-head-text">
          <h1>{state.patient.name}</h1>
          <p>
            {activeMeds} médicament{activeMeds > 1 ? 's' : ''}, affichage {MODE_LABEL[state.patient.displayMode].toLowerCase()}
          </p>
        </div>
        <button className="cg-bell" aria-label={`Alertes${unread ? `, ${unread} non lue${unread > 1 ? 's' : ''}` : ''}`} onClick={() => setTab('alertes')}>
          <Icon name="bell" size={22} />
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </header>

      <div className="cg-content">
        {tab === 'jour' && (
          <section aria-label="Aujourd’hui" className="cg-stack">
            <div className="cg-summary">
              <p className="cg-summary-title">
                {doses.length === 0
                  ? 'Aucune prise aujourd’hui'
                  : done === doses.length
                    ? 'Tout est pris aujourd’hui'
                    : `${done} prise${done > 1 ? 's' : ''} sur ${doses.length} aujourd’hui`}
              </p>
              {next && (
                <p className="cg-summary-next">
                  Prochaine à {spokenTime(next.time)} : {next.med.name}, dans {formatDuration(next.at - now)}
                </p>
              )}
              <ol className="cg-box" aria-label="Pilulier du jour">
                {MOMENTS.map((m) => {
                  const items = doses.filter((d) => momentOf(d.time) === m.id)
                  if (items.length === 0) return null
                  const taken = items.filter((d) => d.status === 'pris').length
                  const isLate = items.some((d) => d.status === 'en-retard')
                  return (
                    <li key={m.id} className={`cg-cell ${taken === items.length ? 'full' : ''} ${isLate ? 'late' : ''}`} style={{ '--lid': m.tone } as CSSProperties}>
                      <span className="cg-cell-lid">
                        <Icon name={taken === items.length ? 'check' : m.icon} size={18} stroke={2.4} />
                      </span>
                      <span className="cg-cell-name">{m.label}</span>
                      <span className="cg-cell-count">
                        {taken}/{items.length}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>

            {late.length > 0 && (
              <div className="cg-notice" role="status">
                <Icon name="alert" size={22} stroke={2.2} />
                <p>
                  <strong>
                    {late.length} prise{late.length > 1 ? 's' : ''} en retard.
                  </strong>{' '}
                  {state.patient.name} a reçu un rappel. Si la prise vous est confirmée par téléphone, validez-la ci-dessous.
                </p>
              </div>
            )}

            {refills(state, dayKey(now)).map((m) => (
              <div key={m.id} className="cg-notice refill" role="status">
                <Icon name="box" size={22} stroke={2.2} />
                <p>
                  <strong>À racheter : {m.name}.</strong> {stockLabel(m)}.
                </p>
                <button className="secondary" onClick={() => dispatch({ type: 'restock', medId: m.id })}>
                  J’ai racheté une boîte
                </button>
              </div>
            ))}

            <ol className="cg-timeline">
              {MOMENTS.map((m) => {
                const items = doses.filter((d) => momentOf(d.time) === m.id)
                if (items.length === 0) return null
                return (
                  <li key={m.id} className="cg-moment" style={{ '--lid': m.tone } as CSSProperties}>
                    <h2>
                      <span className="cg-moment-lid">
                        <Icon name={m.icon} size={16} stroke={2.4} />
                      </span>
                      {m.label}
                    </h2>
                    <ul className="cg-rows">
                      {items.map((d) => (
                        <li key={d.key} className={`cg-dose st-${d.status}`}>
                          <span className="cg-time">{d.time}</span>
                          <Pill med={d.med} size="sm" />
                          <span className="cg-dose-text">
                            <strong>{d.med.name}</strong>
                            <span className="cg-meta">
                              <span className={`cg-state st-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                              {d.intake
                                ? ` à ${formatTime(Date.parse(d.intake.takenAt))}${d.intake.by === 'aidant' ? ', validé par vous' : ''}`
                                : d.status === 'reporte' && d.snoozedUntil
                                  ? `, rappel à ${formatTime(d.snoozedUntil)}`
                                  : `, ${d.med.dose}`}
                            </span>
                          </span>
                          {d.status === 'pris' ? (
                            <button
                              className="cg-act done"
                              aria-label={`Annuler la prise de ${d.med.name}`}
                              title="Annuler"
                              onClick={() => dispatch({ type: 'untake', doseKey: d.key })}
                            >
                              <Icon name="check" size={20} stroke={3} />
                            </button>
                          ) : (
                            <button
                              className="cg-act"
                              aria-label={`Valider la prise de ${d.med.name}`}
                              title="Valider la prise"
                              onClick={() => dispatch({ type: 'take', doseKey: d.key, by: 'aidant', at: now })}
                            >
                              <Icon name="check" size={20} stroke={2.4} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ol>
            {asNeededMeds(state).length > 0 && (
              <section className="cg-prn" aria-label="Si besoin, dernières 24 heures">
                <h2 className="cg-week-title">Si besoin, dernières 24 h</h2>
                <ul className="cg-rows">
                  {asNeededMeds(state).map((m) => {
                    const st = asNeededStatus(state, m, now)
                    return (
                      <li key={m.id} className="cg-dose">
                        <Pill med={m} size="sm" />
                        <span className="cg-dose-text">
                          <strong>{m.name}</strong>
                          <span className="cg-meta">
                            {st.recent.length === 0
                              ? 'Pas pris'
                              : `${st.recent.length} fois : ${st.recent
                                  .map((i) => `${formatTime(Date.parse(i.takenAt))}${i.by === 'aidant' ? ' (vous)' : ''}`)
                                  .reverse()
                                  .join(', ')}`}
                          </span>
                          {st.recent.some((i) => i.early) && (
                            <span className="cg-meta cg-warn">Pris au moins une fois trop tôt ou au-delà du maximum.</span>
                          )}
                        </span>
                        <button
                          className="cg-act"
                          aria-label={`Noter une prise de ${m.name}`}
                          title="Noter une prise"
                          onClick={() =>
                            dispatch({
                              type: 'takeAsNeeded',
                              intake: { id: `${m.id}|${now}`, medId: m.id, takenAt: new Date(now).toISOString(), by: 'aidant', early: !st.allowed },
                            })
                          }
                        >
                          <Icon name="plus" size={20} stroke={2.4} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            <section className="cg-week" aria-label="Cette semaine">
              <h2 className="cg-week-title">
                Cette semaine
                <span>{pctWeek === null ? '' : `${Math.round(pctWeek * 100)} % des prises faites`}</span>
              </h2>
              <WeekBox week={week} caption={`Semainier de ${state.patient.name} sur 7 jours`} />
            </section>
            {doses.length === 0 && <p className="cg-empty">Aucune prise prévue. Ajoutez des médicaments dans l’ordonnance.</p>}
          </section>
        )}

        {tab === 'ordonnance' && (
          <section aria-label="Ordonnance" className="cg-stack">
            <div className="cg-section-head">
              <h2>Ordonnance</h2>
              <button className="primary" onClick={() => setEditing('new')}>
                <Icon name="plus" size={18} stroke={2.6} />
                Ajouter
              </button>
            </div>
            <ul className="cg-list">
              {state.medications.map((m) => (
                <li key={m.id} className={`cg-med ${m.active ? '' : 'inactive'}`}>
                  <button className="cg-med-btn" onClick={() => setEditing(m)}>
                    <Pill med={m} size="md" />
                    <span className="cg-dose-text">
                      <strong>{m.name}</strong>
                      <span className="cg-meta">
                        {m.dose}
                        {m.instructions && `, ${m.instructions.charAt(0).toLowerCase()}${m.instructions.slice(1)}`}
                      </span>
                      {m.active && <span className="cg-meta">{m.asNeeded ? asNeededLabel(m) : rhythmLabel(m)}</span>}
                      {m.active && m.stock && (
                        <span className={`cg-meta ${refills(state, dayKey(now)).includes(m) ? 'cg-warn' : ''}`}>{stockLabel(m)}</span>
                      )}
                      <span className="cg-times">
                        {m.asNeeded ? null : m.active ? (
                          [...m.times].sort().map((t) => (
                            <span key={t} className="time-chip">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="time-chip off">Suspendu</span>
                        )}
                      </span>
                    </span>
                    <Icon name="chevron" size={18} className="cg-chev" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'alertes' && (
          <section aria-label="Alertes" className="cg-stack">
            <h2 className="cg-title">Alertes et messages</h2>
            {state.notes.length > 0 && (
              <ul className="cg-list cg-notes">
                {state.notes.map((n) => (
                  <li key={n.id} className="cg-note">
                    <span className="cg-note-icon">
                      <Icon name="stethoscope" size={18} stroke={2.2} />
                    </span>
                    <span className="cg-dose-text">
                      <strong>{n.from}</strong>
                      <span>{n.text}</span>
                      <span className="cg-meta">
                        {formatTime(Date.parse(n.at))}, {n.acknowledged ? `${state.patient.name} l’a lu` : `pas encore lu par ${state.patient.name}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="cg-help">
              Après {state.settings.lateAfterMin} minutes de retard, le téléphone de {state.patient.name} relance. Sans réponse{' '}
              {state.settings.escalateAfterMin} minutes plus tard, les proches qui ont activé les alertes sont prévenus
              {state.settings.quietHours && `, sauf entre ${spokenTime(state.settings.quietFrom)} et ${spokenTime(state.settings.quietTo)} : l’alerte attend le matin`}.
            </p>
            <ul className="cg-list">
              {alerts.map((a) => (
                <li key={a.id} className={`cg-alert ${a.resolvedAt ? 'resolved' : ''}`}>
                  <span className="cg-alert-icon">
                    <Icon name={a.resolvedAt ? 'check' : 'alert'} size={18} stroke={2.4} />
                  </span>
                  <span className="cg-dose-text">
                    <strong>{a.resolvedAt ? resolvedMessage(state, a) : a.message}</strong>
                    <span className="cg-meta">
                      {a.resolvedAt && `${a.message} `}
                      {formatTime(Date.parse(a.deliverAt))}, envoyée à {a.recipients.join(', ')}
                      {a.deliverAt !== a.at && ` (retenue pendant la nuit depuis ${formatTime(Date.parse(a.at))})`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {alerts.length === 0 && (
              <div className="cg-empty">
                <Icon name="bell" size={28} />
                <p>Aucune alerte pour l’instant. Tout va bien.</p>
              </div>
            )}
          </section>
        )}

        {tab === 'reglages' && <SettingsTab />}
      </div>

      <nav className="cg-tabs" aria-label="Sections">
        {TABS.map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <span className="cg-tab-icon">
              <Icon name={icon} size={22} stroke={tab === id ? 2.4 : 1.9} />
              {id === 'alertes' && unread > 0 && <span className="badge">{unread}</span>}
            </span>
            {label}
          </button>
        ))}
      </nav>

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
