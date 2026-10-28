import { glucoseAlertMessage } from './glucose'
import { dayKey, dosesOn, formatTime, spokenTime } from './schedule'
import type { Alert, AlertLevel, AppState, Settings } from './types'

const DAY = 24 * 3600 * 1000

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Si `now` tombe pendant les heures calmes, l'instant où elles se terminent ; sinon null.
 * La plage peut passer minuit (22:30 → 07:00).
 */
export function quietUntil(settings: Settings, now: number): number | null {
  if (!settings.quietHours) return null
  const from = minutesOf(settings.quietFrom)
  const to = minutesOf(settings.quietTo)
  if (from === to) return null
  const d = new Date(now)
  const m = d.getHours() * 60 + d.getMinutes()
  const inside = from < to ? m >= from && m < to : m >= from || m < to
  if (!inside) return null
  const end = new Date(now)
  end.setHours(Math.floor(to / 60), to % 60, 0, 0)
  if (end.getTime() <= now) end.setDate(end.getDate() + 1)
  return end.getTime()
}

export interface AlertPlan {
  create: Alert[]
  /** Alertes dont la prise a fini par être faite. */
  resolve: { id: string; at: string }[]
}

/**
 * Ce que le moteur d'alertes doit faire à l'instant `now` : relancer le patient quand une prise
 * dépasse `lateAfterMin`, prévenir les proches `escalateAfterMin` plus tard (ou au réveil pendant
 * les heures calmes), et clore les alertes des prises faites depuis.
 * Les prises de la veille au soir comptent aussi, pour une prise tardive qui déborde après minuit.
 */
export function planAlerts(state: AppState, now: number): AlertPlan {
  const { settings, patient } = state
  const existing = new Set(state.alerts.map((a) => `${a.level}|${a.doseKey}`))
  const create: Alert[] = []
  const iso = new Date(now).toISOString()
  const notify = state.contacts.filter((c) => c.notify).map((c) => c.name)

  const add = (level: AlertLevel, doseKey: string, message: string, recipients: string[], deliverAt = now) => {
    if (existing.has(`${level}|${doseKey}`)) return
    existing.add(`${level}|${doseKey}`)
    create.push({ id: `${level}|${doseKey}|${now}`, level, at: iso, deliverAt: new Date(deliverAt).toISOString(), doseKey, message, recipients, read: false })
  }

  // Hier : seulement les prises de la soirée (moins de 12 h), pas toute la journée passée.
  const yesterday = dosesOn(state, now - DAY, now).filter((d) => now - d.at < DAY / 2)
  for (const d of [...yesterday, ...dosesOn(state, now, now)]) {
    if (d.status !== 'en-retard') continue
    const planned = `${dayKey(d.at) === dayKey(now) ? '' : 'hier '}à ${spokenTime(d.time)}`
    add('rappel', d.key, `Rappel envoyé à ${patient.name} : ${d.med.name} (prévu ${planned}).`, [patient.name])
    if (notify.length === 0) continue
    const escalateAt = d.at + (settings.lateAfterMin + settings.escalateAfterMin) * 60000
    // Une prise reportée (« plus tard ») n'est pas en retard : l'escalade attend la fin du report.
    if (now < escalateAt) continue
    add('proches', d.key, `${patient.name} n’a pas encore pris ${d.med.name} (prévu ${planned}).`, notify, quietUntil(settings, now) ?? now)
  }

  // Glycémie hors des seuils : les proches sont prévenus aussitôt, même la nuit.
  for (const g of state.glucose) {
    const t = Date.parse(g.at)
    if (t > now || now - t > DAY / 2 || notify.length === 0) continue
    const message = glucoseAlertMessage(state, g)
    if (message) add('proches', `glycemie|${g.id}`, message, notify)
  }

  const resolve = state.alerts
    .filter((a) => !a.resolvedAt && state.intakes[a.doseKey])
    .map((a) => ({ id: a.id, at: state.intakes[a.doseKey].takenAt }))

  return { create, resolve }
}

/** Les alertes que les proches ont reçues à l'instant `now`, les plus récentes d'abord. */
export const deliveredAlerts = (state: AppState, now: number) =>
  state.alerts.filter((a) => a.level === 'proches' && Date.parse(a.deliverAt) <= now)

/** « Maman a pris Metformine 1000 mg à 8 h 42. » */
export function resolvedMessage(state: AppState, alert: Alert): string | null {
  if (!alert.resolvedAt) return null
  const [, medId] = alert.doseKey.split('|')
  const name = state.medications.find((m) => m.id === medId)?.name ?? 'son médicament'
  return `${state.patient.name} a pris ${name} à ${spokenTime(formatTime(Date.parse(alert.resolvedAt)))}.`
}
