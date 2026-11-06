import { MOMENTS, type Moment } from './core'

/**
 * Identité de l'appli native : la nuit d'une table de chevet, et les couvercles colorés du pilulier.
 * Tout le texte courant fait au moins 18 pt ; toute cible tactile au moins 56 pt.
 */
export const C = {
  night: '#0d1110',
  night2: '#161c1a',
  night3: '#202826',
  line: '#33403b',
  paper: '#f4eee2',
  paper2: '#e6dfcf',
  ink: '#121614',
  text: '#f4eee2',
  muted: '#aab4ae',
  taken: '#7fd6a4',
  late: '#ff8a7a',
  later: '#c9b8ff',
  brand: '#2f6b4f',
  /** Gros caractères : jaune sur noir, le contraste le plus fort pour la cataracte et le glaucome. */
  hiFg: '#ffe14d',
  hiBg: '#000000',
} as const

export const F = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
}

export const TOUCH = 56

export const lid = (m: Moment) => MOMENTS.find((x) => x.id === m)!.tone

export const ROLE_TONE = { patient: lid('matin'), aidant: lid('soir'), medecin: lid('apres-midi') } as const
