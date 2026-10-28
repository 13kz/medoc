import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { deliveredAlerts, planAlerts, quietUntil, resolvedMessage } from './alerts'
import { reducer } from './store'
import type { AppState } from './types'

const base = (patch: Partial<AppState> = {}) =>
  makeState({
    medications: [med({ id: 'metformine', name: 'Metformine', times: ['08:00', '23:00'], since: new Date(at('2026-03-10 00:00')).toISOString() })],
    contacts: [
      { id: 'fils', name: 'Naz', role: 'famille', notify: true },
      { id: 'dr', name: 'Dr Martin', role: 'medecin', notify: false },
    ],
    ...patch,
    settings: { ...makeState().settings, lateAfterMin: 30, escalateAfterMin: 30, quietHours: true, quietFrom: '22:30', quietTo: '07:00', ...patch.settings },
  })

/** Fait tourner le moteur comme l'appli : on applique le plan à chaque instant. */
function run(state: AppState, ...times: string[]): AppState {
  for (const t of times) {
    const plan = planAlerts(state, at(t))
    for (const alert of plan.create) state = reducer(state, { type: 'addAlert', alert })
    for (const r of plan.resolve) state = reducer(state, { type: 'resolveAlert', ...r })
  }
  return state
}

describe('planAlerts', () => {
  it('rien avant le délai de retard', () => {
    expect(planAlerts(base(), at('2026-03-10 08:29')).create).toEqual([])
  })

  it('relance d’abord le patient, puis prévient les proches qui l’ont choisi', () => {
    let s = run(base(), '2026-03-10 08:30')
    expect(s.alerts.map((a) => [a.level, a.recipients])).toEqual([['rappel', ['Maman']]])
    s = run(s, '2026-03-10 08:45', '2026-03-10 09:00', '2026-03-10 09:10')
    expect(s.alerts.map((a) => [a.level, a.recipients])).toEqual([
      ['proches', ['Naz']],
      ['rappel', ['Maman']],
    ])
    expect(s.alerts[0].message).toBe('Maman n’a pas encore pris Metformine (prévu à 8 h).')
    expect(deliveredAlerts(s, at('2026-03-10 09:00'))).toHaveLength(1)
  })

  it('pas d’alerte aux proches si personne ne l’a activée', () => {
    const s = run(base({ contacts: [] }), '2026-03-10 08:30', '2026-03-10 10:00')
    expect(s.alerts.map((a) => a.level)).toEqual(['rappel'])
  })

  it('un report repousse la relance et l’escalade', () => {
    const s = base({ snoozes: { '2026-03-10|metformine|08:00': new Date(at('2026-03-10 09:30')).toISOString() } })
    expect(run(s, '2026-03-10 09:00').alerts).toEqual([])
  })

  it('clôt les alertes quand la prise est faite', () => {
    let s = run(base(), '2026-03-10 08:30', '2026-03-10 09:00')
    s = reducer(s, { type: 'take', doseKey: '2026-03-10|metformine|08:00', by: 'patient', at: at('2026-03-10 09:12') })
    s = run(s, '2026-03-10 09:13')
    expect(s.alerts.every((a) => a.resolvedAt === new Date(at('2026-03-10 09:12')).toISOString())).toBe(true)
    expect(resolvedMessage(s, s.alerts[0])).toBe('Maman a pris Metformine à 9 h 12.')
    expect(planAlerts(s, at('2026-03-10 09:14'))).toEqual({ create: [], resolve: [] })
  })

  it('pendant les heures calmes, l’alerte aux proches attend le réveil', () => {
    // Prise de 23 h : relance à 23 h 30, proches à minuit, envoyé à 7 h.
    const s = run(base({ medications: [med({ id: 'metformine', times: ['23:00'], since: '2026-03-10T00:00:00Z' })] }), '2026-03-10 23:30', '2026-03-11 00:00')
    const proches = s.alerts.find((a) => a.level === 'proches')!
    expect(proches.doseKey).toBe('2026-03-10|metformine|23:00')
    expect(Date.parse(proches.deliverAt)).toBe(at('2026-03-11 07:00'))
    expect(deliveredAlerts(s, at('2026-03-11 06:59'))).toEqual([])
    expect(deliveredAlerts(s, at('2026-03-11 07:00'))).toHaveLength(1)
  })

  it('sans heures calmes, l’alerte part aussitôt', () => {
    const s = run(base({ settings: { quietHours: false } as AppState['settings'] }), '2026-03-10 23:30', '2026-03-11 00:00')
    const proches = s.alerts.find((a) => a.level === 'proches')!
    expect(Date.parse(proches.deliverAt)).toBe(at('2026-03-11 00:00'))
  })
})

describe('quietUntil', () => {
  const settings = base().settings
  it('gère une plage qui passe minuit, et une plage dans la journée', () => {
    expect(quietUntil(settings, at('2026-03-10 22:29'))).toBeNull()
    expect(quietUntil(settings, at('2026-03-10 22:30'))).toBe(at('2026-03-11 07:00'))
    expect(quietUntil(settings, at('2026-03-11 03:00'))).toBe(at('2026-03-11 07:00'))
    expect(quietUntil(settings, at('2026-03-11 07:00'))).toBeNull()
    const sieste = { ...settings, quietFrom: '13:00', quietTo: '15:00' }
    expect(quietUntil(sieste, at('2026-03-10 14:00'))).toBe(at('2026-03-10 15:00'))
    expect(quietUntil(sieste, at('2026-03-10 16:00'))).toBeNull()
  })
})

describe('prises de la veille', () => {
  it('la prise oubliée hier soir est relancée, pas celle d’hier matin', () => {
    const s = base({ medications: [med({ id: 'm', times: ['08:00', '23:00'] })] })
    expect(planAlerts(s, at('2026-03-10 06:00')).create.map((a) => `${a.level} ${a.doseKey}`)).toEqual([
      'rappel 2026-03-09|m|23:00',
      'proches 2026-03-09|m|23:00',
    ])
  })
})

it('précise « hier » pour une prise de la veille', () => {
  const s = base({ medications: [med({ id: 'm', name: 'Collyre', times: ['23:00'] })] })
  expect(planAlerts(s, at('2026-03-10 06:00')).create[1].message).toBe('Maman n’a pas encore pris Collyre (prévu hier à 23 h).')
})
