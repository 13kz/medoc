import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Link, Role } from './core'
import { kv, readJson, writeJson } from './storage'

/**
 * Qui utilise ce téléphone, et les dossiers partagés qu'il a rejoints.
 * Sans dossier partagé, le patient et l'aidant travaillent sur le dossier de ce téléphone ;
 * on peut donc essayer les trois profils sur un seul appareil, avec les mêmes données.
 */
export type Session = { role: Role; name: string; /** Dossier partagé ouvert (patient, aidant). */ dossier?: string }

const SESSION_KEY = 'medoc:session'
const LINKS_KEY = 'medoc:links'

/** Serveur de synchronisation, réglé par profil de build dans `eas.json`. Vide : pas de partage. */
export const SERVER_URL = (process.env.EXPO_PUBLIC_MEDOC_SERVER ?? '').replace(/\/$/, '')

type Ctx = {
  session: Session | null
  links: Link[]
  /** Le dossier partagé ouvert par ce profil, s'il y en a un. */
  link: Link | null
  start: (role: Role, name: string) => void
  /** Après « Partager » ou « J'ai un code » : le téléphone passe sur ce dossier, avec le rôle de l'invitation. */
  addLink: (link: Link) => void
  /** Revenir au dossier de ce téléphone, sans supprimer le dossier partagé. */
  detach: () => void
  removeLink: (dossier: string) => void
  /** Retour à l'écran « Qui utilise ce téléphone ? ». Les données restent. */
  leave: () => void
}

const SessionContext = createContext<Ctx | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readJson<Session | null>(SESSION_KEY, null))
  const [links, setLinks] = useState<Link[]>(() => readJson<Link[]>(LINKS_KEY, []))

  const save = (s: Session | null) => {
    setSession(s)
    if (s) writeJson(SESSION_KEY, s)
    else kv.removeItem(SESSION_KEY)
  }
  const saveLinks = (l: Link[]) => {
    setLinks(l)
    writeJson(LINKS_KEY, l)
  }

  const link = session?.dossier ? links.find((l) => l.dossier === session.dossier && l.role === session.role) ?? null : null

  const value: Ctx = {
    session,
    links,
    link,
    start: (role, name) => save({ role, name }),
    addLink: (l) => {
      saveLinks([...links.filter((x) => !(x.dossier === l.dossier && x.role === l.role)), l])
      // Le médecin garde sa liste de patients ; le patient et l'aidant ouvrent ce dossier.
      save({ role: l.role, name: l.name, dossier: l.role === 'medecin' ? undefined : l.dossier })
    },
    detach: () => session && save({ ...session, dossier: undefined }),
    removeLink: (dossier) => {
      saveLinks(links.filter((l) => l.dossier !== dossier))
      if (session?.dossier === dossier) save({ ...session, dossier: undefined })
    },
    leave: () => save(null),
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession hors de SessionProvider')
  return ctx
}
