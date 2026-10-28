import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { parseStored } from './migrate'
import { consume, medIdOf } from './stock'
import { seedState } from './seed'
import type { Alert, AppState, AsNeededIntake, Contact, Medication, Note, Patient, Settings } from './types'

const STORAGE_KEY = 'medoc:v1'
/** Copie de ce qui n'a pas pu être relu tel quel, pour ne jamais perdre une ordonnance. */
const BACKUP_KEY = 'medoc:backup'

export type Action =
  | { type: 'take'; doseKey: string; by: 'patient' | 'aidant'; at: number }
  | { type: 'untake'; doseKey: string }
  | { type: 'takeAsNeeded'; intake: AsNeededIntake }
  | { type: 'untakeAsNeeded'; id: string }
  | { type: 'restock'; medId: string }
  | { type: 'snooze'; doseKey: string; until: number }
  | { type: 'upsertMed'; med: Medication }
  | { type: 'deleteMed'; id: string }
  | { type: 'patient'; patch: Partial<Patient> }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'upsertContact'; contact: Contact }
  | { type: 'deleteContact'; id: string }
  | { type: 'addAlert'; alert: Alert }
  | { type: 'resolveAlert'; id: string; at: string }
  | { type: 'readAlerts' }
  | { type: 'addNote'; note: Note }
  | { type: 'ackNote'; id: string }
  | { type: 'clockJump'; deltaMs: number; realNow: number }
  | { type: 'clockSpeed'; speed: number; realNow: number }
  | { type: 'clockReset'; realNow: number }
  | { type: 'replace'; state: AppState }
  | { type: 'reset' }

/** Heure simulée correspondant à l'instant réel `real`. */
export function simulatedNow(clock: AppState['clock'], real: number): number {
  return real + clock.offsetMs + (real - clock.anchorMs) * (clock.speed - 1)
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'take': {
      const { [action.doseKey]: _, ...snoozes } = state.snoozes
      const already = action.doseKey in state.intakes
      return {
        ...state,
        snoozes,
        medications: already ? state.medications : consume(state.medications, medIdOf(action.doseKey)),
        intakes: {
          ...state.intakes,
          [action.doseKey]: { takenAt: new Date(action.at).toISOString(), by: action.by },
        },
      }
    }
    case 'untake': {
      if (!(action.doseKey in state.intakes)) return state
      const { [action.doseKey]: _, ...intakes } = state.intakes
      return { ...state, intakes, medications: consume(state.medications, medIdOf(action.doseKey), -1) }
    }
    case 'takeAsNeeded':
      return {
        ...state,
        medications: consume(state.medications, action.intake.medId),
        asNeededIntakes: [action.intake, ...state.asNeededIntakes].slice(0, 500),
      }
    case 'untakeAsNeeded': {
      const intake = state.asNeededIntakes.find((i) => i.id === action.id)
      if (!intake) return state
      return {
        ...state,
        medications: consume(state.medications, intake.medId, -1),
        asNeededIntakes: state.asNeededIntakes.filter((i) => i.id !== action.id),
      }
    }
    case 'restock':
      return {
        ...state,
        medications: state.medications.map((m) =>
          m.id === action.medId && m.stock ? { ...m, stock: { ...m.stock, units: m.stock.units + m.stock.boxSize } } : m,
        ),
      }
    case 'snooze':
      return {
        ...state,
        snoozes: { ...state.snoozes, [action.doseKey]: new Date(action.until).toISOString() },
      }
    case 'upsertMed': {
      const exists = state.medications.some((m) => m.id === action.med.id)
      return {
        ...state,
        medications: exists
          ? state.medications.map((m) => (m.id === action.med.id ? action.med : m))
          : [...state.medications, action.med],
      }
    }
    case 'deleteMed':
      return { ...state, medications: state.medications.filter((m) => m.id !== action.id) }
    case 'patient':
      return { ...state, patient: { ...state.patient, ...action.patch } }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'upsertContact': {
      const exists = state.contacts.some((c) => c.id === action.contact.id)
      return {
        ...state,
        contacts: exists
          ? state.contacts.map((c) => (c.id === action.contact.id ? action.contact : c))
          : [...state.contacts, action.contact],
      }
    }
    case 'deleteContact':
      return { ...state, contacts: state.contacts.filter((c) => c.id !== action.id) }
    case 'addAlert':
      if (state.alerts.some((a) => a.doseKey === action.alert.doseKey && a.level === action.alert.level)) return state
      return { ...state, alerts: [action.alert, ...state.alerts].slice(0, 100) }
    case 'resolveAlert':
      return { ...state, alerts: state.alerts.map((a) => (a.id === action.id ? { ...a, resolvedAt: action.at } : a)) }
    case 'addNote':
      return { ...state, notes: [action.note, ...state.notes].slice(0, 50) }
    case 'ackNote':
      return { ...state, notes: state.notes.map((n) => (n.id === action.id ? { ...n, acknowledged: true } : n)) }
    case 'readAlerts':
      return { ...state, alerts: state.alerts.map((a) => ({ ...a, read: true })) }
    case 'clockJump':
      return { ...state, clock: { ...state.clock, offsetMs: state.clock.offsetMs + action.deltaMs } }
    case 'clockSpeed': {
      const sim = simulatedNow(state.clock, action.realNow)
      return {
        ...state,
        clock: { speed: action.speed, anchorMs: action.realNow, offsetMs: sim - action.realNow },
      }
    }
    case 'clockReset':
      return { ...state, clock: { offsetMs: 0, speed: 1, anchorMs: action.realNow } }
    case 'replace':
      return action.state
    case 'reset':
      return seedState()
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const loaded = parseStored(raw)
      if (!loaded || loaded.repaired) localStorage.setItem(BACKUP_KEY, raw)
      if (loaded) return loaded.state
    }
  } catch {
    // Stockage indisponible (navigation privée, aperçu) : on repart des données d'exemple.
  }
  return seedState()
}

const StoreContext = createContext<{ state: AppState; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignoré : la démo fonctionne sans persistance.
    }
  }, [state])

  // Synchronise deux onglets ouverts (un par rôle) comme le ferait un serveur.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      // Valeur illisible : on garde l'état courant.
      const loaded = parseStored(e.newValue)
      if (loaded) dispatch({ type: 'replace', state: loaded.state })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore hors de StoreProvider')
  return ctx
}
