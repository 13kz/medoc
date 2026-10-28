import { describe, expect, it } from 'vitest'
import { fixOcr, parsePosology, parsePrescription } from './prescription'

const TODAY = '2026-03-10'
const p = (s: string) => parsePosology(s, TODAY)

describe('posologie', () => {
  it.each([
    ['1 cp matin et soir', ['08:00', '19:30']],
    ['1 comprimé le matin', ['08:00']],
    ['un comprimé matin, midi et soir', ['08:00', '12:30', '19:30']],
    ['1 gélule au coucher', ['22:00']],
    ['2 fois par jour', ['08:00', '19:30']],
    ['3 fois par jour', ['08:00', '12:30', '19:30']],
    ['4 fois/jour', ['08:00', '12:30', '19:30', '22:00']],
    ['1 cp x2/j', ['08:00', '19:30']],
    ['1 cp par jour', ['08:00']],
    ['1 sachet au petit-déjeuner', ['08:00']],
    ['1 cp au déjeuner et au dîner', ['12:30', '19:30']],
    ['1 cp toutes les 8 heures', ['00:00', '08:00', '16:00']],
  ])('« %s »', (text, times) => {
    const r = p(text)
    expect(r.times).toEqual(times)
    expect(r.understood).toBe(true)
  })

  it('quantité et forme', () => {
    expect(p('1/2 cp le midi')).toMatchObject({ quantity: 0.5, unit: 'comprime', times: ['12:30'] })
    expect(p('un demi comprimé le soir')).toMatchObject({ quantity: 0.5 })
    expect(p('2 gélules le matin')).toMatchObject({ quantity: 2, unit: 'gelule' })
    expect(p('1 goutte dans chaque œil le soir')).toMatchObject({ quantity: 1, unit: 'gouttes', times: ['19:30'], instructions: ['Dans chaque œil'] })
    expect(p('14 UI le soir')).toMatchObject({ quantity: 14, unit: 'injection', measure: 'unites' })
    expect(p('1,5 cp le matin')).toMatchObject({ quantity: 1.5 })
  })

  it('durée du traitement', () => {
    expect(p('2 fois par jour pendant 7 jours').durationDays).toBe(7)
    expect(p('1 cp le soir pendant 2 semaines').durationDays).toBe(14)
    expect(p('1 cp le matin pendant 1 mois').durationDays).toBe(30)
    expect(p('1 cp matin et soir pendant 10 j').durationDays).toBe(10)
    expect(p('1 cp le matin').durationDays).toBeUndefined()
  })

  it('si besoin', () => {
    expect(p('1 sachet si douleur, maximum 3 par jour')).toMatchObject({ asNeeded: { maxPerDay: 3, minGapH: 4 }, times: [], understood: true })
    expect(p('1 cp toutes les 6 heures si besoin')).toMatchObject({ asNeeded: { maxPerDay: 4, minGapH: 6 } })
    expect(p('1 cp en cas de fièvre, ne pas dépasser 4 par jour, espacer de 6 h')).toMatchObject({ asNeeded: { maxPerDay: 4, minGapH: 6 } })
  })

  it('jours de prise', () => {
    expect(p('1 cp le lundi et le jeudi')).toMatchObject({ rhythm: { kind: 'weekdays', days: [1, 4] }, times: ['08:00'] })
    expect(p('1 cp le soir un jour sur deux')).toMatchObject({ rhythm: { kind: 'interval', every: 2, from: TODAY }, times: ['19:30'] })
    // Le 10 mars 2026 est un mardi.
    expect(p('1 cp une fois par semaine')).toMatchObject({ rhythm: { kind: 'weekdays', days: [2] }, times: ['08:00'] })
  })

  it('consignes', () => {
    expect(p('1 cp matin et soir au cours du repas').instructions).toEqual(['Pendant le repas'])
    expect(p('1 cp le matin à jeun avec un grand verre d’eau').instructions).toEqual(['À jeun', 'Avec un grand verre d’eau'])
  })

  it('ne devine pas ce qui n’est pas écrit', () => {
    expect(p('selon avis')).toMatchObject({ times: [], understood: false })
  })
})

