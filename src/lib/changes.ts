import { asNeededLabel } from './asNeeded'
import { tv } from './phrases'
import { rhythmLabel, shortDate, spokenTime } from './schedule'
import type { Medication, Patient, TreatmentChange } from './types'

const times = (m: Medication) => (m.asNeeded ? asNeededLabel(m) : [...m.times].sort().map(spokenTime).join(', ') || 'aucune heure')
const period = (m: Medication) =>
  m.startDate || m.endDate
    ? [m.startDate && `du ${shortDate(m.startDate)}`, m.endDate && `jusqu’au ${shortDate(m.endDate)}`].filter(Boolean).join(' ')
    : 'sans fin'
const scale = (m: Medication) =>
  m.glucose ? (m.glucose.scale.length ? m.glucose.scale.map((s) => `${s.max === null ? 'au-delà' : `< ${s.max}`} : ${s.units}`).join(', ') : 'glycémie avant') : 'non'

/** Ce qui compte pour le patient et ses proches ; le stock et la photo n'en font pas partie. */
const FIELDS: { label: string; get: (m: Medication) => string }[] = [
  { label: 'Nom', get: (m) => m.name },
  { label: 'Dose', get: (m) => m.dose },
  { label: 'Heures', get: times },
  { label: 'Jours', get: (m) => (m.asNeeded ? '' : rhythmLabel({ ...m, startDate: undefined, endDate: undefined })) },
  { label: 'Durée', get: period },
  { label: 'Consigne', get: (m) => m.instructions ?? 'aucune' },
  { label: 'Schéma de dose', get: scale },
]

/** Différence entre deux versions d'un médicament ; null si rien d'important n'a changé. */
export function diffMed(before: Medication | undefined, after: Medication | undefined): Pick<TreatmentChange, 'kind' | 'details'> | null {
  if (!before && after) return { kind: 'ajout', details: [`${after.dose}, ${times(after)}`] }
  if (before && !after) return { kind: 'suppression', details: [] }
  if (!before || !after) return null
  if (before.active !== after.active) return { kind: after.active ? 'reprise' : 'arret', details: [] }
  const details = FIELDS.flatMap((f) => {
    const a = f.get(before)
    const b = f.get(after)
    return a === b ? [] : [`${f.label} : ${a} → ${b}`]
  })
  return details.length ? { kind: 'modif', details } : null
}

const VERB: Record<TreatmentChange['kind'], string> = {
  ajout: 'a ajouté',
  modif: 'a modifié',
  arret: 'a arrêté',
  reprise: 'a repris',
  suppression: 'a retiré',
}

/** « Dr Martin a modifié Insuline Lantus » */
export const changeTitle = (c: TreatmentChange) => `${c.by} ${VERB[c.kind]} ${c.medName}`

/** Phrase lue au patient : ce qui change pour lui, avec ses mots. */
export function changeSentence(p: Patient, c: TreatmentChange): string {
  const your = tv(p, 'ton', 'votre')
  switch (c.kind) {
    case 'ajout':
      return `${c.by} a ajouté un médicament : ${c.medName}, ${c.details[0]}.`
    case 'arret':
    case 'suppression':
      return `${c.by} a arrêté ${c.medName}. ${tv(p, 'Tu ne dois plus le prendre', 'Vous ne devez plus le prendre')}.`
    case 'reprise':
      return `${c.by} a remis ${c.medName} dans ${your} traitement.`
    case 'modif': {
      const said = c.details.map((d) => {
        const [label, rest] = d.split(' : ')
        const [from, to] = rest.split(' → ')
        return `${label} : ${to}, au lieu de ${from}`
      })
      return `${c.by} a changé ${c.medName}. ${said.join('. ')}.`
    }
  }
}
