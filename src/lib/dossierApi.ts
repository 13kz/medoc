import type { AppState } from './types'

/**
 * Appels au serveur de dossiers partagés (`server/sync-server.ts`), sans dépendance au navigateur :
 * utilisés par l'appli web (`links.ts`) et par l'appli native (`mobile/`).
 */

/** Rôle d'un appareil dans un dossier. */
export type Role = 'patient' | 'aidant' | 'medecin'

/**
 * Dossiers partagés que cet appareil a rejoints, avec sa clé pour chacun.
 * Un téléphone de patient ou d'aidant en a un ; la tablette du médecin un par patient.
 */
export type Link = { url: string; dossier: string; token: string; role: Role; memberId: string; name: string; patientName?: string }
export type Member = { id: string; role: Role; name: string; createdAt: string; revokedAt?: string }
export type PendingInvitation = { code?: string; role: Role; name: string; expiresAt: number }


export async function api<T>(url: string, path: string, init: RequestInit & { token?: string } = {}, f: typeof fetch = fetch): Promise<T> {
  const { token, ...rest } = init
  const res = await f(`${url.replace(/\/$/, '')}/api${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string }
    throw Object.assign(new Error(error ?? `erreur ${res.status}`), { status: res.status })
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

type Joined = { dossier: string; token: string; member: Member }

/** Crée le dossier partagé à partir du dossier de cet appareil. */
export async function createDossier(url: string, base: AppState, role: 'patient' | 'aidant', name: string, f?: typeof fetch): Promise<Link> {
  const r = await api<Joined>(url, '/dossiers', { method: 'POST', body: JSON.stringify({ base, role, name }) }, f)
  return { url, dossier: r.dossier, token: r.token, role, memberId: r.member.id, name: r.member.name, patientName: base.patient.fullName }
}

/** Rejoint un dossier avec le code reçu. Le rôle est celui prévu par l'invitation. */
export async function acceptInvitation(url: string, code: string, name: string, f?: typeof fetch): Promise<Link> {
  const clean = code.replace(/[\s-]/g, '').toUpperCase()
  const r = await api<Joined & { role: Role }>(url, `/invitations/${encodeURIComponent(clean)}/accept`, { method: 'POST', body: JSON.stringify({ name }) }, f)
  return { url, dossier: r.dossier, token: r.token, role: r.role, memberId: r.member.id, name: r.member.name }
}

export const listMembers = (l: Link, f?: typeof fetch) =>
  api<{ members: Member[]; invitations: PendingInvitation[]; me: Member }>(l.url, `/dossiers/${l.dossier}/members`, { token: l.token }, f)

export const invite = (l: Link, role: Role, name: string, f?: typeof fetch) =>
  api<{ code: string; role: Role; expiresAt: number }>(l.url, `/dossiers/${l.dossier}/invitations`, { method: 'POST', token: l.token, body: JSON.stringify({ role, name }) }, f)

export const cancelInvitation = (l: Link, code: string, f?: typeof fetch) =>
  api<void>(l.url, `/dossiers/${l.dossier}/invitations/${code}`, { method: 'DELETE', token: l.token }, f)

export const revokeMember = (l: Link, memberId: string, f?: typeof fetch) =>
  api<void>(l.url, `/dossiers/${l.dossier}/members/${memberId}`, { method: 'DELETE', token: l.token }, f)

/** Le dossier tel que le serveur le connaît, sans s'abonner au flux (vue d'ensemble du médecin). */
export async function fetchDossier<A>(l: Link, reduce: (s: AppState, a: A) => AppState, f?: typeof fetch): Promise<AppState> {
  const r = await api<{ base: AppState; ops: { action: A }[] }>(l.url, `/dossiers/${l.dossier}`, { token: l.token }, f)
  return r.ops.reduce((s, op) => reduce(s, op.action), r.base)
}

/** Code lisible : `ABCD-EFGH`. */
export const formatCode = (code: string) => code.replace(/(.{4})(?=.)/g, '$1-')

export const ROLE_LABEL: Record<Role, string> = { patient: 'Patient', aidant: 'Proche aidant', medecin: 'Médecin' }
