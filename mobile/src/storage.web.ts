/** Aperçu web (développement seulement) : `localStorage` à la place de SQLite. */
export const kv = {
  getItem: (key: string): string | null => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = kv.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const writeJson = (key: string, value: unknown) => kv.setItem(key, JSON.stringify(value))
