import { tv } from './phrases'
import { addDays, dayKey, dosesOn } from './schedule'
import type { AppState, Dose } from './types'

/**
 * Rappels à programmer à l'avance sur le téléphone (coque mobile), pour qu'ils sonnent même appli
 * fermée ou téléphone verrouillé : un à l'heure de chaque moment de prise, puis un second si rien
 * n'est coché après le délai de retard.
 */
export interface Reminder {
  id: string
  /** Instant de la notification, en ms. */
  at: number
  title: string
  body: string
  /** Les prises que « J'ai pris » cochera. */
  doseKeys: string[]
  /** Durée de « Plus tard », en minutes. */
  snoozeMin: number
}

/** Limite d'iOS : 64 notifications programmées par appli ; on garde une marge. */
export const MAX_REMINDERS = 60

const names = (doses: Dose[]) => doses.map((d) => `${d.med.name} ${d.med.dose}`.trim()).join(', ')

export function upcomingReminders(state: AppState, now: number, days = 3): Reminder[] {
  const { patient, settings } = state
  const lateMs = settings.lateAfterMin * 60000
  const out: Reminder[] = []
  const today = dayKey(now)
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i)
    const [y, m, d] = day.split('-').map(Number)
    // Midi pour viser le bon jour même un jour de changement d'heure.
    const doses = dosesOn(state, new Date(y, m - 1, d, 12).getTime(), now).filter((x) => x.status !== 'pris')
    const groups = new Map<number, Dose[]>()
    for (const x of doses) {
      // Une prise reportée sonne à la fin du report.
      const at = x.snoozedUntil && x.snoozedUntil > x.at ? x.snoozedUntil : x.at
      groups.set(at, [...(groups.get(at) ?? []), x])
    }
    for (const [at, group] of groups) {
      const doseKeys = group.map((x) => x.key)
      const first = {
        title: group.length === 1 ? tv(patient, 'C’est l’heure de ton médicament', 'C’est l’heure de votre médicament') : `${group.length} médicaments à prendre`,
        body: `${names(group)}. ${tv(patient, 'Touche « J’ai pris » quand c’est fait.', 'Touchez « J’ai pris » quand c’est fait.')}`,
      }
      if (at > now) out.push({ id: `prise|${at}`, at, doseKeys, snoozeMin: settings.snoozeMin, ...first })
      const late = at + lateMs
      if (late > now) {
        out.push({
          id: `retard|${at}`,
          at: late,
          doseKeys,
          snoozeMin: settings.snoozeMin,
          title: 'Pas encore pris',
          body: `${names(group)}. ${tv(patient, 'Pense à les prendre maintenant.', 'Pensez à les prendre maintenant.')}`,
        })
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_REMINDERS)
}

/** Empreinte des rappels : on ne reprogramme le téléphone que si elle change. */
export const remindersSignature = (list: Reminder[]) => list.map((r) => `${r.id}:${r.doseKeys.join('+')}`).join(',')
