import { useEffect, useState } from 'react'
import { CaregiverApp } from './caregiver/CaregiverApp'
import { DemoClock } from './components/DemoClock'
import { DeviceFrame } from './components/DeviceFrame'
import { useNow } from './lib/clock'
import { dosesForDay, spokenTime } from './lib/schedule'
import { StoreProvider, useStore } from './lib/store'
import { PatientApp } from './patient/PatientApp'

type View = 'patient' | 'aidant' | 'both'

const VIEW_KEY = 'medoc:view'

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'patient' || v === 'aidant' || v === 'both') return v
  } catch {
    // Pas de stockage : vue par défaut.
  }
  return 'patient'
}

/** Crée une alerte pour chaque prise passée en retard, destinée au patient et à ses proches. */
function AlertEngine() {
  const { state, dispatch } = useStore()
  const now = useNow()
  useEffect(() => {
    for (const d of dosesForDay(state, now)) {
      if (d.status !== 'en-retard' || state.alerts.some((a) => a.doseKey === d.key)) continue
      const recipients = [state.patient.name, ...state.contacts.filter((c) => c.notify).map((c) => c.name)]
      dispatch({
        type: 'addAlert',
        alert: {
          id: `${d.key}|${now}`,
          at: new Date(now).toISOString(),
          doseKey: d.key,
          message: `${state.patient.name} n’a pas encore pris ${d.med.name} (prévu à ${spokenTime(d.time)}).`,
          recipients,
          read: false,
        },
      })
    }
  }, [state, now, dispatch])
  return null
}

function Shell() {
  const { state } = useStore()
  const [view, setView] = useState<View>(readView)
  const [clockOpen, setClockOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Ignoré.
    }
  }, [view])

  const unread = state.alerts.filter((a) => !a.read).length

  return (
    <div className={`shell view-${view}`}>
      <AlertEngine />
      <header className="shell-bar">
        <div className="shell-brand">
          <span className="shell-logo" aria-hidden>
            💊
          </span>
          <div>
            <strong>Medoc</strong>
            <span className="shell-sub">Prototype</span>
          </div>
        </div>
        <nav className="switcher" aria-label="Choisir le téléphone">
          <button aria-pressed={view === 'patient'} onClick={() => setView('patient')}>
            <span aria-hidden>👵</span> Téléphone de {state.patient.name}
          </button>
          <button aria-pressed={view === 'aidant'} onClick={() => setView('aidant')}>
            <span aria-hidden>🧑</span> Téléphone de l’aidant
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button className="only-wide" aria-pressed={view === 'both'} onClick={() => setView('both')}>
            Les deux
          </button>
        </nav>
        <button className="clock-toggle only-narrow" onClick={() => setClockOpen((o) => !o)} aria-expanded={clockOpen}>
          ⏱ Démo
        </button>
      </header>

      <main className="stage">
        <aside className={`side ${clockOpen ? 'open' : ''}`}>
          <DemoClock />
          <section className="side-card about">
            <h2>Comment tester</h2>
            <ol>
              <li>Sur le téléphone de {state.patient.name}, touchez l’écran pour activer la voix.</li>
              <li>Avancez l’horloge : à 8 h, le téléphone sonne et lit les médicaments.</li>
              <li>Touchez « J’ai pris », ou laissez passer 30 min pour déclencher l’alerte.</li>
              <li>Basculez sur le téléphone de l’aidant pour voir le suivi et modifier l’ordonnance.</li>
            </ol>
            <p className="muted">Ordonnance fictive. Les données restent dans ce navigateur.</p>
          </section>
        </aside>

        <div className="devices">
          <DeviceFrame label={`Téléphone de ${state.patient.name}`} hidden={view === 'aidant'} variant={`patient-${state.patient.displayMode}`}>
            <PatientApp />
          </DeviceFrame>
          <DeviceFrame label="Téléphone de l’aidant" hidden={view === 'patient'} variant="aidant">
            <CaregiverApp />
          </DeviceFrame>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
