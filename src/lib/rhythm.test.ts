import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { describeDose } from './phrases'
import { addDays, adherence, dosesOn, rhythmLabel, takesOn, weekGrid } from './schedule'

// Le 10 mars 2026 est un mardi.
describe('takesOn', () => {
  it('tous les jours par défaut', () => {
    expect(takesOn(med({ id: 'a' }), '2026-03-10')).toBe(true)
  })

  it('certains jours de la semaine', () => {
    const m = med({ id: 'a', rhythm: { kind: 'weekdays', days: [1, 4] } })
    expect(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'].map((d) => takesOn(m, d))).toEqual([true, false, false, true])
  })

  it('un jour sur N, y compris à travers le changement d’heure', () => {
    const m = med({ id: 'a', rhythm: { kind: 'interval', every: 2, from: '2026-03-27' } })
    // Passage à l'heure d'été dans la nuit du 28 au 29 mars.
    expect(['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'].map((d) => takesOn(m, d))).toEqual([
      false, true, false, true, false, true,
    ])
    const weekly = med({ id: 'b', rhythm: { kind: 'interval', every: 7, from: '2026-03-02' } })
    expect(takesOn(weekly, '2026-03-16')).toBe(true)
    expect(takesOn(weekly, '2026-03-17')).toBe(false)
  })

  it('respecte les dates de début et de fin (incluses)', () => {
    const m = med({ id: 'a', startDate: '2026-03-10', endDate: '2026-03-16' })
    expect(['2026-03-09', '2026-03-10', '2026-03-16', '2026-03-17'].map((d) => takesOn(m, d))).toEqual([false, true, true, false])
  })
})

describe('rythme dans les prises et le semainier', () => {
  it('un antibiotique de 7 jours n’apparaît plus le 8e jour', () => {
    const state = makeState({ medications: [med({ id: 'amox', times: ['08:00', '20:00'], startDate: '2026-03-10', endDate: addDays('2026-03-10', 6) })] })
    expect(dosesOn(state, at('2026-03-16 12:00'), at('2026-03-16 12:00'))).toHaveLength(2)
    expect(dosesOn(state, at('2026-03-17 12:00'), at('2026-03-17 12:00'))).toHaveLength(0)
  })

  it('les jours sans prise ne comptent pas comme des oublis', () => {
    const state = makeState({ medications: [med({ id: 'a', rhythm: { kind: 'weekdays', days: [2] } })] })
    const week = weekGrid(state, at('2026-03-10 09:00'))
    expect(week.reduce((n, d) => n + d.cells.reduce((k, c) => k + c.missed, 0), 0)).toBe(1)
    expect(adherence(week)).toBe(0)
  })

  it('le dernier jour est annoncé', () => {
    const state = makeState({ medications: [med({ id: 'a', name: 'Amoxicilline', endDate: '2026-03-10' })] })
    expect(describeDose(dosesOn(state, at('2026-03-10 08:00'), at('2026-03-10 08:00'))[0])).toBe('Amoxicilline. 1 comprimé. C’est le dernier jour.')
  })
})

describe('rhythmLabel', () => {
  it('résume le rythme et la durée', () => {
    expect(rhythmLabel(med({ id: 'a' }))).toBe('Tous les jours')
    expect(rhythmLabel(med({ id: 'a', rhythm: { kind: 'weekdays', days: [4, 1] } }))).toBe('lun., jeu.')
    expect(rhythmLabel(med({ id: 'a', rhythm: { kind: 'weekdays', days: [0] } }))).toBe('Le dimanche')
    expect(rhythmLabel(med({ id: 'a', rhythm: { kind: 'interval', every: 2, from: '2026-03-10' } }))).toBe('Un jour sur deux')
    expect(rhythmLabel(med({ id: 'a', endDate: '2026-03-16' }))).toBe('Tous les jours, jusqu’au 16 mars')
  })
})
