import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import type { Link } from './links'
import { parseStored } from './migrate'
import { reducer, type Action } from './reducer'
import { seedState } from './seed'
import { SyncClient, type SyncStatus } from './sync'
import type { AppState } from './types'

export { reducer, simulatedNow, type Action } from './reducer'

const STORAGE_KEY = 'medoc:v1'
/** Copie de ce qui n'a pas pu être relu tel quel, pour ne jamais perdre une ordonnance. */
const BACKUP_KEY = 'medoc:backup'

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

type Store = { state: AppState; dispatch: (a: Action) => void; sync: SyncStatus | null }

const StoreContext = createContext<Store | null>(null)

/** Client du dossier partagé quand l'appareil en a rejoint un ; sinon tout reste dans ce navigateur. */
function startSync(link: Link | null | undefined, onChange: (state: AppState, status: SyncStatus) => void): SyncClient<Action> | null {
  if (!link || typeof window === 'undefined') return null
  return new SyncClient<Action>({ url: link.url, dossier: link.dossier, token: link.token, reduce: reducer, storage: localStorage, onChange })
}

/** Sans `link`, le dossier reste dans ce navigateur. Changer de dossier : changer aussi la `key`. */
export function StoreProvider({ children, link, onLeave }: { children: ReactNode; link?: Link | null; onLeave?: () => void }) {
  const onSync = useRef<(state: AppState, status: SyncStatus) => void>(() => {})
  const [client] = useState(() => startSync(link, (s, st) => onSync.current(s, st)))
  const [state, local] = useReducer(reducer, undefined, () => client?.state ?? load())
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
    const back = () => client.retryNow()
    const lost = () => client.dropConnection()
    window.addEventListener('online', back)
    window.addEventListener('offline', lost)
    return () => {
      window.removeEventListener('online', back)
      window.removeEventListener('offline', lost)
      client.stop()
    }
  }, [client])

  const dispatch = useCallback(
    (a: Action) => {
      if (!client) return local(a)
      // Les données d'exemple sont tirées ici une fois : tous les appareils reçoivent le même dossier.
      client.dispatch(a.type === 'reset' ? { type: 'replace', state: seedState() } : a)
    },
    [client],
  )

  useEffect(() => {
    if (client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignoré : la démo fonctionne sans persistance.
    }
  }, [state, client])

  // Synchronise deux onglets ouverts (un par rôle) comme le ferait un serveur.
  useEffect(() => {
    if (client) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      // Valeur illisible : on garde l'état courant.
      const loaded = parseStored(e.newValue)
      if (loaded) local({ type: 'replace', state: loaded.state })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [client])

  if (!loaded) {
    const refused = sync && sync.access !== 'ok'
    return (
      <div className="sync-loading" role="status">
        <p>{refused ? 'Cet appareil n’a pas ou plus accès à ce dossier.' : 'Chargement du dossier…'}</p>
        {refused && onLeave && (
          <button className="sync-leave" onClick={onLeave}>
            Utiliser cet appareil seul
          </button>
        )}
      </div>
    )
  }
  return <StoreContext.Provider value={{ state, dispatch, sync }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore hors de StoreProvider')
  return ctx
}
