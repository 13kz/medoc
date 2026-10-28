import { seedState } from './seed'
import type { Alert, AppState, Contact, Medication, Note } from './types'

export const CURRENT_VERSION = 3

type Raw = Record<string, unknown>

/**
 * Migrations successives : `MIGRATIONS[n]` transforme un état en version n en version n + 1.
 * Ajouter une entrée à chaque changement de forme de `AppState`, sans jamais modifier les précédentes.
 */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // v1 (premier prototype) : ni messages du médecin, ni identité civile du patient.
  1: (s) => {
    const patient = isObj(s.patient) ? s.patient : {}
    return { ...s, notes: [], patient: { fullName: patient.name, conditions: [], ...patient } }
  },
  // v2 : une seule sorte d'alerte, envoyée aussitôt aux proches.
  2: (s) => ({
    ...s,
    alerts: Array.isArray(s.alerts) ? s.alerts.map((a) => (isObj(a) ? { level: 'proches', deliverAt: a.at, ...a } : a)) : s.alerts,
  }),
}

export interface Loaded {
  state: AppState
  /** Des éléments illisibles ont été écartés ou complétés : garder une copie de l'original. */
  repaired: boolean
}

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Garde les éléments valides d'une liste et signale ceux qu'il a fallu écarter. */
function keep<T>(v: unknown, fix: (x: unknown) => T | null, flag: () => void): T[] {
  if (!Array.isArray(v)) {
    if (v !== undefined) flag()
    return []
  }
  const out: T[] = []
  for (const x of v) {
    const ok = fix(x)
    if (ok) out.push(ok)
    else flag()
  }
  return out
}

/** Garde les entrées d'un dictionnaire dont la valeur est valide. */
function keepRecord<T>(v: unknown, fix: (x: unknown) => T | null, flag: () => void): Record<string, T> {
  if (!isObj(v)) {
    if (v !== undefined) flag()
    return {}
  }
  const out: Record<string, T> = {}
  for (const [k, x] of Object.entries(v)) {
    const ok = fix(x)
    if (ok) out[k] = ok
    else flag()
  }
  return out
}

/** Prend les champs de `patch` qui ont le même type que dans `base`. */
function mergeTyped<T extends object>(base: T, patch: unknown, flag: () => void): T {
  if (!isObj(patch)) {
    flag()
    return base
  }
  const out = { ...base } as Raw
  for (const [k, v] of Object.entries(base)) {
    const p = patch[k]
    if (p === undefined) continue
    if (typeof p === typeof v && Array.isArray(p) === Array.isArray(v)) out[k] = p
    else flag()
  }
  return out as T
}

function fixMed(x: unknown): Medication | null {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.name)) return null
  const times = Array.isArray(x.times) ? x.times.filter((t): t is string => isStr(t) && HHMM.test(t)) : []
  return {
    ...(x as unknown as Medication),
    form: isStr(x.form) ? (x.form as Medication['form']) : 'autre',
    dose: isStr(x.dose) ? x.dose : '',
    times,
    color: isStr(x.color) ? x.color : '#ffffff',
    active: x.active !== false,
  }
}

function fixContact(x: unknown): Contact | null {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.name)) return null
  const role = x.role === 'famille' || x.role === 'medecin' || x.role === 'tiers' ? x.role : 'tiers'
  return { id: x.id, name: x.name, role, notify: x.notify === true }
}

const fixIntake = (x: unknown) =>
  isObj(x) && isStr(x.takenAt) ? { takenAt: x.takenAt, by: x.by === 'aidant' ? ('aidant' as const) : ('patient' as const) } : null

const fixIso = (x: unknown) => (isStr(x) && !Number.isNaN(Date.parse(x)) ? x : null)

function fixAlert(x: unknown): Alert | null {
  if (!isObj(x) || !isStr(x.id) || !isStr(x.doseKey) || !isStr(x.message) || !fixIso(x.at)) return null
  const at = x.at as string
  return {
    id: x.id,
    level: x.level === 'rappel' ? 'rappel' : 'proches',
    at,
    deliverAt: fixIso(x.deliverAt) ?? at,
    doseKey: x.doseKey,
    message: x.message,
    recipients: Array.isArray(x.recipients) ? x.recipients.filter(isStr) : [],
    read: x.read === true,
    ...(fixIso(x.resolvedAt) ? { resolvedAt: x.resolvedAt as string } : {}),
  }
}

const fixNote = (x: unknown): Note | null =>
  isObj(x) && isStr(x.id) && isStr(x.text)
    ? { id: x.id, text: x.text, at: isStr(x.at) ? x.at : '', from: isStr(x.from) ? x.from : '', acknowledged: x.acknowledged === true }
    : null

/**
 * Transforme ce qui a été lu (stockage local, autre onglet, serveur) en état valide de la version courante.
 * Retourne null si rien n'est récupérable.
 */
export function migrate(input: unknown, real = Date.now()): Loaded | null {
  if (!isObj(input)) return null
  let raw = input
  let version = isNum(raw.version) ? raw.version : 1
  if (version > CURRENT_VERSION) return null
  while (version < CURRENT_VERSION) {
    raw = MIGRATIONS[version]?.(raw) ?? raw
    version++
  }

  let repaired = false
  const flag = () => {
    repaired = true
  }
  const defaults = seedState()
  const clock = isObj(raw.clock) && isNum(raw.clock.offsetMs) && isNum(raw.clock.speed) && isNum(raw.clock.anchorMs) && raw.clock.speed > 0
    ? { offsetMs: raw.clock.offsetMs, speed: raw.clock.speed, anchorMs: raw.clock.anchorMs }
    : (flag(), { offsetMs: 0, speed: 1, anchorMs: real })

  const state: AppState = {
    version: CURRENT_VERSION,
    patient: mergeTyped(defaults.patient, raw.patient, flag),
    medications: keep(raw.medications, fixMed, flag),
    contacts: keep(raw.contacts, fixContact, flag),
    settings: mergeTyped(defaults.settings, raw.settings, flag),
    intakes: keepRecord(raw.intakes, fixIntake, flag),
    snoozes: keepRecord(raw.snoozes, fixIso, flag),
    alerts: keep(raw.alerts, fixAlert, flag),
    notes: keep(raw.notes, fixNote, flag),
    clock,
  }
  return { state, repaired }
}

/** Lit une chaîne JSON enregistrée ; null si elle est illisible. */
export function parseStored(text: string, real = Date.now()): Loaded | null {
  try {
    return migrate(JSON.parse(text), real)
  } catch {
    return null
  }
}
