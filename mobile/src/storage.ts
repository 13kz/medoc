import Storage from 'expo-sqlite/kv-store'

/**
 * Stockage clé-valeur du téléphone (SQLite), en accès synchrone : la même forme que `localStorage`,
 * attendue par le code partagé (`SyncClient`).
 */
export const kv = {
  getItem(key: string): string | null {
    try {
      return Storage.getItemSync(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      Storage.setItemSync(key, value)
    } catch {
      // Stockage plein ou indisponible : l'appli continue en mémoire.
    }
  },
  removeItem(key: string) {
    try {
      Storage.removeItemSync(key)
    } catch {
      // Ignoré.
    }
  },
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = kv.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeJson = (key: string, value: unknown) => kv.setItem(key, JSON.stringify(value))
