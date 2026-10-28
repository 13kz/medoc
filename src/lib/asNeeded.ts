import { formatDuration, formatTime, spokenTime } from './schedule'
import { tv } from './phrases'
import type { AppState, AsNeededIntake, Medication, Patient } from './types'

const HOUR = 3600 * 1000

export interface AsNeededStatus {
  /** Prises sur les 24 dernières heures, les plus récentes d'abord. */
  recent: AsNeededIntake[]
  last?: AsNeededIntake
  /** On peut en reprendre maintenant. */
  allowed: boolean
  /** Pourquoi pas encore : écart minimal non atteint, ou maximum sur 24 h atteint. */
  reason?: 'ecart' | 'maximum'
  /** Instant à partir duquel une nouvelle prise est possible. */
  nextAt?: number
}

export const asNeededMeds = (state: AppState) => state.medications.filter((m) => m.active && m.asNeeded)

/** Peut-on reprendre ce médicament « si besoin » à l'instant `now` ? */
export function asNeededStatus(state: AppState, med: Medication, now: number): AsNeededStatus {
  const rule = med.asNeeded ?? { maxPerDay: Infinity, minGapH: 0 }
  const recent = state.asNeededIntakes
    .filter((i) => i.medId === med.id)
    .map((i) => ({ i, t: Date.parse(i.takenAt) }))
    .filter(({ t }) => t <= now && now - t < 24 * HOUR)
    .sort((a, b) => b.t - a.t)
  const last = recent[0]
  const gapAt = last ? last.t + rule.minGapH * HOUR : -Infinity
  // La plus ancienne des prises qui comptent dans le maximum sort de la fenêtre au bout de 24 h.
  const maxAt = recent.length >= rule.maxPerDay ? recent[rule.maxPerDay - 1].t + 24 * HOUR : -Infinity
  const nextAt = Math.max(gapAt, maxAt)
  const allowed = now >= nextAt
  return {
    recent: recent.map((r) => r.i),
    last: last?.i,
    allowed,
    ...(allowed ? {} : { reason: maxAt >= gapAt ? 'maximum' : 'ecart', nextAt }),
  }
}

/** Phrase dite au patient quand il touche « J'ai pris » sur un médicament « si besoin ». */
export function asNeededAdvice(p: Patient, med: Medication, status: AsNeededStatus, now: number): string {
  if (status.allowed) {
    const rule = med.asNeeded
    const after = rule && rule.minGapH > 0 ? ` ${tv(p, 'Tu pourras', 'Vous pourrez')} en reprendre dans ${formatDuration(rule.minGapH * HOUR)} si besoin.` : ''
    return `C’est noté.${after}`
  }
  const wait = formatDuration(status.nextAt! - now)
  if (status.reason === 'maximum')
    return `${tv(p, 'Tu as', 'Vous avez')} déjà pris ${status.recent.length} fois ${med.name} depuis hier à la même heure. C’est le maximum. ${tv(p, 'Attends', 'Attendez')} encore ${wait}.`
  return `Trop tôt. ${tv(p, 'Attends', 'Attendez')} encore ${wait} avant le prochain ${med.name}, à ${spokenTime(formatTime(status.nextAt!))}.`
}

/** « Si besoin, 3 fois par jour au plus, 6 h d'écart » */
export function asNeededLabel(med: Medication): string {
  const a = med.asNeeded
  if (!a) return ''
  const gap = a.minGapH > 0 ? `, ${formatDuration(a.minGapH * HOUR)} d’écart` : ''
  return `Si besoin, ${a.maxPerDay} fois par jour au plus${gap}`
}
