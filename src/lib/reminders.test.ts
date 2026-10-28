import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { actionsFromNative } from './bridge'
import { reducer } from './reducer'
import { MAX_REMINDERS, remindersSignature, upcomingReminders } from './reminders'

const since = new Date(at('2026-03-01 00:00')).toISOString()
const state = () =>
  makeState({
    patient: { ...makeState().patient, tutoiement: false },
    medications: [
      med({ id: 'metformine', name: 'Metformine', dose: '1000 mg', times: ['08:00', '19:30'], since }),
      med({ id: 'ramipril', name: 'Ramipril', dose: '5 mg', times: ['08:00'], since }),
    ],
    settings: { ...makeState().settings, lateAfterMin: 30, snoozeMin: 10 },
  })

describe('rappels programmés sur le téléphone', () => {
  it('un rappel par moment de prise, puis un second en cas d’oubli, sur trois jours', () => {
    const list = upcomingReminders(state(), at('2026-03-10 07:00'))
    expect(list).toHaveLength(12)
    expect(list.slice(0, 4).map((r) => [new Date(r.at).toTimeString().slice(0, 5), r.title])).toEqual([
      ['08:00', '2 médicaments à prendre'],
      ['08:30', 'Pas encore pris'],
      ['19:30', 'C’est l’heure de votre médicament'],
      ['20:00', 'Pas encore pris'],
    ])
    expect(list[0].doseKeys).toEqual(['2026-03-10|metformine|08:00', '2026-03-10|ramipril|08:00'])
    expect(list[0].body).toBe('Metformine 1000 mg, Ramipril 5 mg. Touchez « J’ai pris » quand c’est fait.')
    expect(list[0].snoozeMin).toBe(10)
  })

  it('rien pour ce qui est déjà pris ; seulement le second rappel pour ce qui est dû', () => {
    let s = state()
    s = reducer(s, { type: 'take', doseKey: '2026-03-10|ramipril|08:00', by: 'patient', at: at('2026-03-10 08:02') })
    const list = upcomingReminders(s, at('2026-03-10 08:10'), 1)
    expect(list.map((r) => r.id.split('|')[0])).toEqual(['retard', 'prise', 'retard'])
    expect(list[0].doseKeys).toEqual(['2026-03-10|metformine|08:00'])
  })

  it('une prise reportée sonne à la fin du report', () => {
    const s = reducer(state(), { type: 'snooze', doseKey: '2026-03-10|metformine|19:30', until: at('2026-03-10 19:45') })
    const list = upcomingReminders(s, at('2026-03-10 19:35'), 1)
    expect(new Date(list[0].at).toTimeString().slice(0, 5)).toBe('19:45')
  })

  it('un changement d’ordonnance change l’empreinte, pas le simple passage du temps', () => {
    const s = state()
    const a = remindersSignature(upcomingReminders(s, at('2026-03-10 07:00')))
    expect(remindersSignature(upcomingReminders(s, at('2026-03-10 07:05')))).toBe(a)
    const changed = reducer(s, { type: 'upsertMed', med: med({ id: 'ramipril', times: ['09:00'], since }) })
    expect(remindersSignature(upcomingReminders(changed, at('2026-03-10 07:05')))).not.toBe(a)
  })

  it('reste sous la limite d’iOS', () => {
    const many = makeState({ medications: Array.from({ length: 12 }, (_, i) => med({ id: `m${i}`, times: [`${String(6 + i).padStart(2, '0')}:00`], since })) })
    expect(upcomingReminders(many, at('2026-03-10 05:00'), 7)).toHaveLength(MAX_REMINDERS)
  })
})

describe('réponses aux notifications', () => {
  it('« J’ai pris » coche les prises du rappel, sauf celles déjà cochées', () => {
    const s = reducer(state(), { type: 'take', doseKey: '2026-03-10|ramipril|08:00', by: 'aidant', at: at('2026-03-10 08:05') })
    const actions = actionsFromNative({ type: 'take', doseKeys: ['2026-03-10|metformine|08:00', '2026-03-10|ramipril|08:00'], at: at('2026-03-10 08:06') }, s)
    expect(actions).toEqual([{ type: 'take', doseKey: '2026-03-10|metformine|08:00', by: 'patient', at: at('2026-03-10 08:06') }])
  })

  it('« Plus tard » reporte les prises', () => {
    const actions = actionsFromNative({ type: 'snooze', doseKeys: ['2026-03-10|metformine|08:00'], until: at('2026-03-10 08:20') }, state())
    expect(actions).toEqual([{ type: 'snooze', doseKey: '2026-03-10|metformine|08:00', until: at('2026-03-10 08:20') }])
  })

  it('ignore un message mal formé', () => {
    expect(actionsFromNative({ type: 'take', doseKeys: 'x' } as never, state())).toEqual([])
    expect(actionsFromNative({ type: 'take', doseKeys: ['a'], at: Number.NaN }, state())).toEqual([])
  })
})
