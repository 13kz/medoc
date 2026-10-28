import { dayKey, formatTime, isLastDay, spokenTime } from './schedule'
import type { Dose, Patient } from './types'

const ORDINALS = ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième']

/** Retourne la forme tutoyée ou vouvoyée selon le profil. */
export const tv = (p: Patient, tu: string, vous: string) => (p.tutoiement ? tu : vous)

export function describeDose(d: Dose): string {
  const last = isLastDay(d.med, dayKey(d.at)) ? 'C’est le dernier jour' : undefined
  return [d.med.name, d.med.dose, d.med.instructions, last].filter(Boolean).join('. ') + '.'
}

export function announce(p: Patient, doses: Dose[], now: number): string {
  const hour = spokenTime(formatTime(now)).replace(' h', ' heures')
  if (doses.length === 0) return `Il est ${hour}. ${tv(p, 'Tu n’as', 'Vous n’avez')} rien à prendre pour le moment.`
  const intro =
    doses.length === 1
      ? `Il est ${hour}. ${tv(p, 'C’est l’heure de ton médicament', 'C’est l’heure de votre médicament')}.`
      : `Il est ${hour}. ${tv(p, 'Tu as', 'Vous avez')} ${doses.length} médicaments à prendre.`
  const list =
    doses.length === 1
      ? describeDose(doses[0])
      : doses.map((d, i) => `${ORDINALS[i] ?? 'Ensuite'} : ${describeDose(d)}`).join(' ')
  const outro = tv(p, 'Quand c’est fait, touche l’écran ou dis : c’est pris.', 'Quand c’est fait, touchez l’écran ou dites : c’est pris.')
  return `${intro} ${list} ${outro}`
}

export function daySummary(p: Patient, doses: Dose[]): string {
  const left = doses.filter((d) => d.status !== 'pris')
  if (left.length === 0) return tv(p, 'Bravo, tu as pris tous tes médicaments aujourd’hui.', 'Bravo, vous avez pris tous vos médicaments aujourd’hui.')
  const parts = left.map((d) => `à ${spokenTime(d.time)}, ${d.med.name}`)
  return `${tv(p, 'Il te reste', 'Il vous reste')} ${left.length} prise${left.length > 1 ? 's' : ''} aujourd’hui : ${parts.join(' ; ')}.`
}
