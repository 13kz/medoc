import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { daysLeft, needsRefill, stockLabel, unitsPerDay } from './stock'
import { reducer } from './store'

const ramipril = med({ id: 'ramipril', times: ['08:00', '20:00'], stock: { units: 10, perDose: 1, boxSize: 30 } })

describe('décompte du stock', () => {
  it('une prise retire une unité, l’annuler la rend, une prise confirmée deux fois ne compte qu’une fois', () => {
    const key = '2026-03-10|ramipril|08:00'
    let s = makeState({ medications: [ramipril] })
    s = reducer(s, { type: 'take', doseKey: key, by: 'patient', at: at('2026-03-10 08:01') })
    s = reducer(s, { type: 'take', doseKey: key, by: 'aidant', at: at('2026-03-10 08:02') })
    expect(s.medications[0].stock!.units).toBe(9)
    s = reducer(s, { type: 'untake', doseKey: key })
    s = reducer(s, { type: 'untake', doseKey: key })
    expect(s.medications[0].stock!.units).toBe(10)
  })

  it('les prises « si besoin » comptent aussi, et racheter ajoute une boîte', () => {
    const doli = med({ id: 'doli', times: [], asNeeded: { maxPerDay: 3, minGapH: 6 }, stock: { units: 2, perDose: 2, boxSize: 8 } })
    let s = makeState({ medications: [doli] })
    s = reducer(s, { type: 'takeAsNeeded', intake: { id: 'x', medId: 'doli', takenAt: '2026-03-10T10:00:00Z', by: 'patient', early: false } })
    expect(s.medications[0].stock!.units).toBe(0)
    s = reducer(s, { type: 'restock', medId: 'doli' })
    expect(s.medications[0].stock!.units).toBe(8)
    s = reducer(s, { type: 'untakeAsNeeded', id: 'x' })
    expect(s.medications[0].stock!.units).toBe(10)
  })
})

describe('estimation', () => {
  it('jours restants selon les heures et le rythme', () => {
    expect(unitsPerDay(ramipril)).toBe(2)
    expect(daysLeft(ramipril)).toBe(5)
    const lundiJeudi = { ...ramipril, times: ['08:00'], rhythm: { kind: 'weekdays' as const, days: [1, 4] } }
    expect(daysLeft(lundiJeudi)).toBe(35)
    const unSurDeux = { ...ramipril, times: ['08:00'], rhythm: { kind: 'interval' as const, every: 2, from: '2026-03-10' } }
    expect(daysLeft(unSurDeux)).toBe(20)
  })

  it('prévient sous le seuil, sauf si le traitement s’arrête avant la fin du stock', () => {
    expect(needsRefill(ramipril, 7)).toBe(true)
    expect(needsRefill(ramipril, 5)).toBe(false)
    expect(needsRefill({ ...ramipril, endDate: '2026-03-12' }, 7, '2026-03-10')).toBe(false)
    expect(needsRefill({ ...ramipril, endDate: '2026-03-20' }, 7, '2026-03-10')).toBe(true)
    expect(needsRefill({ ...ramipril, stock: undefined }, 7)).toBe(false)
  })

  it('libellés', () => {
    expect(stockLabel(ramipril)).toBe('Encore 5 jours de stock')
    expect(stockLabel({ ...ramipril, stock: { ...ramipril.stock!, units: 1 } })).toBe('Moins d’une journée de stock')
    expect(stockLabel({ ...ramipril, stock: { ...ramipril.stock!, units: 0 } })).toBe('Il n’en reste plus')
  })
})
