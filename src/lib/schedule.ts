import type { AppState, Dose, MedForm } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function doseKey(day: string, medId: string, time: string): string {
  return `${day}|${medId}|${time}`
}

function atTime(ms: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(ms)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** « 8 h », « 12 h 30 » : forme naturelle pour l'affichage et la voix. */
export function spokenTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return m === 0 ? `${h} h` : `${h} h ${pad(m)}`
}

export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h} h` : `${h} h ${pad(rest)}`
}

export type Moment = 'matin' | 'midi' | 'apres-midi' | 'soir' | 'nuit'

export const MOMENTS: { id: Moment; label: string; icon: string }[] = [
  { id: 'matin', label: 'Matin', icon: '🌅' },
  { id: 'midi', label: 'Midi', icon: '☀️' },
  { id: 'apres-midi', label: 'Après-midi', icon: '🌤️' },
  { id: 'soir', label: 'Soir', icon: '🌇' },
  { id: 'nuit', label: 'Coucher', icon: '🌙' },
]

export function momentOf(hhmm: string): Moment {
  const h = Number(hhmm.split(':')[0])
  if (h < 11) return 'matin'
  if (h < 14) return 'midi'
  if (h < 18) return 'apres-midi'
  if (h < 21) return 'soir'
  return 'nuit'
}

export const FORMS: { id: MedForm; label: string; icon: string }[] = [
  { id: 'comprime', label: 'Comprimé', icon: '💊' },
  { id: 'gelule', label: 'Gélule', icon: '💊' },
  { id: 'sachet', label: 'Sachet', icon: '🥄' },
  { id: 'injection', label: 'Injection', icon: '💉' },
  { id: 'gouttes', label: 'Gouttes', icon: '💧' },
  { id: 'autre', label: 'Autre', icon: '🩺' },
]

export const formIcon = (form: MedForm) => FORMS.find((f) => f.id === form)?.icon ?? '💊'

/** Toutes les prises du jour, triées par heure, avec leur statut à l'instant `now`. */
export function dosesForDay(state: AppState, now: number): Dose[] {
  const day = dayKey(now)
  const lateMs = state.settings.lateAfterMin * 60000
  const doses: Dose[] = []
  for (const med of state.medications) {
    if (!med.active) continue
    for (const time of med.times) {
      const key = doseKey(day, med.id, time)
      const at = atTime(now, time)
      if (med.since && at < Date.parse(med.since)) continue
      const intake = state.intakes[key]
      const snoozeIso = state.snoozes[key]
      const snoozedUntil = snoozeIso ? Date.parse(snoozeIso) : undefined
      let status: Dose['status']
      if (intake) status = 'pris'
      else if (now < at) status = 'a-venir'
      else if (snoozedUntil && now < snoozedUntil) status = 'reporte'
      else if (now >= at + lateMs) status = 'en-retard'
      else status = 'a-prendre'
      doses.push({ key, med, time, at, status, intake, snoozedUntil })
    }
  }
  return doses.sort((a, b) => a.at - b.at || a.med.name.localeCompare(b.med.name))
}

/** Les prises à faire tout de suite (reportées exclues), les plus anciennes d'abord. */
export const pendingNow = (doses: Dose[]) =>
  doses.filter((d) => d.status === 'a-prendre' || d.status === 'en-retard')

export const nextUpcoming = (doses: Dose[]) =>
  doses.find((d) => d.status === 'a-venir' || d.status === 'reporte')
