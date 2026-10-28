import { useEffect, useState } from 'react'
import { CaregiverApp } from './caregiver/CaregiverApp'
import { DemoClock } from './components/DemoClock'
import { DeviceFrame } from './components/DeviceFrame'
import { Icon } from './components/Icon'
import { useNow } from './lib/clock'
import { planAlerts, deliveredAlerts } from './lib/alerts'
import { roleFromLocation, applyRoleManifest, type Role } from './lib/pwa'
import { StoreProvider, useStore } from './lib/store'
import { DoctorApp } from './doctor/DoctorApp'
import { PatientApp } from './patient/PatientApp'

type View = 'patient' | 'aidant' | 'medecin' | 'both'

const VIEW_KEY = 'medoc:view'

// La page autonome (un seul fichier) n'a pas de serveur pour répondre à /patient : on passe par l'ancre.
const roleHref = (role: Role) => (import.meta.env.MODE === 'single' ? `#/${role}` : `/${role}`)

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'patient' || v === 'aidant' || v === 'medecin' || v === 'both') return v
  } catch {
    // Pas de stockage : vue par défaut.
  }
  return 'patient'
}

/** Applique le moteur d'alertes à chaque tic d'horloge : relances, alertes aux proches, alertes closes. */
function AlertEngine() {
  const { state, dispatch } = useStore()
  const now = useNow()
  useEffect(() => {
    const plan = planAlerts(state, now)
    for (const alert of plan.create) dispatch({ type: 'addAlert', alert })
    for (const r of plan.resolve) dispatch({ type: 'resolveAlert', ...r })
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

  const now = useNow()
  const unread = deliveredAlerts(state, now).filter((a) => !a.read).length

  return (
    <div className={`shell view-${view}`}>
      <AlertEngine />
      <header className="shell-bar">
        <div className="shell-brand">
          <span className="shell-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <g transform="rotate(-40 16 16)">
                <path d="M16 9h-5a7 7 0 000 14h5z" fill="currentColor" />
                <path d="M16 9h5a7 7 0 010 14h-5z" fill="none" stroke="currentColor" strokeWidth="2.2" />
              </g>
            </svg>
          </span>
          <div>
            <strong>Medoc</strong>
            <span className="shell-sub">Un appareil par rôle</span>
          </div>
        </div>
        <nav className="switcher" aria-label="Choisir l’appareil">
          <button aria-pressed={view === 'patient'} onClick={() => setView('patient')}>
            <Icon name="phone" size={18} />
            <span>
              <span className="sw-long">Téléphone de </span>
              {state.patient.name}
            </span>
          </button>
          <button aria-pressed={view === 'aidant'} onClick={() => setView('aidant')}>
            <Icon name="user" size={18} />
            <span className="sw-long">Téléphone de l’aidant</span>
            <span className="sw-short">Aidant</span>
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button aria-pressed={view === 'medecin'} onClick={() => setView('medecin')}>
            <Icon name="stethoscope" size={18} />
            <span className="sw-long">Tablette du médecin</span>
            <span className="sw-short">Médecin</span>
          </button>
          <button className="only-wide" aria-pressed={view === 'both'} onClick={() => setView('both')}>
            Patiente et aidant
          </button>
        </nav>
        <button className="clock-toggle only-narrow" onClick={() => setClockOpen((o) => !o)} aria-expanded={clockOpen}>
          <Icon name="snooze" size={18} />
          Horloge
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
              <li>Touchez « J’ai pris », ou laissez passer 30 min : le téléphone relance, puis les proches sont prévenus 30 min plus tard.</li>
              <li>Basculez sur le téléphone de l’aidant pour voir le suivi et modifier l’ordonnance.</li>
              <li>Ouvrez la tablette du médecin : la semaine de chaque patient, et un conseil à envoyer.</li>
            </ol>
            <p className="muted">Ordonnance fictive. Les données restent dans ce navigateur.</p>
            <p className="muted">
              Pour installer un seul rôle sur un téléphone : <a href={roleHref('patient')}>patient</a>,{' '}
              <a href={roleHref('aidant')}>aidant</a>, <a href={roleHref('medecin')}>médecin</a>.
            </p>
          </section>
        </aside>

        <div className="devices">
          <DeviceFrame
            label={`Téléphone de ${state.patient.name}`}
            hidden={view !== 'patient' && view !== 'both'}
            variant={`patient-${state.patient.displayMode}`}
          >
            <PatientApp />
          </DeviceFrame>
          <DeviceFrame label="Téléphone de l’aidant" hidden={view !== 'aidant' && view !== 'both'} variant="aidant">
            <CaregiverApp />
          </DeviceFrame>
          <DeviceFrame label="Tablette du médecin" hidden={view !== 'medecin'} variant="tablet">
            <DoctorApp />
          </DeviceFrame>
        </div>
      </main>
    </div>
  )
}

/** Bandeau discret quand l'appareil ne joint plus le dossier partagé. */
function SyncNotice() {
  const { sync } = useStore()
  if (!sync) return null
  const text = sync.online
    ? ''
    : sync.pending > 0
      ? `Hors ligne. ${sync.pending === 1 ? 'Une action sera envoyée' : `${sync.pending} actions seront envoyées`} au retour du réseau.`
      : 'Hors ligne. Les dernières nouvelles des proches arriveront au retour du réseau.'
  return (
    <p role="status" className={`sync-notice${text ? '' : ' sr-only'}`}>
      {text}
    </p>
  )
}

/** L'appli d'un seul rôle, en plein écran, telle qu'on l'installe sur son téléphone ou sa tablette. */
function Standalone({ role }: { role: Role }) {
  const { state, dispatch } = useStore()
  // Hors démo, l'heure est l'heure réelle.
  useEffect(() => {
    if (state.clock.offsetMs !== 0 || state.clock.speed !== 1) dispatch({ type: 'clockReset', realNow: Date.now() })
  }, [])
  const variant = role === 'patient' ? `patient-${state.patient.displayMode}` : role === 'aidant' ? 'aidant' : 'tablet'
  return (
    <div className={`standalone device-${variant}`}>
      <AlertEngine />
      <SyncNotice />
      <div className="device-glass">
        <div className="device-screen">{role === 'patient' ? <PatientApp /> : role === 'aidant' ? <CaregiverApp /> : <DoctorApp />}</div>
      </div>
    </div>
  )
}

export default function App() {
  const [role, setRole] = useState(roleFromLocation)
  useEffect(() => {
    const onHash = () => setRole(roleFromLocation())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  applyRoleManifest(role)
  return <StoreProvider>{role ? <Standalone role={role} /> : <Shell />}</StoreProvider>
}
