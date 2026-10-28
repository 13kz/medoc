import { describe, expect, it } from 'vitest'
import { currentLink, formatCode, readLinks, removeLink, saveLink, selectLink, type Link } from './links'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const link = (dossier: string, role: Link['role']): Link => ({ url: '', dossier, token: `${dossier}.x`, role, memberId: 'm', name: 'n' })

describe('dossiers rejoints par cet appareil', () => {
  it('garde un lien par dossier et par rôle, et rouvre le dernier choisi', () => {
    const s = memory()
    saveLink(link('aaaaaa', 'medecin'), s)
    saveLink(link('bbbbbb', 'medecin'), s)
    saveLink(link('bbbbbb', 'medecin'), s)
    expect(readLinks(s).map((l) => l.dossier)).toEqual(['aaaaaa', 'bbbbbb'])
    expect(currentLink('medecin', s)?.dossier).toBe('bbbbbb')
    selectLink({ dossier: 'aaaaaa' }, s)
    expect(currentLink('medecin', s)?.dossier).toBe('aaaaaa')
    expect(currentLink('patient', s)).toBeNull()
    removeLink({ dossier: 'aaaaaa', role: 'medecin' }, s)
    expect(currentLink('medecin', s)?.dossier).toBe('bbbbbb')
  })

  it('ignore un stockage abîmé', () => {
    const s = memory()
    s.setItem('medoc:links', '{pas du json')
    expect(readLinks(s)).toEqual([])
  })

  it('affiche le code en deux groupes', () => {
    expect(formatCode('ABCD2345')).toBe('ABCD-2345')
  })
})
