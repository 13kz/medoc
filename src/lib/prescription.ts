import { addDays } from './schedule'
import type { AsNeeded, MedForm, Medication, Rhythm } from './types'

/**
 * Lecture d'une ordonnance : du texte reconnu sur la photo (ou collé) vers des propositions de
 * médicaments. Rien n'est ajouté tel quel : chaque ligne est relue et validée par l'aidant.
 */

/** Heures des cases du pilulier. */
export const SLOT_TIMES = { matin: '08:00', midi: '12:30', soir: '19:30', coucher: '22:00' } as const
type Slot = keyof typeof SLOT_TIMES

export interface Posology {
  /** Nombre d'unités par prise (0,5 pour un demi). */
  quantity?: number
  unit?: MedForm
  /** « UI » ou « ml » plutôt qu'un nombre de comprimés. */
  measure?: 'unites' | 'ml'
  times: string[]
  rhythm?: Rhythm
  durationDays?: number
  asNeeded?: AsNeeded
  instructions: string[]
  /** Une fréquence a été trouvée : heures de prise ou « si besoin ». */
  understood: boolean
}

export interface PrescriptionLine {
  /** Texte d'origine, pour la relecture. */
  raw: string
  /** Nom et dosage : « Metformine 1000 mg ». */
  name: string
  posology: Posology
  /** Proposition pour l'éditeur de médicament ; l'aidant la complète et la valide. */
  draft: Omit<Medication, 'id' | 'color' | 'active' | 'since'>
  /** Ce qu'il faut vérifier en priorité. */
  issues: string[]
}