describe('ordonnance', () => {
  const ORDONNANCE = `Dr Martin Lefèvre
Médecin généraliste
RPPS 10001234567
12 rue des Lilas 75011 Paris
Le 10/03/2026
Mme Mireille Benali

METFORMINE 1000 mg comprimé
1 cp matin et soir au cours du repas
QSP 3 mois

- Ramipril 5 mg : 1 cp le matin
Kardégic 75 mg, 1 sachet le midi
Doliprane 1000 mg
1 cp si douleur, maximum 3 par jour
Amoxicilline 1 g : 1 cp 2 fois par jour pendant 7 jours
Collyre Travatan 40 µg/ml
1 goutte dans chaque œil le soir
Lantus 100 UI/ml
14 UI le soir
Renouvelable 2 fois
Signature`

  const lines = parsePrescription(ORDONNANCE, TODAY)

  it('trouve chaque médicament, sans l’en-tête ni le pied de page', () => {
    expect(lines.map((l) => l.name)).toEqual([
      'METFORMINE 1000 mg',
      'Ramipril 5 mg',
      'Kardégic 75 mg',
      'Doliprane 1000 mg',
      'Amoxicilline 1 g',
      'Collyre Travatan 40 µg/ml',
      'Lantus 100 UI/ml',
    ])
  })

  it('prépare une proposition complète pour chaque ligne', () => {
    const [metformine, ramipril, kardegic, doliprane, amox, collyre, lantus] = lines.map((l) => l.draft)
    expect(metformine).toMatchObject({ form: 'comprime', dose: '1 comprimé', times: ['08:00', '19:30'], instructions: 'Pendant le repas' })
    expect(metformine.endDate).toBeUndefined()
    expect(ramipril).toMatchObject({ dose: '1 comprimé', times: ['08:00'] })
    expect(kardegic).toMatchObject({ form: 'sachet', dose: '1 sachet', times: ['12:30'] })
    expect(doliprane).toMatchObject({ times: [], asNeeded: { maxPerDay: 3, minGapH: 4 } })
    expect(amox).toMatchObject({ times: ['08:00', '19:30'], startDate: '2026-03-10', endDate: '2026-03-16' })
    expect(collyre).toMatchObject({ form: 'gouttes', dose: '1 goutte', times: ['19:30'], instructions: 'Dans chaque œil' })
    expect(lantus).toMatchObject({ form: 'injection', dose: '14 unités', times: ['19:30'] })
    expect(lines.every((l) => l.issues.length === 0)).toBe(true)
  })

  it('signale ce qu’il faut compléter', () => {
    const [line] = parsePrescription('Levothyrox 75 µg\nselon bilan', TODAY)
    expect(line.issues).toEqual(['Heures de prise à préciser', 'Quantité par prise à vérifier'])
    expect(line.draft.times).toEqual(['08:00'])
  })

  it('supporte un texte de reconnaissance imparfait', () => {
    const ocr = '  1) Metformine  1000mg  cp\n   1 cp matin  et soir\n\n2) Ramipril 5mg 1cp le matin  '
    expect(parsePrescription(ocr, TODAY).map((l) => [l.name, l.draft.times])).toEqual([
      ['Metformine 1000mg', ['08:00', '19:30']],
      ['Ramipril 5mg', ['08:00']],
    ])
  })

  it('corrige les confusions habituelles de la lecture de photo', () => {
    expect(fixOcr('Metformine 1OOO mg\nl cp matin et soir\nCollyre Travatan 40 jg/ml')).toBe('Metformine 1000 mg\n1 cp matin et soir\nCollyre Travatan 40 µg/ml')
    expect(fixOcr('Ramipril 5 mg, 1 cp')).toBe('Ramipril 5 mg, 1 cp')
  })

  it('rien quand le texte n’est pas une ordonnance', () => {
    expect(parsePrescription('Bonjour, rendez-vous mardi', TODAY)).toEqual([])
  })
})
