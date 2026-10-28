import { createContext, useContext } from 'react'
import type { Link, Role } from './links'

/** Le dossier partagé ouvert sur cet appareil, et de quoi en changer. */
export type LinkState = { role: Role | null; link: Link | null; open: (link: Link | null) => void }

export const LinkContext = createContext<LinkState>({ role: null, link: null, open: () => {} })

export const useLink = () => useContext(LinkContext)
