import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { planAlerts } from './alerts'
import { doseText, formatGlucose, glucoseAdvice, glucoseLevel, parseGlucose, spokenGlucose, unitsForGlucose } from './glucose'
import { reducer } from './store'

const lantus = med({
  id: 'lantus',
  form: 'injection',
  dose: '14 unités',
  times: ['22:00'],
  glucose: { scale: [{ max: null, units: 16 }, { max: 1.2, units: 12 }, { max: 2, units: 14 }] },
})
const settings = makeState().settings

describe('schéma de dose', () => {
  it('choisit la marche selon la glycémie, bornes exclues', () => {
    expect([0.9, 1.19, 1.2, 1.99, 2, 3.1].map((v) => unitsForGlucose(lantus, v))).toEqual([12, 12, 14, 14, 16, 16])
  })

  it('sans schéma, la dose de l’ordonnance', () => {
    const fixe = { ...lantus, glucose: { scale: [] } }
    expect(unitsForGlucose(fixe, 1.5)).toBeNull()
    expect(doseText(fixe, { id: 'g', at: '', value: 1.5, by: 'patient' })).toBe('14 unités')
    expect(doseText(lantus, { id: 'g', at: '', value: 2.4, by: 'patient' })).toBe('16 unités')
    expect(doseText(lantus)).toBe('14 unités')
  })
})

describe('seuils', () => {
  it('hypo, normal, hyper', () => {
    expect([0.6, 0.7, 2.5, 2.6].map((v) => glucoseLevel(settings, v))).toEqual(['hypo', 'normal', 'normal', 'hyper'])
  })

  it('les phrases dites au patient', () => {
    const p = { ...makeState().patient, tutoiement: true }
    expect(glucoseAdvice(p, settings, lantus, 1.4)).toBe('Ta glycémie est de 1 gramme 40. Injecte 14 unités.')
    expect(glucoseAdvice(p, settings, lantus, 0.62)).toMatch(/^Ta glycémie est de zéro gramme 62\. C’est bas\. Prends du sucre/)
  })

  it('une glycémie basse prévient les proches aussitôt, même pendant les heures calmes', () => {
    let s = makeState({ medications: [lantus], contacts: [{ id: 'f', name: 'Naz', role: 'famille', notify: true }] })
    s = { ...s, settings: { ...s.settings, quietHours: true, quietFrom: '21:00', quietTo: '07:00' } }
    s = reducer(s, { type: 'glucose', reading: { id: 'g1', at: new Date(at('2026-03-10 21:55')).toISOString(), value: 0.6, by: 'patient' } })
    const alerts = planAlerts(s, at('2026-03-10 21:56')).create
    expect(alerts.map((a) => [a.message, a.deliverAt])).toEqual([
      ['Glycémie basse chez Maman : 0,6 g/L à 21 h 55.', new Date(at('2026-03-10 21:56')).toISOString()],
    ])
  })
})

describe('saisie', () => {
  it('lit les formats tapés et dictés', () => {
    expect(parseGlucose('1,25')).toBe(1.25)
    expect(parseGlucose('1.4')).toBe(1.4)
    expect(parseGlucose('1 gramme 40')).toBe(1.4)
    expect(parseGlucose('un gramme 4')).toBe(1.4)
    expect(parseGlucose('un virgule 25')).toBe(1.25)
    expect(parseGlucose('2 grammes')).toBe(2)
    expect(parseGlucose('125')).toBe(1.25)
    expect(parseGlucose('0')).toBeNull()
    expect(parseGlucose('bonjour')).toBeNull()
  })

  it('formats affichés et parlés', () => {
    expect(formatGlucose(1.25)).toBe('1,25 g/L')
    expect(formatGlucose(1.4)).toBe('1,4 g/L')
    expect(spokenGlucose(1.05)).toBe('1 gramme 05')
    expect(spokenGlucose(2)).toBe('2 grammes')
  })

  it('une nouvelle mesure pour la même prise remplace l’ancienne', () => {
    let s = makeState()
    s = reducer(s, { type: 'glucose', reading: { id: 'a', at: '2026-03-10T21:00:00Z', value: 1, doseKey: 'k', by: 'patient' } })
    s = reducer(s, { type: 'glucose', reading: { id: 'b', at: '2026-03-10T21:01:00Z', value: 1.1, doseKey: 'k', by: 'patient' } })
    expect(s.glucose.map((g) => g.id)).toEqual(['b'])
  })
})