/** Minuscules, sans accents ni apostrophes typographiques : pour comparer, jamais pour afficher. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/œ/g, 'oe')

const WORD_NUMBERS: Record<string, string> = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', dix: '10', douze: '12', quinze: '15', vingt: '20', trente: '30' }

const withDigits = (s: string) =>
  s
    .replace(/\b(un|une)\s+demi(e)?\b/g, '0.5')
    .replace(/\bdemi(e)?\b/g, '0.5')
    .replace(/½/g, '0.5')
    .replace(/\b1\s*\/\s*2\b/g, '0.5')
    .replace(/\b1\s*\/\s*4\b/g, '0.25')
    .replace(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|dix|douze|quinze|vingt|trente)\b/g, (w) => WORD_NUMBERS[w])
    .replace(/(\d),(\d)/g, '$1.$2')

const UNITS: [RegExp, MedForm, Posology['measure']?][] = [
  [/^(cp|cpr|cps|comp\w*)$/, 'comprime'],
  [/^(gel\w*|caps\w*)$/, 'gelule'],
  [/^(sach\w*)$/, 'sachet'],
  [/^(gtt?s?|goutte\w*)$/, 'gouttes'],
  [/^(ui|u|unite\w*)$/, 'injection', 'unites'],
  [/^(inj\w*|stylo\w*)$/, 'injection'],
  [/^(ml)$/, 'autre', 'ml'],
  [/^(bouffee\w*|pulv\w*|inhal\w*|dose\w*|cuill\w*|ampoule\w*|application\w*|patch\w*|suppo\w*)$/, 'autre'],
]

const UNIT_WORD = /(\d+(?:\.\d+)?)\s*(cp|cpr|cps|comp\w*|gel\w*|caps\w*|sach\w*|gtt?s?|goutte\w*|ui|unite\w*|u|inj\w*|stylo\w*|ml|bouffee\w*|pulv\w*|inhal\w*|dose\w*|cuill\w*|ampoule\w*|application\w*|patch\w*|suppo\w*)\b/

const WEEKDAYS: [RegExp, number][] = [
  [/\blundis?\b/, 1],
  [/\bmardis?\b/, 2],
  [/\bmercredis?\b/, 3],
  [/\bjeudis?\b/, 4],
  [/\bvendredis?\b/, 5],
  [/\bsamedis?\b/, 6],
  [/\bdimanches?\b/, 0],
]

const INSTRUCTIONS: [RegExp, string][] = [
  [/\b(au cours|pendant|au milieu|au debut) du repas\b|\bavec le repas\b|\ben mangeant\b/, 'Pendant le repas'],
  [/\bavant (le|les) repas\b/, 'Avant le repas'],
  [/\bapres (le|les) repas\b/, 'Après le repas'],
  [/\ba jeun\b/, 'À jeun'],
  [/\bdans (chaque|les deux) (oeil|yeux)\b/, 'Dans chaque œil'],
  [/\bdans l'oeil droit\b/, 'Dans l’œil droit'],
  [/\bdans l'oeil gauche\b/, 'Dans l’œil gauche'],
  [/\b(avec|et) (un|1) (grand )?verre d'eau\b/, 'Avec un grand verre d’eau'],
  [/\bsous la langue\b/, 'Sous la langue'],
  [/\b(ne pas croquer|avaler sans croquer|sans croquer)\b/, 'Avaler sans croquer'],
]

const timesOf = (slots: Iterable<Slot>) => [...new Set([...slots].map((s) => SLOT_TIMES[s]))].sort()

/** « 1 cp matin et soir », « 2 fois par jour pendant 7 jours », « 1 sachet si douleur, maximum 3 par jour »… */
export function parsePosology(text: string, today: string): Posology {
  const s = withDigits(norm(text))
  const out: Posology = { times: [], instructions: [], understood: false }

  const q = s.match(UNIT_WORD)
  if (q) {
    out.quantity = Number(q[1])
    const hit = UNITS.find(([re]) => re.test(q[2]))
    if (hit) {
      out.unit = hit[1]
      if (hit[2]) out.measure = hit[2]
    }
  }

  // Moments de la journée. « petit déjeuner » est le matin ; « déjeuner » seul, le midi.
  const slots = new Set<Slot>()
  const moments = s.replace(/petit[- ]dejeuner/g, ' matin ')
  if (/\bmatin(s|ee)?\b|\breveil\b/.test(moments)) slots.add('matin')
  if (/\bmidi\b|\bdejeuner\b/.test(moments)) slots.add('midi')
  if (/\bsoir(s|ee)?\b|\bdiner\b/.test(moments)) slots.add('soir')
  if (/\bcoucher\b|\bnuit\b|\bau lit\b/.test(moments)) slots.add('coucher')

  const perDay = s.match(/(\d+)\s*(?:fois|x)\s*(?:par|\/)\s*(?:jour|j|24\s*h)\b/) ?? s.match(/\bx\s*(\d+)\s*(?:par|\/)\s*(?:jour|j)\b/)
  const everyH = s.match(/toutes les\s*(\d+)\s*(?:h|heures?)\b/)
  const prn = /\b(si (besoin|douleurs?|fievre|necessaire|crise|nausees?|insomnie)|en cas de|a la demande)\b/.test(s)

  if (prn) {
    const max = s.match(/(?:maxi(?:mum)?|max|jusqu'a|au plus|ne pas depasser)\.?\s*(\d+)/)
    const gap = everyH ?? s.match(/(?:espacer|espacees?|intervalle)[^\d]*(\d+)\s*(?:h|heures?)/)
    const minGapH = gap ? Number(gap[1]) : 4
    out.asNeeded = { maxPerDay: max ? Number(max[1]) : Math.min(4, Math.max(1, Math.floor(24 / minGapH))), minGapH }
    out.understood = true
  } else if (slots.size > 0) {
    out.times = timesOf(slots)
  } else if (perDay) {
    const n = Number(perDay[1])
    const bySlots: Slot[][] = [['matin'], ['matin'], ['matin', 'soir'], ['matin', 'midi', 'soir'], ['matin', 'midi', 'soir', 'coucher']]
    out.times = timesOf(bySlots[Math.min(n, 4)])
  } else if (everyH) {
    const n = Number(everyH[1])
    if (n >= 2 && n <= 24) {
      const times: string[] = []
      for (let h = 8; h < 32; h += n) times.push(`${String(h % 24).padStart(2, '0')}:00`)
      out.times = [...new Set(times)].sort()
    }
  } else if (/\b(par|\/)\s*(jour|j)\b|\bchaque jour\b|\btous les jours\b|\bquotidien/.test(s) || /\b(1|une) fois par semaine\b/.test(s)) {
    out.times = [SLOT_TIMES.matin]
  }

  // Jours de prise.
  const days = WEEKDAYS.filter(([re]) => re.test(s)).map(([, d]) => d)
  if (/\b1 jour sur 2\b|\btous les 2 jours\b/.test(s)) out.rhythm = { kind: 'interval', every: 2, from: today }
  else if (/\b1 jour sur 3\b|\btous les 3 jours\b/.test(s)) out.rhythm = { kind: 'interval', every: 3, from: today }
  else if (days.length > 0 && days.length < 7) out.rhythm = { kind: 'weekdays', days: days.sort() }
  else if (/\b(1|une) fois par semaine\b/.test(s)) {
    const [y, m, d] = today.split('-').map(Number)
    out.rhythm = { kind: 'weekdays', days: [new Date(y, m - 1, d).getDay()] }
  }
  if (out.rhythm && out.times.length === 0 && !out.asNeeded) out.times = [SLOT_TIMES.matin]

  const dur = s.match(/(?:pendant|durant|pour|sur)\s*(\d+)\s*(jours?|j|semaines?|sem|mois)\b/) ?? s.match(/\b(\d+)\s*(jours?|semaines?|mois)\s*$/)
  if (dur) {
    const n = Number(dur[1])
    out.durationDays = dur[2].startsWith('j') ? n : dur[2].startsWith('s') ? n * 7 : n * 30
  }

  for (const [re, label] of INSTRUCTIONS) if (re.test(s)) out.instructions.push(label)
  if (out.times.length > 0) out.understood = true
  return out
}

const FORM_LABEL: Record<MedForm, [string, string]> = {
  comprime: ['comprimé', 'comprimés'],
  gelule: ['gélule', 'gélules'],
  sachet: ['sachet', 'sachets'],
  injection: ['injection', 'injections'],
  gouttes: ['goutte', 'gouttes'],
  autre: ['prise', 'prises'],
}

const quantityLabel = (n: number) => (n === 0.5 ? '½' : n === 0.25 ? '¼' : String(n).replace('.', ','))

/** « 1 comprimé », « ½ comprimé », « 2 gouttes », « 10 unités ». */
export function doseLabel(p: Posology, form: MedForm): string {
  const n = p.quantity ?? 1
  if (p.measure === 'unites') return `${quantityLabel(n)} unité${n > 1 ? 's' : ''}`
  if (p.measure === 'ml') return `${quantityLabel(n)} ml`
  const [one, many] = FORM_LABEL[form]
  return `${quantityLabel(n)} ${n > 1 ? many : one}`
}

const STRENGTH = /(\d+(?:[.,]\d+)?\s?(?:mg|g|µg|mcg|ug|ml|ui|%)(?:\s?\/\s?(?:ml|j|dose|24\s?h))?)(?![a-z])/i
const NAMED_FORMS = /^(collyre|insuline|sirop|creme|pommade|gel|spray|solution|patch|suppositoire|ampoule)\b/i
/** En-têtes et pied de page d'une ordonnance, à ne pas prendre pour des médicaments. */
const NOISE = /^(dr\.?\s|docteur|ordonnance|rpps|adeli|finess|n[°o]\s|tel|t[ée]l[ée]phone|fax|patient|nom\b|n[ée]e? le|le \d|fait [àa]|signature|cachet|m[ée]decin|cabinet|\d{5}\s|\d{2}[ ./]\d{2}[ ./]\d{2,4}|renouvel|qsp|ald|bizone|mme|m\.\s|mr\s)/i

/** Une ligne de médicament commence par un nom (après une éventuelle puce), pas par une quantité. */
const LEADING = /^[\s\-–•*·>]*(?:\d+\s*[).:-]\s*)?/
const isMedLine = (line: string) => {
  const body = line.replace(LEADING, '')
  return !NOISE.test(body) && /^\p{L}/u.test(body) && (STRENGTH.test(body) || NAMED_FORMS.test(body))
}

const formFromName = (name: string): MedForm | undefined => {
  const n = norm(name)
  if (/\bcollyre\b/.test(n)) return 'gouttes'
  if (/\binsuline\b|\bstylo\b|\binj/.test(n)) return 'injection'
  if (/\bgel(ule)?s?\b/.test(n) && /gelule/.test(n)) return 'gelule'
  if (/\bsachets?\b|\bpoudre\b/.test(n)) return 'sachet'
  if (/\bcomprimes?\b|\bcp\b/.test(n)) return 'comprime'
  return undefined
}

const cleanName = (s: string) => {
  const t = s
    .replace(LEADING, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:-]+$/, '')
    .trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Confusions habituelles de la reconnaissance de texte : « 1OOO mg », « 40 jg/ml », « l cp ». */
export function fixOcr(text: string): string {
  return text
    .replace(/\b[\dOo]*\d[\dOo]*(?=\s?(?:mg|g|µg|ml|ui)\b)/gi, (n) => n.replace(/[Oo]/g, '0'))
    .replace(/(\d)\s?(?:jg|pg|ug|mcg)\b/gi, '$1 µg')
    .replace(/(^|\s)[lI|](?=\s?(?:cp|comprim|g[ée]lule|sachet|goutte)\b)/gi, '$11')
}

/** Les lignes de médicaments d'une ordonnance, avec la posologie qui suit chacune. */
export function parsePrescription(text: string, today: string): PrescriptionLine[] {
  const lines = fixOcr(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const blocks: { head: string; rest: string[] }[] = []
  for (const line of lines) {
    if (isMedLine(line)) blocks.push({ head: line, rest: [] })
    else if (blocks.length > 0 && !NOISE.test(line)) blocks[blocks.length - 1].rest.push(line)
  }

  return blocks.map(({ head, rest }) => {
    const m = head.match(STRENGTH)
    // Nom et dosage = tout jusqu'au dosage ; la suite de la ligne est déjà de la posologie.
    const cut = m ? head.indexOf(m[0]) + m[0].length : head.length
    let name = cleanName(head.slice(0, cut))
    let posText = [head.slice(cut), ...rest].join(' ')
    // Forme écrite après le dosage, « Metformine 1000 mg comprimé : 1 cp matin et soir ».
    const formWord = posText.match(/^\s*,?\s*(comprim[ée]s?( pellicul[ée]s?| s[ée]cables?)?|g[ée]lules?|sachets?|solution injectable|collyre)\b/i)
    if (formWord) {
      name = `${name} ${formWord[0].trim().replace(/^,\s*/, '')}`
      posText = posText.slice(formWord[0].length)
    }
    const posology = parsePosology(posText, today)
    const form = posology.measure === 'unites' ? 'injection' : (posology.unit && posology.unit !== 'autre' ? posology.unit : undefined) ?? formFromName(name) ?? posology.unit ?? 'comprime'
    const displayName = cleanName(name.replace(/\s+(comprim[ée]s?( pellicul[ée]s?| s[ée]cables?)?|g[ée]lules?|sachets?|solution injectable)$/i, ''))

    const issues: string[] = []
    if (!posology.understood) issues.push('Heures de prise à préciser')
    if (posology.quantity === undefined && !posology.asNeeded) issues.push('Quantité par prise à vérifier')
    if (!m) issues.push('Dosage à vérifier')

    const draft: PrescriptionLine['draft'] = {
      name: displayName,
      form,
      dose: doseLabel(posology, form),
      times: posology.asNeeded ? [] : posology.understood ? posology.times : [SLOT_TIMES.matin],
      instructions: posology.instructions.join('. ') || undefined,
      rhythm: posology.rhythm,
      asNeeded: posology.asNeeded,
      startDate: posology.durationDays ? today : undefined,
      endDate: posology.durationDays ? addDays(today, posology.durationDays - 1) : undefined,
    }
    return { raw: [head, ...rest].join('\n'), name: displayName, posology, draft, issues }
  })
}
