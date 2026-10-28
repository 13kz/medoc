import { dayKey, doseKey } from './schedule'
import type { AppState, GlucoseReading, Intake } from './types'

/** Décalage pour que la démo commence à 7 h 55 aujourd'hui, juste avant la première prise. */
export function offsetTo(hhmm: string, real = Date.now()): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(real)
  d.setHours(h, m, 0, 0)
  return d.getTime() - real
}

/** Ordonnance d'exemple (fictive) pour une personne diabétique de type 2 avec un glaucome. */
export function seedState(): AppState {
  const real = Date.now()
  const state: AppState = {
    version: 6,
    patient: {
      name: 'Maman',
      fullName: 'Mireille Benali',
      age: 78,
      conditions: ['Diabète de type 2', 'Glaucome', 'Hypertension'],
      displayMode: 'malvoyant',
      tutoiement: true,
      autoRead: true,
      voiceRate: 0.9,
      screenReader: false,
      textScale: 1,
    },
    medications: [
      {
        id: 'metformine',
        name: 'Metformine 1000 mg',
        form: 'comprime',
        dose: '1 comprimé',
        times: ['08:00', '19:30'],
        instructions: 'Pendant le repas',
        color: '#f5f5f5',
        active: true,
        stock: { units: 48, perDose: 1, boxSize: 90 },
      },
      {
        id: 'ramipril',
        name: 'Ramipril 5 mg',
        form: 'gelule',
        dose: '1 gélule',
        times: ['08:00'],
        instructions: 'Avec un verre d’eau',
        color: '#f2a33a',
        active: true,
        stock: { units: 5, perDose: 1, boxSize: 30 },
      },
      {
        id: 'kardegic',
        name: 'Kardégic 75 mg',
        form: 'sachet',
        dose: '1 sachet',
        times: ['12:30'],
        instructions: 'Dans un demi-verre d’eau',
        color: '#e8e1cf',
        active: true,
      },
      {
        id: 'atorvastatine',
        name: 'Atorvastatine 20 mg',
        form: 'comprime',
        dose: '1 comprimé',
        times: ['19:30'],
        color: '#ffffff',
        active: true,
      },
      {
        id: 'collyre',
        name: 'Collyre Travatan',
        form: 'gouttes',
        dose: '1 goutte dans chaque œil',
        times: ['21:00'],
        instructions: 'Fermer les yeux 1 minute après',
        color: '#2f8fd8',
        active: true,
      },
      {
        id: 'lantus',
        name: 'Insuline Lantus',
        form: 'injection',
        dose: '14 unités',
        times: ['22:00'],
        instructions: 'Contrôler la glycémie avant',
        color: '#8e5bd6',
        active: true,
        glucose: {
          scale: [
            { max: 1.2, units: 12 },
            { max: 2, units: 14 },
            { max: null, units: 16 },
          ],
        },
      },
      {
        id: 'doliprane',
        name: 'Doliprane 1000 mg',
        form: 'comprime',
        dose: '1 comprimé',
        times: [],
        instructions: 'En cas de douleur',
        color: '#ffffff',
        active: true,
        asNeeded: { maxPerDay: 3, minGapH: 6 },
      },
    ],
    contacts: [
      { id: 'fils', name: 'Naz (fils)', role: 'famille', notify: true },
      { id: 'medecin', name: 'Dr Martin', role: 'medecin', notify: false },
      { id: 'voisine', name: 'Sylvie (voisine)', role: 'tiers', notify: true },
    ],
    settings: { lateAfterMin: 30, escalateAfterMin: 30, snoozeMin: 10, refillDays: 7, hypoBelow: 0.7, hyperAbove: 2.5, quietHours: true, quietFrom: '22:30', quietTo: '07:00' },
    intakes: {},
    asNeededIntakes: [],
    glucose: [],
    snoozes: {},
    alerts: [],
    notes: [],
    changes: [],
    clock: { offsetMs: offsetTo('07:55', real), speed: 1, anchorMs: real },
  }
  // L'ordonnance a commencé il y a six jours : pas d'oublis fictifs avant, dans l'historique sur 30 jours.
  const start = new Date(real + state.clock.offsetMs)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  for (const m of state.medications) m.since = start.toISOString()
  state.intakes = pastWeek(state, real + state.clock.offsetMs)
  state.glucose = pastGlucose(state, real + state.clock.offsetMs)
  return state
}

/**
 * Six jours d'historique fictif, pour que le médecin et l'aidant voient une semaine réaliste :
 * le collyre du soir et l'insuline du coucher sont parfois oubliés, le reste est bien suivi.
 */
function pastWeek(state: AppState, now: number): Record<string, Intake> {
  const missed = new Set(['1|collyre', '3|collyre', '4|collyre', '3|lantus', '5|metformine|19:30', '2|kardegic'])
  const intakes: Record<string, Intake> = {}
  for (let ago = 1; ago <= 6; ago++) {
    const day = new Date(now)
    day.setDate(day.getDate() - ago)
    for (const med of state.medications) {
      for (const time of med.times) {
        if (missed.has(`${ago}|${med.id}`) || missed.has(`${ago}|${med.id}|${time}`)) continue
        const [h, m] = time.split(':').map(Number)
        const at = new Date(day)
        at.setHours(h, m + ((ago * 7 + h) % 23), 0, 0)
        intakes[doseKey(dayKey(day.getTime()), med.id, time)] = { takenAt: at.toISOString(), by: 'patient' }
      }
    }
  }
  return intakes
}

/** Glycémies du soir des six derniers jours, avant l'insuline (sauf le soir où elle a été oubliée), dont une hypoglycémie. */
function pastGlucose(state: AppState, now: number): GlucoseReading[] {
  const values = [1.32, 1.85, 0.94, 0.64, 2.21, 1.48]
  const out: GlucoseReading[] = []
  values.forEach((value, i) => {
    const ago = i + 1
    const day = new Date(now)
    day.setDate(day.getDate() - ago)
    day.setHours(21, 52, 0, 0)
    const key = doseKey(dayKey(day.getTime()), 'lantus', '22:00')
    if (!state.intakes[key]) return
    out.push({ id: `g-${ago}`, at: day.toISOString(), value, doseKey: key, by: 'patient' })
  })
  return out
}
