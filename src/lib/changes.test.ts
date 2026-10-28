import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { changeSentence, changeTitle, diffMed } from './changes'
import { reducer } from './store'

const lantus = med({ id: 'lantus', name: 'Lantus', dose: '14 unités', times: ['22:00'] })

describe('diffMed', () => {
  it('ajout, arrêt, reprise, suppression', () => {
    expect(diffMed(undefined, lantus)).toEqual({ kind: 'ajout', details: ['14 unités, 22 h'] })
    expect(diffMed(lantus, { ...lantus, active: false })).toEqual({ kind: 'arret', details: [] })
    expect(diffMed({ ...lantus, active: false }, lantus)).toEqual({ kind: 'reprise', details: [] })
    expect(diffMed(lantus, undefined)).toEqual({ kind: 'suppression', details: [] })
  })

  it('détaille ce qui change, avant et après', () => {
    expect(diffMed(lantus, { ...lantus, dose: '16 unités', times: ['21:30'] })).toEqual({
      kind: 'modif',
      details: ['Dose : 14 unités → 16 unités', 'Heures : 22 h → 21 h 30'],
    })
    expect(diffMed(lantus, { ...lantus, endDate: '2026-03-20' })?.details).toEqual(['Durée : sans fin → jusqu’au 20 mars'])
  })

  it('ignore le stock, la photo et la couleur', () => {
    expect(diffMed(lantus, { ...lantus, stock: { units: 3, perDose: 1, boxSize: 5 }, color: '#000', photo: 'data:image/jpeg;base64,AA' })).toBeNull()
  })
})

describe('journal', () => {
  it('le réducteur trace les changements faits par quelqu’un, pas les autres', () => {
    let s = makeState({ medications: [lantus] })
    s = reducer(s, { type: 'upsertMed', med: { ...lantus, dose: '16 unités' }, by: 'Dr Martin', at: at('2026-03-10 10:00') })
    s = reducer(s, { type: 'upsertMed', med: { ...lantus, dose: '18 unités' } })
    s = reducer(s, { type: 'deleteMed', id: 'lantus', by: 'Naz', at: at('2026-03-11 10:00') })
    expect(s.changes.map((c) => [c.by, c.kind, c.details])).toEqual([
      ['Naz', 'suppression', []],
      ['Dr Martin', 'modif', ['Dose : 14 unités → 16 unités']],
    ])
    expect(changeTitle(s.changes[1])).toBe('Dr Martin a modifié Lantus')
    s = reducer(s, { type: 'ackChange', id: s.changes[1].id })
    expect(s.changes[1].acknowledged).toBe(true)
  })

  it('la phrase lue au patient', () => {
    const p = { ...makeState().patient, tutoiement: true }
    const s = reducer(makeState({ medications: [lantus] }), { type: 'upsertMed', med: { ...lantus, dose: '16 unités' }, by: 'Le docteur Martin', at: 0 })
    expect(changeSentence(p, s.changes[0])).toBe('Le docteur Martin a changé Lantus. Dose : 16 unités, au lieu de 14 unités.')
  })
})
