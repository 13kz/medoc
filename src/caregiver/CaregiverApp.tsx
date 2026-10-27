import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Pill } from '../components/Pill'
import { useNow } from '../lib/clock'
import { vibrate, systemNotify } from '../lib/platform'
import { dosesForDay, formatTime, spokenTime } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Medication } from '../lib/types'
import { MedEditor } from './MedEditor'
import { SettingsTab } from './SettingsTab'

type Tab = 'jour' | 'ordonnance' | 'alertes' | 'reglages'

const STATUS_LABEL: Record<string, string> = {
  pris: 'Pris',
  'a-venir': 'À venir',
  'a-prendre': 'À prendre',
  reporte: 'Reporté',
  'en-retard': 'En retard',
}

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
        <button className="cg-banner" role="alert" onClick={() => { setBanner(null); setTab('alertes') }}>
          <span className="cg-banner-app">⚠️ Medoc · maintenant</span>
          <span>{banner}</span>
        </button>
      )}

      <header className="cg-head">
        <p className="cg-kicker">Suivi de</p>
        <h1>{state.patient.name}</h1>
      </header>

      <div className="cg-content">
        {tab === 'jour' && (
          <section aria-label="Aujourd’hui">
            <div className="cg-summary">
              <div className="cg-ring" style={{ '--p': doses.length ? done / doses.length : 0 } as CSSProperties}>
                <span>
                  {done}/{doses.length}
                </span>
              </div>
              <div>
                <p className="cg-summary-title">prises faites aujourd’hui</p>
                <p className="muted">
                  {doses.some((d) => d.status === 'en-retard')
                    ? `${doses.filter((d) => d.status === 'en-retard').length} en retard`
                    : 'Rien en retard'}
                </p>
              </div>
            </div>
            <ul className="cg-list">
              {doses.map((d) => (
                <li key={d.key} className={`cg-dose st-${d.status}`}>
                  <span className="cg-time">{d.time}</span>
                  <Pill med={d.med} />
                  <span className="cg-dose-text">
                    <strong>{d.med.name}</strong>
                    <span className="muted">
                      {d.med.dose}
                      {d.intake &&
                        ` · ${d.intake.by === 'patient' ? 'confirmé' : 'noté par vous'} à ${formatTime(Date.parse(d.intake.takenAt))}`}
                      {d.status === 'reporte' && d.snoozedUntil && ` · rappel à ${formatTime(d.snoozedUntil)}`}
                    </span>
                  </span>
                  <span className="cg-dose-side">
                  <span className={`chip st-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                  {d.status === 'pris' ? (
                    <button className="ghost small-btn" onClick={() => dispatch({ type: 'untake', doseKey: d.key })}>
                      Annuler
                    </button>
                  ) : (
                    <button
                      className="ghost small-btn"
                      title="Par exemple si elle vous l’a confirmé au téléphone"
                      onClick={() => dispatch({ type: 'take', doseKey: d.key, by: 'aidant', at: now })}
                    >
                      Marquer pris
                    </button>
                  )}
                  </span>
                </li>
              ))}
              {doses.length === 0 && <li className="muted">Aucune prise prévue. Ajoutez des médicaments dans l’ordonnance.</li>}
            </ul>
          </section>
        )}

        {tab === 'ordonnance' && (
          <section aria-label="Ordonnance">
            <button className="primary block" onClick={() => setEditing('new')}>
              + Ajouter un médicament
            </button>
            <ul className="cg-list">
              {state.medications.map((m) => (
                <li key={m.id} className={`cg-med ${m.active ? '' : 'inactive'}`}>
                  <button className="cg-med-btn" onClick={() => setEditing(m)}>
                    <Pill med={m} />
                    <span className="cg-dose-text">
                      <strong>{m.name}</strong>
                      <span className="muted">
                        {m.dose} · {m.times.map(spokenTime).join(', ')}
                        {!m.active && ' · suspendu'}
                      </span>
                      {m.instructions && <span className="muted small">{m.instructions}</span>}
                    </span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'alertes' && (
          <section aria-label="Alertes">
            <p className="muted small">
              Une alerte part quand une prise a plus de {state.settings.lateAfterMin} min de retard. Elle est envoyée à{' '}
              {state.patient.name} et aux proches qui ont les alertes activées.
            </p>
            <ul className="cg-list">
              {state.alerts.map((a) => (
                <li key={a.id} className="cg-alert">
                  <span className="cg-time">{formatTime(Date.parse(a.at))}</span>
                  <span className="cg-dose-text">
                    <strong>{a.message}</strong>
                    <span className="muted small">Envoyé à : {a.recipients.join(', ')}</span>
                  </span>
                </li>
              ))}
              {state.alerts.length === 0 && <li className="muted">Aucune alerte pour le moment.</li>}
            </ul>
          </section>
        )}

        {tab === 'reglages' && <SettingsTab />}
      </div>

      <nav className="cg-tabs" aria-label="Sections">
        {(
          [
            ['jour', '📋', 'Aujourd’hui'],
            ['ordonnance', '💊', 'Ordonnance'],
            ['alertes', '🔔', 'Alertes'],
            ['reglages', '⚙️', 'Réglages'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <span aria-hidden>{icon}</span>
            {label}
            {id === 'alertes' && unread > 0 && <span className="badge">{unread}</span>}
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
