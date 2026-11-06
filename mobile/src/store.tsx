import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, AppState as RNAppState, View } from 'react-native'
import { fetch as expoFetch } from 'expo/fetch'
import { parseStored, reducer, seedState, simulatedNow, SyncClient, type Action, type AppState, type Link, type SyncStatus } from './core'
import { kv } from './storage'
import { C } from './theme'
import { Btn, T } from './ui/kit'

const STORAGE_KEY = 'medoc:v1'
const BACKUP_KEY = 'medoc:backup'

/** Données d'exemple, remises à l'heure réelle (la démo web, elle, avance l'horloge). */
export function exampleState(): AppState {
  return reducer(seedState(), { type: 'clockReset', realNow: Date.now() })
}

/** Un dossier vide pour un vrai patient. */
export function emptyState(name: string, fullName = name): AppState {
  const s = exampleState()
  return {
    ...s,
    patient: { ...s.patient, name, fullName, age: 0, conditions: [], displayMode: 'standard' },
    medications: [],
    contacts: [],
    intakes: {},
    asNeededIntakes: [],
    glucose: [],
    snoozes: {},
    alerts: [],
    notes: [],
    changes: [],
  }
}

export function hasLocalDossier(): boolean {
  return !!kv.getItem(STORAGE_KEY)
}

export function writeLocalDossier(state: AppState) {
  kv.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function readLocalDossier(): AppState | null {
  const raw = kv.getItem(STORAGE_KEY)
  if (!raw) return null
  const loaded = parseStored(raw)
  // Ce qui n'a pas pu être relu tel quel est gardé de côté : on ne perd jamais une ordonnance.
  if (!loaded || loaded.repaired) kv.setItem(BACKUP_KEY, raw)
  return loaded?.state ?? null
}

type Store = { state: AppState; dispatch: (a: Action) => void; sync: SyncStatus | null; now: number }
const StoreContext = createContext<Store | null>(null)

/** Heure courante (horloge du dossier), rafraîchie toutes les 15 s et au retour au premier plan. */
function useTick(): number {
  const [real, setReal] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setReal(Date.now()), 15000)
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && setReal(Date.now()))
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [])
  return real
}

/**
 * Le dossier ouvert : celui de ce téléphone, ou un dossier partagé synchronisé avec le serveur
 * (gestes en file hors réseau, flux en direct). Changer de dossier : changer aussi la `key`.
 */
export function DossierProvider({ link, children, onRefused }: { link: Link | null; children: ReactNode; onRefused?: () => void }) {
  const onSync = useRef<(s: AppState, st: SyncStatus) => void>(() => {})
  const [client] = useState(() =>
    link
      ? new SyncClient<Action>({ url: link.url, dossier: link.dossier, token: link.token, reduce: reducer, storage: kv, fetch: expoFetch as unknown as typeof fetch, onChange: (s, st) => onSync.current(s, st) })
      : null,
  )
  const [state, local] = useReducer(reducer, undefined, () => (client ? client.state : readLocalDossier()) ?? exampleState())
  const [loaded, setLoaded] = useState(!client || client.state !== null)
  const [sync, setSync] = useState<SyncStatus | null>(client ? client.status : null)
  onSync.current = (s, st) => {
    local({ type: 'replace', state: s })
    setSync(st)
    setLoaded(true)
  }

  useEffect(() => {
    if (!client) return
    client.start()
    // Retour au premier plan : le flux a pu être coupé par le système pendant la veille.
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && client.retryNow())
    return () => {
      sub.remove()
      client.stop()
    }
  }, [client])

  useEffect(() => {
    if (!client) writeLocalDossier(state)
  }, [state, client])

  // « Remettre l'exemple » : tiré ici une fois, à l'heure réelle, pour que tous les appareils reçoivent le même dossier.
  const dispatch = useCallback(
    (a: Action) => {
      const action: Action = a.type === 'reset' ? { type: 'replace', state: exampleState() } : a
      return client ? client.dispatch(action) : local(action)
    },
    [client],
  )
  const real = useTick()
  const now = simulatedNow(state.clock, real)

  if (!loaded) {
    const refused = sync && sync.access !== 'ok'
    return (
      <View style={{ flex: 1, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
        {refused ? (
          <>
            <T size="lg" bold style={{ textAlign: 'center' }}>
              Ce téléphone n’a pas ou plus accès à ce dossier.
            </T>
            {onRefused && <Btn label="Revenir au dossier du téléphone" onPress={onRefused} />}
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={C.paper} />
            <T size="md" color={C.muted}>
              Chargement du dossier…
            </T>
          </>
        )}
      </View>
    )
  }
  return <StoreContext.Provider value={{ state, dispatch, sync, now }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore hors de DossierProvider')
  return ctx
}
