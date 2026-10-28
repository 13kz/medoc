import { formatGlucose } from './glucose'
import { dayKey, dosesOn, formatTime } from './schedule'
import type { AppState, AsNeededIntake, Dose, GlucoseReading, Medication } from './types'

export interface HistoryDay {
  day: string
  /** Midi local de ce jour, pour les calculs et l'affichage. */
  ms: number
  doses: Dose[]
  asNeeded: AsNeededIntake[]
  glucose: GlucoseReading[]
}

/** Les `days` derniers jours, du plus récent au plus ancien. */
export function historyDays(state: AppState, now: number, days = 30): HistoryDay[] {
  const out: HistoryDay[] = []
  for (let ago = 0; ago < days; ago++) {
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    d.setHours(12, 0, 0, 0)
    const day = dayKey(d.getTime())
    out.push({
      day,
      ms: d.getTime(),
      doses: dosesOn(state, d.getTime(), now),
      asNeeded: state.asNeededIntakes.filter((i) => dayKey(Date.parse(i.takenAt)) === day).sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
      glucose: state.glucose.filter((g) => dayKey(Date.parse(g.at)) === day).sort((a, b) => a.at.localeCompare(b.at)),
    })
  }
  return out
}

export interface MedAdherence {
  med: Medication
  taken: number
  /** Prises dues (faites ou oubliées), hors prises à venir. */
  due: number
  /** Prises faites avec plus d'une heure d'écart. */
  late: number
}

/** Observance par médicament à heure fixe sur la période. */
export function adherenceByMed(history: HistoryDay[]): MedAdherence[] {
  const map = new Map<string, MedAdherence>()
  for (const d of history)
    for (const dose of d.doses) {
      if (dose.status !== 'pris' && dose.status !== 'en-retard') continue
      const e = map.get(dose.med.id) ?? { med: dose.med, taken: 0, due: 0, late: 0 }
      e.due++
      if (dose.status === 'pris') {
        e.taken++
        if (dose.intake && Date.parse(dose.intake.takenAt) - dose.at > 3600000) e.late++
      }
      map.set(dose.med.id, e)
    }
  return [...map.values()].sort((a, b) => a.taken / a.due - b.taken / b.due)
}

export function totalAdherence(history: HistoryDay[]): number | null {
  const all = adherenceByMed(history)
  const due = all.reduce((n, a) => n + a.due, 0)
  return due === 0 ? null : all.reduce((n, a) => n + a.taken, 0) / due
}

const STATUS: Record<Dose['status'], string> = {
  pris: 'pris',
  'en-retard': 'oublié',
  'a-prendre': 'à prendre',
  'a-venir': 'à venir',
  reporte: 'reporté',
}

const BY = { patient: 'patient', aidant: 'aidant' }

/** Ligne CSV : séparateur « ; » et guillemets, comme l'attend un tableur réglé en français. */
const row = (cells: (string | number)[]) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')

/** Export CSV du journal, du plus ancien au plus récent. */
export function historyCsv(state: AppState, history: HistoryDay[]): string {
  const name = (id: string) => state.medications.find((m) => m.id === id)?.name ?? id
  const lines = [row(['Date', 'Heure prévue', 'Médicament', 'Dose', 'Statut', 'Pris à', 'Par', 'Remarque'])]
  for (const d of [...history].reverse()) {
    const items: { sort: string; cells: (string | number)[] }[] = []
    for (const dose of d.doses)
      items.push({
        sort: dose.time,
        cells: [
          d.day,
          dose.time,
          dose.med.name,
          dose.med.dose,
          STATUS[dose.status],
          dose.intake ? formatTime(Date.parse(dose.intake.takenAt)) : '',
          dose.intake ? BY[dose.intake.by] : '',
          '',
        ],
      })
    for (const i of d.asNeeded) {
      const t = formatTime(Date.parse(i.takenAt))
      items.push({ sort: t, cells: [d.day, '', name(i.medId), '', 'pris (si besoin)', t, BY[i.by], i.early ? 'trop tôt ou au-delà du maximum' : ''] })
    }
    for (const g of d.glucose) {
      const t = formatTime(Date.parse(g.at))
      items.push({ sort: t, cells: [d.day, '', 'Glycémie', formatGlucose(g.value), 'mesurée', t, BY[g.by], ''] })
    }
    for (const it of items.sort((a, b) => a.sort.localeCompare(b.sort))) lines.push(row(it.cells))
  }
  return lines.join('\r\n') + '\r\n'
}
