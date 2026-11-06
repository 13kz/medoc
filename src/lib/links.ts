import type { Link, Role } from './dossierApi'

export * from './dossierApi'

/** Dossiers rejoints par ce navigateur, gardés dans `localStorage`. */
type Store = Pick<Storage, 'getItem' | 'setItem'>

const LINKS_KEY = 'medoc:links'
const CURRENT_KEY = 'medoc:link'

const defaultStore = (): Store | null => {
  try {
    return localStorage
  } catch {
    return null
  }
}

/** Serveur par défaut : même adresse que l'appli, sauf réglage de build. */
export const defaultServer = () => (import.meta.env.VITE_SYNC_URL as string | undefined) ?? ''

export function readLinks(storage = defaultStore()): Link[] {
  try {
    const list = JSON.parse(storage?.getItem(LINKS_KEY) ?? '[]') as Link[]
    return Array.isArray(list) ? list.filter((l) => l && l.dossier && l.token) : []
  } catch {
    return []
  }
}

function writeLinks(links: Link[], storage = defaultStore()) {
  try {
    storage?.setItem(LINKS_KEY, JSON.stringify(links))
  } catch {
    // Stockage indisponible : le lien ne survivra pas au rechargement.
  }
}

export function saveLink(link: Link, storage = defaultStore()) {
  writeLinks([...readLinks(storage).filter((l) => !(l.dossier === link.dossier && l.role === link.role)), link], storage)
  selectLink(link, storage)
}

export function removeLink(link: Pick<Link, 'dossier' | 'role'>, storage = defaultStore()) {
  writeLinks(readLinks(storage).filter((l) => !(l.dossier === link.dossier && l.role === link.role)), storage)
}

export function selectLink(link: Pick<Link, 'dossier'>, storage = defaultStore()) {
  try {
    storage?.setItem(CURRENT_KEY, link.dossier)
  } catch {
    // Ignoré.
  }
}

/** Le dossier ouvert pour ce rôle : le dernier choisi, sinon le premier rejoint. */
export function currentLink(role: Role, storage = defaultStore()): Link | null {
  const links = readLinks(storage).filter((l) => l.role === role)
  let current: string | null = null
  try {
    current = storage?.getItem(CURRENT_KEY) ?? null
  } catch {
    // Ignoré.
  }
  return links.find((l) => l.dossier === current) ?? links[0] ?? null
}

/** Lien à ouvrir sur l'autre appareil. */
export const invitationHref = (code: string, role: Role, origin = location.origin) => `${origin}/${role}?invitation=${code}`

