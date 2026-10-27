import type { AppState } from './types'

/** Décalage pour que la démo commence à 7 h 55 aujourd'hui, juste avant la première prise. */
export function offsetTo(hhmm: string, real = Date.now()): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(real)
  d.setHours(h, m, 0, 0)
  return d.getTime() - real
}

/** Ordonnance d'exemple (fictive) pour une personne diabétique de type 2 avec un glaucome. */
export function seedState(): AppState {
  const real = Date.now()
  return {
    version: 1,
    patient: {
      name: 'Maman',
      displayMode: 'malvoyant',
      tutoiement: true,
      autoRead: true,
      voiceRate: 0.9,
    },
    medications: [
      {
        id: 'metformine',
        name: 'Metformine 1000 mg',
        form: 'comprime',
        dose: '1 comprimé',
        times: ['08:00', '19:30'],
        instructions: 'Pendant le repas',
        color: '#f5f5f5',
        active: true,
      },
      {
        id: 'ramipril',
        name: 'Ramipril 5 mg',
        form: 'gelule',
        dose: '1 gélule',
        times: ['08:00'],
        instructions: 'Avec un verre d’eau',
        color: '#f2a33a',
        active: true,
      },
      {
        id: 'kardegic',
        name: 'Kardégic 75 mg',
        form: 'sachet',
        dose: '1 sachet',
        times: ['12:30'],
        instructions: 'Dans un demi-verre d’eau',
        color: '#e8e1cf',
        active: true,
      },
      {
        id: 'atorvastatine',
        name: 'Atorvastatine 20 mg',
        form: 'comprime',
        dose: '1 comprimé',
        times: ['19:30'],
        color: '#ffffff',
        active: true,
      },
      {
        id: 'collyre',
        name: 'Collyre Travatan',
        form: 'gouttes',
        dose: '1 goutte dans chaque œil',
        times: ['21:00'],
        instructions: 'Fermer les yeux 1 minute après',
        color: '#2f8fd8',
        active: true,
      },
      {
        id: 'lantus',
        name: 'Insuline Lantus',
        form: 'injection',
        dose: '14 unités',
        times: ['22:00'],
        instructions: 'Contrôler la glycémie avant',
        color: '#8e5bd6',
        active: true,
      },
    ],
    contacts: [
      { id: 'fils', name: 'Naz (fils)', role: 'famille', notify: true },
      { id: 'medecin', name: 'Dr Martin', role: 'medecin', notify: false },
      { id: 'voisine', name: 'Sylvie (voisine)', role: 'tiers', notify: true },
    ],
    settings: { lateAfterMin: 30, snoozeMin: 10 },
    intakes: {},
    snoozes: {},
    alerts: [],
    clock: { offsetMs: offsetTo('07:55', real), speed: 1, anchorMs: real },
  }
}
