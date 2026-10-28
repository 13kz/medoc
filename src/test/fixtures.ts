import { seedState } from '../lib/seed'
import type { AppState, Medication } from '../lib/types'

/** Un instant local lisible : `at('2026-03-10 08:05')`. */
export const at = (s: string) => new Date(s.replace(' ', 'T')).getTime()

export function med(patch: Partial<Medication> & { id: string }): Medication {
  return { name: patch.id, form: 'comprime', dose: '1 comprimé', times: ['08:00'], color: '#ffffff', active: true, ...patch }
}

/** État minimal et déterministe : pas d'historique, horloge réelle. */
export function makeState(patch: Partial<AppState> = {}): AppState {
  const base = seedState()
  return {
    ...base,
    medications: [],
    intakes: {},
    snoozes: {},
    alerts: [],
    notes: [],
    clock: { offsetMs: 0, speed: 1, anchorMs: 0 },
    ...patch,
  }
}
