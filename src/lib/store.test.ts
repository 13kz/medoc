import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { reducer, simulatedNow } from './store'

describe('reducer', () => {
  const key = '2026-03-10|a|08:00'

  it('confirmer une prise efface son report ; annuler la retire', () => {
    let s = makeState({ snoozes: { [key]: '2026-03-10T08:10:00.000Z' } })
    s = reducer(s, { type: 'take', doseKey: key, by: 'aidant', at: at('2026-03-10 08:05') })
    expect(s.intakes[key].by).toBe('aidant')
    expect(s.snoozes[key]).toBeUndefined()
    s = reducer(s, { type: 'untake', doseKey: key })
    expect(s.intakes[key]).toBeUndefined()
  })

  it('ajoute puis remplace un médicament, et le supprime', () => {
    let s = reducer(makeState(), { type: 'upsertMed', med: med({ id: 'a' }) })
    s = reducer(s, { type: 'upsertMed', med: med({ id: 'a', dose: '2 comprimés' }) })
    expect(s.medications).toEqual([med({ id: 'a', dose: '2 comprimés' })])
    expect(reducer(s, { type: 'deleteMed', id: 'a' }).medications).toEqual([])
  })

  it('ne crée qu’une alerte par prise et par niveau, puis la clôt', () => {
    const alert = { id: '1', level: 'rappel' as const, at: '', deliverAt: '', doseKey: key, message: '', recipients: [], read: false }
    let s = reducer(makeState(), { type: 'addAlert', alert })
    s = reducer(s, { type: 'addAlert', alert: { ...alert, id: '2' } })
    s = reducer(s, { type: 'addAlert', alert: { ...alert, id: '3', level: 'proches' } })
    expect(s.alerts.map((a) => a.id)).toEqual(['3', '1'])
    expect(reducer(s, { type: 'readAlerts' }).alerts[0].read).toBe(true)
    expect(reducer(s, { type: 'resolveAlert', id: '1', at: 'x' }).alerts[1].resolvedAt).toBe('x')
  })

  it('l’horloge de démo avance, accélère sans saut, et revient à l’heure réelle', () => {
    let s = makeState()
    s = reducer(s, { type: 'clockJump', deltaMs: 3_600_000, realNow: 0 })
    expect(simulatedNow(s.clock, 1000)).toBe(3_601_000)
    s = reducer(s, { type: 'clockSpeed', speed: 60, realNow: 1000 })
    expect(simulatedNow(s.clock, 1000)).toBe(3_601_000)
    expect(simulatedNow(s.clock, 2000)).toBe(3_661_000)
    s = reducer(s, { type: 'clockReset', realNow: 5000 })
    expect(simulatedNow(s.clock, 6000)).toBe(6000)
  })
})
