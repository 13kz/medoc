import type { AppState, Medication } from './types'

/** Retire (ou rend, si `sign` vaut -1) une prise du stock d'un médicament. */
export function consume(meds: Medication[], medId: string, sign: 1 | -1 = 1): Medication[] {
  return meds.map((m) =>
    m.id === medId && m.stock ? { ...m, stock: { ...m.stock, units: Math.max(0, m.stock.units - sign * m.stock.perDose) } } : m,
  )
}

/** Le médicament d'une clé de dose « jour|médicament|heure ». */
export const medIdOf = (doseKey: string) => doseKey.split('|')[1]

/** Unités consommées en moyenne par jour, selon les heures et le rythme ; null pour un « si besoin ». */
export function unitsPerDay(med: Medication): number | null {
  if (!med.stock || med.asNeeded) return null
  const r = med.rhythm
  const share = !r || r.kind === 'daily' ? 1 : r.kind === 'weekdays' ? r.days.length / 7 : 1 / r.every
  return med.times.length * med.stock.perDose * share
}

/** Jours de traitement restants, arrondis vers le bas ; null si on ne peut pas l'estimer. */
export function daysLeft(med: Medication): number | null {
  const perDay = unitsPerDay(med)
  if (!med.stock || !perDay) return null
  return Math.floor(med.stock.units / perDay)
}

/** Faut-il racheter ? Un « si besoin » est signalé quand il en reste pour moins d'une journée au maximum. */
export function needsRefill(med: Medication, refillDays: number, today?: string): boolean {
  if (!med.active || !med.stock) return false
  // Un traitement qui se termine avant la fin du stock n'a pas besoin d'être racheté.
  const left = daysLeft(med)
  if (med.endDate && today && left !== null) {
    const remaining = Math.round((Date.parse(med.endDate) - Date.parse(today)) / 86400000) + 1
    if (left >= remaining) return false
  }
  if (med.asNeeded) return med.stock.units < med.asNeeded.maxPerDay * med.stock.perDose
  return left !== null && left < refillDays
}

export const refills = (state: AppState, today?: string) => state.medications.filter((m) => needsRefill(m, state.settings.refillDays, today))

/** « Plus que 5 jours », « Plus que 3 comprimés », « Il n'en reste plus ». */
export function stockLabel(med: Medication): string {
  if (!med.stock) return ''
  if (med.stock.units <= 0) return 'Il n’en reste plus'
  const days = daysLeft(med)
  if (days !== null) return days === 0 ? 'Moins d’une journée de stock' : `Encore ${days} jour${days > 1 ? 's' : ''} de stock`
  return `Encore ${med.stock.units} unité${med.stock.units > 1 ? 's' : ''}`
}
