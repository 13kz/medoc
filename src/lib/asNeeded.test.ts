import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { asNeededAdvice, asNeededStatus } from './asNeeded'
import { dosesOn } from './schedule'
import type { AsNeededIntake } from './types'

const doli = med({ id: 'doli', name: 'Doliprane', times: [], asNeeded: { maxPerDay: 3, minGapH: 6 } })
const taken = (...times: string[]): AsNeededIntake[] =>
  times.map((t, i) => ({ id: String(i), medId: 'doli', takenAt: new Date(at(t)).toISOString(), by: 'patient', early: false }))
const state = (...times: string[]) => makeState({ medications: [doli], asNeededIntakes: taken(...times) })

describe('asNeededStatus', () => {
  it('possible tout de suite sans prise récente', () => {
    expect(asNeededStatus(state(), doli, at('2026-03-10 10:00')).allowed).toBe(true)
    expect(asNeededStatus(state('2026-03-09 08:00'), doli, at('2026-03-10 10:00')).recent).toEqual([])
  })

  it('attend l’écart minimal après la dernière prise', () => {
    const s = state('2026-03-10 08:00')
    const st = asNeededStatus(s, doli, at('2026-03-10 12:00'))
    expect(st).toMatchObject({ allowed: false, reason: 'ecart', nextAt: at('2026-03-10 14:00') })
    expect(asNeededStatus(s, doli, at('2026-03-10 14:00')).allowed).toBe(true)
  })

  it('bloque au maximum sur 24 h glissantes', () => {
    const s = state('2026-03-09 20:00', '2026-03-10 02:00', '2026-03-10 08:00')
    const st = asNeededStatus(s, doli, at('2026-03-10 15:00'))
    expect(st).toMatchObject({ allowed: false, reason: 'maximum', nextAt: at('2026-03-10 20:00') })
    expect(asNeededStatus(s, doli, at('2026-03-10 20:00')).allowed).toBe(true)
  })

  it('n’apparaît pas dans les prises à heure fixe', () => {
    expect(dosesOn(state(), at('2026-03-10 10:00'), at('2026-03-10 10:00'))).toEqual([])
  })
})

describe('asNeededAdvice', () => {
  const p = { ...makeState().patient, tutoiement: true }
  it('dit quand on pourra en reprendre, ou combien de temps attendre', () => {
    const now = at('2026-03-10 12:00')
    expect(asNeededAdvice(p, doli, asNeededStatus(state(), doli, now), now)).toBe('C’est noté. Tu pourras en reprendre dans 6 h si besoin.')
    expect(asNeededAdvice(p, doli, asNeededStatus(state('2026-03-10 08:00'), doli, now), now)).toBe(
      'Trop tôt. Attends encore 2 h avant le prochain Doliprane, à 14 h.',
    )
  })
})
