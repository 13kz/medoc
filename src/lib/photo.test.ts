import { describe, expect, it } from 'vitest'
import { dataUrlBytes, fitWithin, isPhoto } from './photo'

describe('photo de la boîte', () => {
  it('réduit sans déformer ni agrandir', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 360, height: 270 })
    expect(fitWithin(1080, 1920)).toEqual({ width: 203, height: 360 })
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 })
  })

  it('reconnaît une image encodée et estime sa taille', () => {
    expect(isPhoto('data:image/jpeg;base64,AAAA')).toBe(true)
    expect(isPhoto('https://exemple.fr/boite.jpg')).toBe(false)
    expect(isPhoto('data:text/html;base64,AAAA')).toBe(false)
    expect(dataUrlBytes('data:image/jpeg;base64,' + 'A'.repeat(4000))).toBe(3000)
  })
})
