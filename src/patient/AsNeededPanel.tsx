import { ConfirmButton } from '../components/ConfirmButton'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { asNeededMeds, asNeededStatus } from '../lib/asNeeded'
import { formatTime, spokenTime } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { Medication } from '../lib/types'

/** Les médicaments « si besoin » : un bouton par médicament, qui dit s'il est trop tôt. */
export function AsNeededPanel({ now, onTake }: { now: number; onTake: (med: Medication, early: boolean) => void }) {
  const { state } = useStore()
  const meds = asNeededMeds(state)
  if (meds.length === 0) return null
  return (
    <section className="p-prn" aria-label="Médicaments si besoin">
      <h2 className="p-prn-title">Si besoin</h2>
      <ul>
        {meds.map((med) => {
          const st = asNeededStatus(state, med, now)
          return (
            <li key={med.id} className={`p-prn-item ${st.allowed ? '' : 'wait'}`}>
              <div className="p-prn-head">
                <Pill med={med} size="md" />
                <div>
                  <p className="p-prn-name">{med.name}</p>
                  <p className="p-prn-meta">
                    {st.last ? `Dernier à ${spokenTime(formatTime(Date.parse(st.last.takenAt)))}` : med.instructions ?? med.dose}
                    {!st.allowed && st.nextAt && `. Pas avant ${spokenTime(formatTime(st.nextAt))}`}
                  </p>
                </div>
              </div>
              {st.allowed ? (
                <button className="p-btn p-sec" onClick={() => onTake(med, false)}>
                  <Icon name="check" size="1.2em" stroke={2.8} />
                  J’en ai pris un
                </button>
              ) : (
                <ConfirmButton className="p-btn p-ghost" confirmLabel="Toucher encore : je l’ai déjà pris" onConfirm={() => onTake(med, true)}>
                  <Icon name="alert" size="1.1em" />
                  Trop tôt pour en reprendre
                </ConfirmButton>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
