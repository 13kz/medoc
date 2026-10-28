import type { IconName } from '../components/Icon'
import type { AppState, Dose, MedForm, Medication } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Numéro du jour (AAAA-MM-JJ) depuis 1970, insensible aux changements d'heure. */
const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

/** Le médicament est-il à prendre ce jour-là (AAAA-MM-JJ), selon son rythme et sa durée ? */
export function takesOn(med: Medication, day: string): boolean {
  if (med.startDate && day < med.startDate) return false
  if (med.endDate && day > med.endDate) return false
  const r = med.rhythm
  if (!r || r.kind === 'daily') return true
  if (r.kind === 'weekdays') {
    const [y, m, d] = day.split('-').map(Number)
    return r.days.includes(new Date(y, m - 1, d).getDay())
  }
  const diff = dayNumber(day) - dayNumber(r.from)
  return diff >= 0 && diff % Math.max(1, r.every) === 0
}

/** Dernier jour d'un traitement à durée limitée. */
export const isLastDay = (med: Medication, day: string) => med.endDate === day

/** Ajoute `n` jours à une date AAAA-MM-JJ. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n).getTime())
}

const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const DATE_SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

export function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return DATE_SHORT.format(new Date(y, m - 1, d))
}

/** « Tous les jours », « Le lundi et le jeudi », « Un jour sur 2 », suivi de la durée éventuelle. */
export function rhythmLabel(med: Medication): string {
  const r = med.rhythm
  let label: string
  if (!r || r.kind === 'daily') label = 'Tous les jours'
  else if (r.kind === 'weekdays') {
    const days = [...r.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    label =
      days.length === 1
        ? `Le ${WEEKDAY_LONG[days[0]]}`
        : days.length === 7
          ? 'Tous les jours'
          : days.map((d) => WEEKDAY_SHORT[d]).join(', ')
  } else label = r.every === 2 ? 'Un jour sur deux' : `Tous les ${r.every} jours`
  if (med.endDate) label += `, jusqu’au ${shortDate(med.endDate)}`
  else if (med.startDate) label += `, à partir du ${shortDate(med.startDate)}`
  return label
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

/**
 * Les moments de la journée, avec la couleur de couvercle d'un pilulier classique.
 * Ces teintes claires gardent un contraste fort avec du texte noir, sur fond noir comme sur fond clair.
 */
export const MOMENTS: { id: Moment; label: string; icon: IconName; tone: string }[] = [
  { id: 'matin', label: 'Matin', icon: 'sunrise', tone: '#ffd43b' },
  { id: 'midi', label: 'Midi', icon: 'sun', tone: '#ff9f43' },
  { id: 'apres-midi', label: 'Après-midi', icon: 'sun', tone: '#7fd6a4' },
  { id: 'soir', label: 'Soir', icon: 'sunset', tone: '#6cb4ff' },
  { id: 'nuit', label: 'Coucher', icon: 'moon', tone: '#b69cff' },
]

export const momentInfo = (hhmm: string) => MOMENTS.find((m) => m.id === momentOf(hhmm))!

export function momentOf(hhmm: string): Moment {
  const h = Number(hhmm.split(':')[0])
  if (h < 11) return 'matin'
  if (h < 14) return 'midi'
  if (h < 18) return 'apres-midi'
  if (h < 21) return 'soir'
  return 'nuit'
}

export const FORMS: { id: MedForm; label: string }[] = [
  { id: 'comprime', label: 'Comprimé' },
  { id: 'gelule', label: 'Gélule' },
  { id: 'sachet', label: 'Sachet' },
  { id: 'injection', label: 'Injection' },
  { id: 'gouttes', label: 'Gouttes' },
  { id: 'autre', label: 'Autre' },
]

/** Toutes les prises du jour, triées par heure, avec leur statut à l'instant `now`. */
export function dosesForDay(state: AppState, now: number): Dose[] {
  return dosesOn(state, now, now)
}

/** Les prises d'un jour donné (`dayMs`), avec leur statut vu à l'instant `now`. */
export function dosesOn(state: AppState, dayMs: number, now: number): Dose[] {
  const day = dayKey(dayMs)
  const lateMs = state.settings.lateAfterMin * 60000
  const doses: Dose[] = []
  for (const med of state.medications) {
    if (!med.active || med.asNeeded || !takesOn(med, day)) continue
    for (const time of med.times) {
      const key = doseKey(day, med.id, time)
      const at = atTime(dayMs, time)
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

export interface WeekCell {
  moment: Moment
  total: number
  taken: number
  missed: number
}

export interface WeekDay {
  day: number
  label: string
  isToday: boolean
  cells: WeekCell[]
}

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

/** Le semainier des 7 derniers jours : pour chaque jour et chaque moment, ce qui a été pris ou oublié. */
export function weekGrid(state: AppState, now: number): WeekDay[] {
  const days: WeekDay[] = []
  for (let ago = 6; ago >= 0; ago--) {
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    const doses = dosesOn(state, d.getTime(), now)
    days.push({
      day: d.getTime(),
      label: ago === 0 ? 'Auj.' : WEEKDAY.format(d).replace('.', ''),
      isToday: ago === 0,
      cells: MOMENTS.map((m) => {
        const items = doses.filter((x) => momentOf(x.time) === m.id)
        return {
          moment: m.id,
          total: items.length,
          taken: items.filter((x) => x.status === 'pris').length,
          missed: items.filter((x) => x.status === 'en-retard').length,
        }
      }),
    })
  }
  return days
}

/** Part des prises faites parmi celles qui étaient dues, sur la semaine. */
export function adherence(week: WeekDay[]): number | null {
  let taken = 0
  let due = 0
  for (const d of week)
    for (const c of d.cells) {
      taken += c.taken
      due += c.taken + c.missed
    }
  return due === 0 ? null : taken / due
}

/** Les médicaments les plus souvent oubliés sur 7 jours. */
export function missedByMed(state: AppState, now: number): { med: AppState['medications'][number]; time: string; count: number }[] {
  const counts = new Map<string, { med: AppState['medications'][number]; time: string; count: number }>()
  for (let ago = 6; ago >= 0; ago--) {
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    for (const dose of dosesOn(state, d.getTime(), now)) {
      if (dose.status !== 'en-retard') continue
      const k = `${dose.med.id}|${dose.time}`
      const entry = counts.get(k) ?? { med: dose.med, time: dose.time, count: 0 }
      entry.count++
      counts.set(k, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
