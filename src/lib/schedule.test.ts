import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { adherence, dayKey, doseKey, dosesOn, formatDuration, missedByMed, momentOf, nextUpcoming, pendingNow, spokenTime, weekGrid } from './schedule'

const metformine = med({ id: 'metformine', times: ['08:00', '19:30'] })
const ramipril = med({ id: 'ramipril', times: ['08:00'] })

describe('dosesOn', () => {
  const state = makeState({ medications: [metformine, ramipril] })

  it('liste les prises du jour, triées par heure puis par nom', () => {
    const doses = dosesOn(state, at('2026-03-10 07:00'), at('2026-03-10 07:00'))
    expect(doses.map((d) => `${d.time} ${d.med.id}`)).toEqual(['08:00 metformine', '08:00 ramipril', '19:30 metformine'])
  })

  it('donne le statut de chaque prise selon l’heure', () => {
    const status = (now: string) => dosesOn(state, at(now), at(now))[0].status
    expect(status('2026-03-10 07:59')).toBe('a-venir')
    expect(status('2026-03-10 08:00')).toBe('a-prendre')
    expect(status('2026-03-10 08:29')).toBe('a-prendre')
    expect(status('2026-03-10 08:30')).toBe('en-retard')
  })

  it('marque pris, et un report suspend la prise jusqu’à son terme', () => {
    const key = doseKey('2026-03-10', 'metformine', '08:00')
    const taken = makeState({ ...state, intakes: { [key]: { takenAt: new Date(at('2026-03-10 08:05')).toISOString(), by: 'patient' } } })
    expect(dosesOn(taken, at('2026-03-10 09:00'), at('2026-03-10 09:00'))[0].status).toBe('pris')

    const snoozed = makeState({ ...state, snoozes: { [key]: new Date(at('2026-03-10 08:10')).toISOString() } })
    expect(dosesOn(snoozed, at('2026-03-10 08:05'), at('2026-03-10 08:05'))[0].status).toBe('reporte')
    expect(dosesOn(snoozed, at('2026-03-10 08:15'), at('2026-03-10 08:15'))[0].status).toBe('a-prendre')
  })

  it('ignore les médicaments arrêtés et les prises antérieures à l’ajout', () => {
    const s = makeState({
      medications: [{ ...ramipril, active: false }, { ...metformine, since: new Date(at('2026-03-10 12:00')).toISOString() }],
    })
    expect(dosesOn(s, at('2026-03-10 20:00'), at('2026-03-10 20:00')).map((d) => d.time)).toEqual(['19:30'])
  })
})

describe('prises en cours', () => {
  const state = makeState({ medications: [metformine, ramipril] })
  it('pendingNow garde les prises dues, nextUpcoming la suivante', () => {
    const now = at('2026-03-10 08:40')
    const doses = dosesOn(state, now, now)
    expect(pendingNow(doses).map((d) => d.med.id)).toEqual(['metformine', 'ramipril'])
    expect(nextUpcoming(doses)?.time).toBe('19:30')
  })
})

describe('semainier et observance', () => {
  it('compte pris et oubliés par jour et par moment', () => {
    const now = at('2026-03-10 21:00')
    const intakes: Record<string, { takenAt: string; by: 'patient' }> = {}
    for (let d = 4; d <= 10; d++) {
      const day = `2026-03-${String(d).padStart(2, '0')}`
      intakes[doseKey(day, 'ramipril', '08:00')] = { takenAt: `${day}T08:05:00`, by: 'patient' }
      if (d % 2 === 0) intakes[doseKey(day, 'metformine', '19:30')] = { takenAt: `${day}T19:35:00`, by: 'patient' }
    }
    const state = makeState({ medications: [med({ id: 'ramipril' }), med({ id: 'metformine', times: ['19:30'] })], intakes })
    const week = weekGrid(state, now)
    expect(week).toHaveLength(7)
    expect(week[6].isToday).toBe(true)
    const soir = week.map((d) => d.cells.find((c) => c.moment === 'soir')!)
    expect(soir.map((c) => c.taken)).toEqual([1, 0, 1, 0, 1, 0, 1])
    expect(soir.map((c) => c.missed)).toEqual([0, 1, 0, 1, 0, 1, 0])
    expect(adherence(week)).toBeCloseTo(11 / 14)
    expect(missedByMed(state, now)).toEqual([{ med: state.medications[1], time: '19:30', count: 3 }])
  })

  it('pas d’observance sans prise due', () => {
    expect(adherence(weekGrid(makeState(), at('2026-03-10 12:00')))).toBeNull()
  })
})

describe('formats', () => {
  it('moments, heures parlées, durées et clés de jour', () => {
    expect(['07:00', '12:30', '15:00', '19:30', '22:00'].map(momentOf)).toEqual(['matin', 'midi', 'apres-midi', 'soir', 'nuit'])
    expect(spokenTime('08:00')).toBe('8 h')
    expect(spokenTime('12:05')).toBe('12 h 05')
    expect(formatDuration(45 * 60000)).toBe('45 min')
    expect(formatDuration(90 * 60000)).toBe('1 h 30')
    expect(formatDuration(120 * 60000)).toBe('2 h')
    expect(dayKey(at('2026-03-01 00:30'))).toBe('2026-03-01')
  })
})
