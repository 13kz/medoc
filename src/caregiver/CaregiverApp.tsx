import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Pill } from '../components/Pill'
import { useNow } from '../lib/clock'
import { systemNotify, vibrate } from '../lib/platform'
import { MOMENTS, dosesForDay, formatDuration, formatTime, momentOf, nextUpcoming, spokenTime } from '../lib/schedule'
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
  const lastAlert = useRef(state.alerts[0]?.id)

  const doses = dosesForDay(state, now)
  const unread = state.alerts.filter((a) => !a.read).length
  const done = doses.filter((d) => d.status === 'pris').length
  const late = doses.filter((d) => d.status === 'en-retard')
  const next = nextUpcoming(doses)
  const activeMeds = state.medications.filter((m) => m.active).length

  // Bandeau façon notification push quand une nouvelle alerte arrive.
  useEffect(() => {
    const latest = state.alerts[0]
    if (!latest || latest.id === lastAlert.current) return
    lastAlert.current = latest.id
    setBanner(latest.message)
    vibrate()
    systemNotify('Medoc', latest.message)
    const id = setTimeout(() => setBanner(null), 6000)
    return () => clearTimeout(id)
  }, [state.alerts])

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
            <span className="cg-banner-app">Medoc · maintenant</span>
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
            {MODE_LABEL[state.patient.displayMode]} · {activeMeds} médicament{activeMeds > 1 ? 's' : ''}
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
            <div className="cg-hero">
              <div className="cg-ring" style={{ '--p': doses.length ? done / doses.length : 0 } as CSSProperties}>
                <span>
                  <strong>{done}</strong>/{doses.length}
                </span>
              </div>
              <div className="cg-hero-text">
                <p className="cg-hero-title">{done === doses.length && doses.length > 0 ? 'Tout est pris' : 'prises faites aujourd’hui'}</p>
                <p>
                  {next
                    ? `Prochaine : ${spokenTime(next.time)}, ${next.med.name} (dans ${formatDuration(next.at - now)})`
                    : 'Plus rien de prévu aujourd’hui'}
                </p>
              </div>
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

            {MOMENTS.map((m) => {
              const items = doses.filter((d) => momentOf(d.time) === m.id)
              if (items.length === 0) return null
              return (
                <div key={m.id} className="cg-moment">
                  <h2>
                    <Icon name={m.icon} size={18} />
                    {m.label}
                  </h2>
                  <ul className="cg-list">
                    {items.map((d) => (
                      <li key={d.key} className={`cg-dose st-${d.status}`}>
                        <span className="cg-time">{d.time}</span>
                        <Pill med={d.med} size="sm" />
                        <span className="cg-dose-text">
                          <strong>{d.med.name}</strong>
                          <span className="cg-meta">
                            {d.med.dose}
                            {d.intake && ` · ${d.intake.by === 'patient' ? 'confirmé' : 'validé par vous'} à ${formatTime(Date.parse(d.intake.takenAt))}`}
                            {d.status === 'reporte' && d.snoozedUntil && ` · rappel à ${formatTime(d.snoozedUntil)}`}
                          </span>
                          <span className={`chip st-${d.status}`}>{STATUS_LABEL[d.status]}</span>
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
                </div>
              )
            })}
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
                        {m.instructions && ` · ${m.instructions}`}
                      </span>
                      <span className="cg-times">
                        {m.active ? (
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
            <h2 className="cg-title">Alertes</h2>
            <p className="cg-help">
              Une alerte part quand une prise a plus de {state.settings.lateAfterMin} minutes de retard. {state.patient.name} reçoit un rappel, et les
              proches qui ont activé les alertes sont prévenus.
            </p>
            <ul className="cg-list">
              {state.alerts.map((a) => (
                <li key={a.id} className="cg-alert">
                  <span className="cg-alert-icon">
                    <Icon name="alert" size={18} stroke={2.4} />
                  </span>
                  <span className="cg-dose-text">
                    <strong>{a.message}</strong>
                    <span className="cg-meta">
                      {formatTime(Date.parse(a.at))} · envoyé à {a.recipients.join(', ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {state.alerts.length === 0 && (
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
