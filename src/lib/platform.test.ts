import { describe, expect, it } from 'vitest'
import { isConfirmation, isPostpone } from './platform'

describe('réponses à voix haute', () => {
  it('reconnaît une confirmation', () => {
    for (const t of ['c’est pris', "c'est bon", 'oui', 'je l’ai prise', 'OK']) expect(isConfirmation(t), t).toBe(true)
    expect(isConfirmation('non merci')).toBe(false)
  })

  it('reconnaît un report', () => {
    for (const t of ['plus tard', 'attends', 'pas maintenant', 'tout à l\'heure']) expect(isPostpone(t), t).toBe(true)
    expect(isPostpone('c’est pris')).toBe(false)
  })
})
