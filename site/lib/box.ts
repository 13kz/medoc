import { dosesOn, momentOf, type Moment } from '@medoc/lib/schedule'
import type { AppState, Dose } from '@medoc/lib/types'

/** Les quatre couvercles d'un pilulier classique. L'après-midi rejoint le midi. */
export const LIDS: { id: Moment; label: string; short: string; tone: string; deep: string }[] = [
  { id: 'matin', label: 'Matin', short: 'Ma', tone: '#ffd43b', deep: '#c99a00' },
  { id: 'midi', label: 'Midi', short: 'Mi', tone: '#ff9f43', deep: '#c96a10' },
  { id: 'soir', label: 'Soir', short: 'So', tone: '#6cb4ff', deep: '#2f78c9' },
  { id: 'nuit', label: 'Coucher', short: 'Co', tone: '#b69cff', deep: '#7754d6' },
]

export const lidOf = (hhmm: string): Moment => {
  const m = momentOf(hhmm)
  return m === 'apres-midi' ? 'midi' : m
}

export type CellState = 'vide' | 'pris' | 'a-venir' | 'maintenant' | 'oublie' | 'partiel'

export interface BoxCell {
  lid: Moment
  doses: Dose[]
  state: CellState
}

export interface BoxDay {
  day: number
  letter: string
  label: string
  isToday: boolean
  cells: BoxCell[]
}

const LETTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' })
const LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric' })

function cellState(doses: Dose[]): CellState {
  if (doses.length === 0) return 'vide'
  if (doses.every((d) => d.status === 'pris')) return 'pris'
  if (doses.some((d) => d.status === 'a-prendre' || d.status === 'reporte')) return 'maintenant'
  if (doses.some((d) => d.status === 'en-retard')) return 'oublie'
  if (doses.some((d) => d.status === 'pris')) return 'partiel'
  return 'a-venir'
}

/** Le pilulier de la semaine : six jours passés, aujourd'hui en dernier. */
export function boxWeek(state: AppState, now: number): BoxDay[] {
  const out: BoxDay[] = []
  for (let ago = 6; ago >= 0; ago--) {
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    const doses = dosesOn(state, d.getTime(), now)
    out.push({
      day: d.getTime(),
      letter: LETTER.format(d).toUpperCase(),
      label: ago === 0 ? 'Aujourd’hui' : LABEL.format(d),
      isToday: ago === 0,
      cells: LIDS.map((l) => {
        const items = doses.filter((x) => lidOf(x.time) === l.id)
        return { lid: l.id, doses: items, state: cellState(items) }
      }),
    })
  }
  return out
}
