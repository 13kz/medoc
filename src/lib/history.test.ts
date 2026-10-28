import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { adherenceByMed, historyCsv, historyDays, totalAdherence } from './history'

const state = makeState({
  medications: [med({ id: 'a', name: 'Metformine', times: ['08:00', '20:00'] }), med({ id: 'd', name: 'Doliprane', times: [], asNeeded: { maxPerDay: 3, minGapH: 6 } })],
  intakes: {
    '2026-03-09|a|08:00': { takenAt: '2026-03-09T07:10:00.000Z', by: 'patient' },
    '2026-03-09|a|20:00': { takenAt: '2026-03-09T21:30:00.000Z', by: 'aidant' },
    '2026-03-10|a|08:00': { takenAt: '2026-03-10T07:05:00.000Z', by: 'patient' },
  },
  asNeededIntakes: [{ id: 'x', medId: 'd', takenAt: '2026-03-10T09:00:00.000Z', by: 'patient', early: true }],
  glucose: [{ id: 'g', at: '2026-03-09T20:50:00.000Z', value: 1.32, by: 'patient' }],
})
const now = at('2026-03-10 21:00')

describe('historique', () => {
  const h = historyDays(state, now, 3)

  it('liste les jours du plus récent au plus ancien, avec prises, « si besoin » et glycémies', () => {
    expect(h.map((d) => d.day)).toEqual(['2026-03-10', '2026-03-09', '2026-03-08'])
    expect(h[0].doses.map((d) => d.status)).toEqual(['pris', 'en-retard'])
    expect(h[0].asNeeded).toHaveLength(1)
    expect(h[1].glucose).toHaveLength(1)
  })

  it('observance par médicament, avec les prises très en retard', () => {
    expect(adherenceByMed(h).map(({ med, ...r }) => [med.id, r])).toEqual([['a', { taken: 3, due: 6, late: 1 }]])
    expect(totalAdherence(h)).toBe(0.5)
  })

  it('export CSV pour un tableur français', () => {
    const csv = historyCsv(state, historyDays(state, now, 2)).split('\r\n')
    expect(csv[0]).toBe('"Date";"Heure prévue";"Médicament";"Dose";"Statut";"Pris à";"Par";"Remarque"')
    expect(csv.slice(1, -1)).toEqual([
      '"2026-03-09";"08:00";"Metformine";"1 comprimé";"pris";"08:10";"patient";""',
      '"2026-03-09";"20:00";"Metformine";"1 comprimé";"pris";"22:30";"aidant";""',
      '"2026-03-09";"";"Glycémie";"1,32 g/L";"mesurée";"21:50";"patient";""',
      '"2026-03-10";"08:00";"Metformine";"1 comprimé";"pris";"08:05";"patient";""',
      '"2026-03-10";"";"Doliprane";"";"pris (si besoin)";"10:00";"patient";"trop tôt ou au-delà du maximum"',
      '"2026-03-10";"20:00";"Metformine";"1 comprimé";"oublié";"";"";""',
    ])
  })
})
