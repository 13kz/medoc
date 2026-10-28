import { formatTime, spokenTime } from './schedule'
import { tv } from './phrases'
import type { AppState, Dose, GlucoseReading, Medication, Patient, Settings } from './types'

export type GlucoseLevel = 'hypo' | 'normal' | 'hyper'

export function glucoseLevel(settings: Settings, value: number): GlucoseLevel {
  if (value < settings.hypoBelow) return 'hypo'
  if (value > settings.hyperAbove) return 'hyper'
  return 'normal'
}

/** Nombre d'unités selon le schéma du médecin ; null s'il n'y a pas de schéma. */
export function unitsForGlucose(med: Medication, value: number): number | null {
  const scale = med.glucose?.scale ?? []
  if (scale.length === 0) return null
  const sorted = [...scale].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity))
  return (sorted.find((s) => s.max === null || value < s.max) ?? sorted[sorted.length - 1]).units
}

/** La dose à prendre : celle du schéma si la glycémie est connue, sinon celle de l'ordonnance. */
export function doseText(med: Medication, reading?: GlucoseReading): string {
  const units = reading ? unitsForGlucose(med, reading.value) : null
  return units === null ? med.dose : `${units} unités`
}

export const readingFor = (state: AppState, doseKey: string) => state.glucose.find((g) => g.doseKey === doseKey)

/** La prise attend une glycémie qui n'a pas encore été notée. */
export const needsGlucose = (state: AppState, dose: Dose) => !!dose.med.glucose && !readingFor(state, dose.key)

/** « 1,25 g/L » */
export const formatGlucose = (v: number) => `${v.toFixed(2).replace('.', ',').replace(/0$/, '')} g/L`

/** « 1 gramme 25 » : forme naturelle pour la voix. */
export function spokenGlucose(v: number): string {
  const g = Math.floor(v)
  const c = Math.round((v - g) * 100)
  const grams = g === 0 ? 'zéro gramme' : `${g} gramme${g > 1 ? 's' : ''}`
  return c === 0 ? grams : `${grams} ${c < 10 ? `0${c}` : c}`
}

/**
 * Lit une glycémie tapée ou dictée : « 1,25 », « 1.4 », « 1 gramme 40 », ou en mg/dL (« 125 »).
 * Retourne des g/L, ou null si la valeur n'est pas plausible.
 */
export function parseGlucose(text: string): number | null {
  const words: Record<string, string> = { zéro: '0', un: '1', une: '1', deux: '2', trois: '3', quatre: '4' }
  const t = text
    .toLowerCase()
    .replace(/\b(zéro|une?|deux|trois|quatre)\b(?=\s*(grammes?|virgule))/g, (w) => words[w])
    .replace(/(\d)\s*virgule\s*(\d+)/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim()
  let v: number | null = null
  const grams = t.match(/(\d+)\s*grammes?\s*(\d{1,2})?/)
  if (grams) v = Number(grams[1]) + (grams[2] ? Number(grams[2].padEnd(2, '0')) / 100 : 0)
  else {
    const num = t.match(/\d+(?:[.,]\d+)?/)
    if (num) v = Number(num[0].replace(',', '.'))
  }
  if (v === null || Number.isNaN(v)) return null
  if (v >= 20) v = v / 100
  return v >= 0.2 && v <= 6 ? Math.round(v * 100) / 100 : null
}

/** Ce que le téléphone dit après la mesure. */
export function glucoseAdvice(p: Patient, settings: Settings, med: Medication, value: number): string {
  const level = glucoseLevel(settings, value)
  const said = `${tv(p, 'Ta', 'Votre')} glycémie est de ${spokenGlucose(value)}.`
  const units = unitsForGlucose(med, value)
  const dose = units === null ? '' : ` ${tv(p, 'Injecte', 'Injectez')} ${units} unités.`
  if (level === 'hypo')
    return `${said} C’est bas. ${tv(p, 'Prends', 'Prenez')} du sucre maintenant, comme ${tv(p, 'ton', 'votre')} médecin l’a expliqué. ${tv(p, 'Tes', 'Vos')} proches sont prévenus.${dose}`
  if (level === 'hyper') return `${said} C’est haut. ${tv(p, 'Tes', 'Vos')} proches sont prévenus.${dose}`
  return `${said}${dose}`
}

/** Glycémies des 7 derniers jours, de la plus ancienne à la plus récente. */
export function glucoseWeek(state: AppState, now: number): GlucoseReading[] {
  return state.glucose
    .filter((g) => {
      const t = Date.parse(g.at)
      return t <= now && now - t < 7 * 86400000
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Message d'alerte aux proches pour une glycémie hors des seuils. */
export function glucoseAlertMessage(state: AppState, g: GlucoseReading): string | null {
  const level = glucoseLevel(state.settings, g.value)
  if (level === 'normal') return null
  const label = level === 'hypo' ? 'Glycémie basse' : 'Glycémie haute'
  return `${label} chez ${state.patient.name} : ${formatGlucose(g.value)} à ${spokenTime(formatTime(Date.parse(g.at)))}.`
}
