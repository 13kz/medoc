import { describe, expect, it } from 'vitest'
import { at, makeState, med } from '../test/fixtures'
import { CURRENT_VERSION, migrate, parseStored } from './migrate'

describe('migrate', () => {
  it('relit un état courant sans rien changer', () => {
    const state = makeState({
      medications: [med({ id: 'a', times: ['08:00', '20:00'], instructions: 'Au repas' })],
      intakes: { '2026-03-10|a|08:00': { takenAt: '2026-03-10T07:05:00.000Z', by: 'patient' } },
      clock: { offsetMs: 5, speed: 2, anchorMs: 7 },
    })
    expect(migrate(JSON.parse(JSON.stringify(state)))).toEqual({ state, repaired: false })
  })

  it('migre un état v1 : messages vides et identité civile reprise du nom', () => {
    const v1 = { ...makeState({ medications: [med({ id: 'a' })] }), version: 1 } as Record<string, unknown>
    delete v1.notes
    const p = v1.patient as Record<string, unknown>
    v1.patient = { name: 'Papa', displayMode: p.displayMode, tutoiement: false, autoRead: true, voiceRate: 1 }
    const loaded = migrate(v1)!
    expect(loaded.repaired).toBe(false)
    expect(loaded.state.version).toBe(CURRENT_VERSION)
    expect(loaded.state.notes).toEqual([])
    expect(loaded.state.patient).toMatchObject({ name: 'Papa', fullName: 'Papa', conditions: [], tutoiement: false })
    expect(loaded.state.medications.map((m) => m.id)).toEqual(['a'])
  })

  it('complète les champs manquants et écarte les éléments illisibles, sans perdre le reste', () => {
    const raw = {
      version: CURRENT_VERSION,
      patient: { name: 'Mamie', voiceRate: 'vite' },
      medications: [med({ id: 'ok', times: ['08:00', '25:99'] }), { name: 'sans id' }, 'n’importe quoi'],
      intakes: { k: { takenAt: '2026-03-10T07:00:00Z' }, cassé: 3 },
      settings: { lateAfterMin: 45 },
    }
    const { state, repaired } = migrate(raw, at('2026-03-10 09:00'))!
    expect(repaired).toBe(true)
    expect(state.patient.name).toBe('Mamie')
    expect(state.patient.voiceRate).toBe(0.9)
    expect(state.medications).toHaveLength(1)
    expect(state.medications[0].times).toEqual(['08:00'])
    expect(state.intakes).toEqual({ k: { takenAt: '2026-03-10T07:00:00Z', by: 'patient' } })
    expect(state.settings).toMatchObject({ lateAfterMin: 45, snoozeMin: 10, escalateAfterMin: 30 })
    expect(state.contacts).toEqual([])
    expect(state.clock).toEqual({ offsetMs: 0, speed: 1, anchorMs: at('2026-03-10 09:00') })
  })

  it('refuse ce qui n’est pas un état, ou vient d’une version plus récente', () => {
    expect(parseStored('{pas du json')).toBeNull()
    expect(parseStored('[1,2]')).toBeNull()
    expect(migrate({ version: CURRENT_VERSION + 1 })).toBeNull()
  })
})

describe('migrate v2 → v3', () => {
  it('les alertes existantes deviennent des alertes aux proches, envoyées aussitôt', () => {
    const v2 = { ...makeState(), version: 2, alerts: [{ id: 'a', at: '2026-03-10T07:30:00.000Z', doseKey: 'k', message: 'm', recipients: ['Naz'], read: true }] }
    const { state, repaired } = migrate(v2)!
    expect(repaired).toBe(false)
    expect(state.alerts).toEqual([{ id: 'a', level: 'proches', at: '2026-03-10T07:30:00.000Z', deliverAt: '2026-03-10T07:30:00.000Z', doseKey: 'k', message: 'm', recipients: ['Naz'], read: true }])
  })
})
