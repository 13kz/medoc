import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { announce, daySummary, describeDose } from './phrases'
import { dosesOn } from './schedule'

const state = makeState({
  medications: [med({ id: 'a', name: 'Metformine', instructions: 'Pendant le repas' }), med({ id: 'b', name: 'Ramipril', dose: '1 gélule' })],
})
const now = at('2026-03-10 08:00')
const doses = dosesOn(state, now, now)
const tu = { ...state.patient, tutoiement: true }
const vous = { ...state.patient, tutoiement: false }

describe('phrases lues', () => {
  it('décrit une prise avec sa consigne', () => {
    expect(describeDose(doses[0])).toBe('Metformine. 1 comprimé. Pendant le repas.')
  })

  it('annonce une ou plusieurs prises, en tutoyant ou en vouvoyant', () => {
    expect(announce(tu, doses.slice(0, 1), now)).toMatch(/^Il est 8 heures\. C’est l’heure de ton médicament\. Metformine/)
    expect(announce(vous, doses, now)).toContain('Vous avez 2 médicaments à prendre. Premier : Metformine')
    expect(announce(vous, doses, now)).toContain('Deuxième : Ramipril. 1 gélule.')
    expect(announce(tu, [], now)).toBe('Il est 8 heures. Tu n’as rien à prendre pour le moment.')
  })

  it('résume la journée', () => {
    expect(daySummary(vous, doses)).toBe('Il vous reste 2 prises aujourd’hui : à 8 h, Metformine ; à 8 h, Ramipril.')
    expect(daySummary(tu, doses.map((d) => ({ ...d, status: 'pris' as const })))).toMatch(/^Bravo, tu as pris/)
  })
})
