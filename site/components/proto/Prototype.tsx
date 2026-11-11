'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { deliveredAlerts } from '@medoc/lib/alerts'
import { dosesForDay, pendingNow } from '@medoc/lib/schedule'
import { useStore } from '@/lib/store'
import { cx, useMounted } from '@/lib/util'
import { LiveBox } from '../LiveBox'
import { Icon, type IconName } from '../ui/Icon'
import { DemoClock } from './DemoClock'
import { DoctorView } from './DoctorView'
import { FamilyView } from './FamilyView'
import { Feed } from './Feed'
import { PatientView } from './PatientView'

type Role = 'patient' | 'proches' | 'medecin'

const ROLES: { id: Role; name: string; who: string; icon: IconName; sees: string }[] = [
  { id: 'patient', name: 'Patiente', who: 'Mireille, 78 ans', icon: 'user', sees: 'Ce qu’elle doit prendre, maintenant. Rien d’autre.' },
  { id: 'proches', name: 'Proches', who: 'Naz, son fils', icon: 'heart', sees: 'Si tout va bien, et une alerte seulement quand il le faut.' },
  { id: 'medecin', name: 'Médecin', who: 'Dr Martin', icon: 'stethoscope', sees: 'L’observance, les oublis qui se répètent, le traitement.' },
]

function Phone({ children, label, dark }: { children: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <div className={cx('dev dev-phone', dark && 'is-dark')} aria-label={label} role="group">
      <div className="dev-screen">
        <div className="dev-island" />
        {children}
      </div>
    </div>
  )
}

function Tablet({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="dev dev-tablet" aria-label={label} role="group">
      <div className="dev-screen">{children}</div>
    </div>
  )
}

function Device({ role }: { role: Role }) {
  const { state } = useStore()
  if (role === 'patient')
    return (
      <Phone label="Téléphone de la patiente" dark={state.patient.displayMode !== 'standard'}>
        <PatientView />
      </Phone>
    )
  if (role === 'proches')
    return (
      <Phone label="Téléphone du proche">
        <FamilyView />
      </Phone>
    )
  return (
    <Tablet label="Tablette du médecin">
      <DoctorView />
    </Tablet>
  )
}

/** Petit signal sur l'onglet d'un rôle quand quelque chose l'attend. */
function useBadges(): Record<Role, boolean> {
  const { state, now } = useStore()
  const pending = pendingNow(dosesForDay(state, now)).length > 0 || state.notes.some((n) => !n.acknowledged)
  const alert = deliveredAlerts(state, now).some((a) => !a.read)
  return { patient: pending, proches: alert, medecin: false }
}

export function Prototype() {
  const mounted = useMounted()
  const [role, setRole] = useState<Role>('patient')
  const [all, setAll] = useState(false)
  if (!mounted) return <div className="proto-skeleton" aria-hidden="true" />
  return <ProtoInner role={role} setRole={setRole} all={all} setAll={setAll} />
}

function ProtoInner({ role, setRole, all, setAll }: { role: Role; setRole: (r: Role) => void; all: boolean; setAll: (b: boolean) => void }) {
  const badges = useBadges()
  return (
    <div className="proto">
      <div className="proto-sticky">
      <DemoClock />
      <div className="proto-bar">
        <div className="proto-roles" role="tablist" aria-label="Choisir un regard">
          {ROLES.map((r) => (
            <button key={r.id} role="tab" aria-selected={!all && role === r.id} className={cx('proto-role', !all && role === r.id && 'is-on')} data-role={r.id} onClick={() => { setRole(r.id); setAll(false) }}>
              <span className="proto-role-icon">
                <Icon name={r.icon} size={18} />
                {badges[r.id] && <i className="proto-ping" />}
              </span>
              <span className="proto-role-text">
                <strong>{r.name}</strong>
                <small>{r.who}</small>
              </span>
            </button>
          ))}
        </div>
        <button className={cx('proto-all', all && 'is-on')} onClick={() => setAll(!all)}>
          <Icon name="eye" size={16} /> {all ? 'Un écran à la fois' : 'Les trois en même temps'}
        </button>
      </div>
      </div>

      {all ? (
        <div className="proto-all-stage">
          {ROLES.map((r) => (
            <div key={r.id} className="proto-all-col" data-role={r.id}>
              <p className="proto-caption">
                <strong>{r.name}</strong> · {r.sees}
              </p>
              <Device role={r.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="proto-stage" data-role={role}>
          <div className="proto-left">
            <div className="proto-box-wrap">
              <LiveBox className="proto-box" />
              <p className="proto-box-hint">
                Le pilulier de la semaine, relié au dossier. Faites-le tourner, touchez une case. Les couvercles s’ouvrent quand la prise est faite.
              </p>
            </div>
            <Feed />
          </div>
          <div className="proto-right">
            <AnimatePresence mode="wait">
              <motion.div key={role} className="proto-device" data-role={role} initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                <p className="proto-caption">
                  <strong>{ROLES.find((r) => r.id === role)!.who}</strong> voit : {ROLES.find((r) => r.id === role)!.sees}
                </p>
                <Device role={role} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
