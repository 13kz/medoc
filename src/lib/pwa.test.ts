import { describe, expect, it } from 'vitest'
import { roleFromLocation } from './pwa'

describe('roleFromLocation', () => {
  it('lit le rôle dans le chemin ou dans l’ancre', () => {
    expect(roleFromLocation({ pathname: '/patient', hash: '' })).toBe('patient')
    expect(roleFromLocation({ pathname: '/aidant/', hash: '' })).toBe('aidant')
    expect(roleFromLocation({ pathname: '/', hash: '#/medecin' })).toBe('medecin')
    expect(roleFromLocation({ pathname: '/', hash: '' })).toBeNull()
    expect(roleFromLocation({ pathname: '/patients', hash: '' })).toBeNull()
  })
})
