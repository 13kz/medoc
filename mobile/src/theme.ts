import { createContext, useContext } from 'react'
import type { Moment } from './core'

/**
 * Charte du site vitrine, « porcelaine de nuit » : un fond d'encre verte presque noire, la porcelaine
 * crème du pilulier, et les quatre couleurs de couvercle comme seule source de couleur.
 * Titres en Fraunces ; tout le reste en Atkinson Hyperlegible Next, dessinée pour les malvoyants.
 * Chaque rôle a son propre univers, comme sur le site : la nuit jaune de la patiente, le crépuscule
 * calme du proche, le bureau et le papier du médecin.
 */
export const C = {
  night: '#0b100e',
  night2: '#111915',
  night3: '#18231e',
  porcelain: '#f4f1ea',
  paper: '#ebe6da',
  paper2: '#e2dccd',
  ink: '#14201a',
  ink2: '#4b5a52',
  ink3: '#6b766f',
  green: '#0b6e4f',
  mint: '#3fd09b',
  red: '#c2361f',
  alert: '#ff5a47',
  amber: '#c27a07',
  matin: '#ffd43b',
  midi: '#ff9f43',
  aprem: '#7fd6a4',
  soir: '#6cb4ff',
  coucher: '#b69cff',
  /** Écran de la patiente : jaune sur noir, le contraste le plus fort pour la cataracte et le glaucome. */
  yellow: '#ffe14d',
  peach: '#ffb26b',
  plum: '#3a2a6b',
  rose: '#c2457a',
  desk: '#cfc6b4',
  desk2: '#b8ad97',
  stamp: '#2f6b4f',
} as const

export const F = {
  text: 'AtkinsonHyperlegibleNext_400Regular',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  black: 'AtkinsonHyperlegibleNext_800ExtraBold',
  display: 'Fraunces_500Medium',
  displayBold: 'Fraunces_600SemiBold',
  italic: 'Fraunces_400Regular_Italic',
}

export const TOUCH = 56

const LIDS: Record<Moment, string> = { matin: C.matin, midi: C.midi, 'apres-midi': C.aprem, soir: C.soir, nuit: C.coucher }
export const lid = (m: Moment) => LIDS[m]

export const ROLE_TONE = { patient: C.matin, aidant: C.soir, medecin: C.mint } as const

/** Les couleurs d'un univers : fond, texte, cartes, filets, et la couleur d'action. */
export type Universe = {
  name: 'nuit' | 'patiente' | 'clair' | 'voix' | 'crepuscule' | 'bureau'
  bg: string
  fg: string
  muted: string
  card: string
  cardLine: string
  line: string
  accent: string
  onAccent: string
  field: string
  dark: boolean
}

export const U: Record<Universe['name'], Universe> = {
  nuit: { name: 'nuit', bg: C.night, fg: C.porcelain, muted: 'rgba(244,241,234,0.66)', card: C.night2, cardLine: 'rgba(244,241,234,0.1)', line: 'rgba(244,241,234,0.1)', accent: C.porcelain, onAccent: C.ink, field: C.night3, dark: true },
  patiente: { name: 'patiente', bg: '#000000', fg: C.yellow, muted: 'rgba(255,225,77,0.72)', card: '#141414', cardLine: 'rgba(255,225,77,0.25)', line: 'rgba(255,225,77,0.25)', accent: C.yellow, onAccent: '#000000', field: '#141414', dark: true },
  clair: { name: 'clair', bg: C.porcelain, fg: C.ink, muted: C.ink2, card: '#ffffff', cardLine: 'rgba(20,32,26,0.12)', line: 'rgba(20,32,26,0.12)', accent: C.ink, onAccent: C.porcelain, field: '#ffffff', dark: false },
  voix: { name: 'voix', bg: '#000000', fg: '#ffffff', muted: 'rgba(255,255,255,0.7)', card: '#141414', cardLine: 'rgba(255,255,255,0.2)', line: 'rgba(255,255,255,0.2)', accent: C.mint, onAccent: C.ink, field: '#141414', dark: true },
  crepuscule: { name: 'crepuscule', bg: '#1c1533', fg: '#fbf7f2', muted: 'rgba(251,247,242,0.7)', card: 'rgba(255,255,255,0.09)', cardLine: 'rgba(255,255,255,0.14)', line: 'rgba(255,255,255,0.14)', accent: C.porcelain, onAccent: C.ink, field: 'rgba(255,255,255,0.1)', dark: true },
  bureau: { name: 'bureau', bg: '#fbfaf6', fg: C.ink, muted: C.ink3, card: '#ffffff', cardLine: 'rgba(20,32,26,0.12)', line: 'rgba(20,32,26,0.14)', accent: C.ink, onAccent: C.porcelain, field: '#ffffff', dark: false },
}

export const UniverseContext = createContext<Universe>(U.nuit)
export const useU = () => useContext(UniverseContext)
