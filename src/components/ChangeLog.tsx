import { changeTitle } from '../lib/changes'
import type { TreatmentChange } from '../lib/types'

const CHANGE_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** Journal des changements de l'ordonnance, chez l'aidant et le médecin. */
export function ChangeLog({ changes }: { changes: TreatmentChange[] }) {
  if (changes.length === 0) return null
  return (
    <section className="changelog" aria-label="Derniers changements du traitement">
      <h3>Derniers changements</h3>
      <ul>
        {changes.slice(0, 8).map((c) => (
          <li key={c.id}>
            <strong>{changeTitle(c)}</strong>
            {c.details.map((d) => (
              <span key={d}>{d}</span>
            ))}
            <span className="cl-meta">
              {CHANGE_DATE.format(Date.parse(c.at))}, {c.acknowledged ? 'entendu par le patient' : 'pas encore entendu par le patient'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
