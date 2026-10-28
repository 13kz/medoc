import type { Link } from './links'

/**
 * Abonnement aux alertes push de ce téléphone (aidant) : le serveur prévient même quand l'appli est fermée.
 * Il faut le service worker, donc l'appli servie en HTTPS (ou sur localhost).
 */
export const pushSupported = () =>
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window

const toKey = (b64url: string) => {
  const raw = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const api = (l: Link, path: string) => `${l.url.replace(/\/$/, '')}/api${path}`

async function registration() {
  return navigator.serviceWorker.getRegistration().then((r) => r ?? navigator.serviceWorker.ready)
}

/** Ce téléphone reçoit-il déjà les alertes ? */
export async function pushActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

/** Demande l'accord, s'abonne et confie l'abonnement au serveur. À appeler depuis un geste. */
export async function enablePush(l: Link): Promise<'active' | 'refuse' | 'indisponible'> {
  if (!pushSupported()) return 'indisponible'
  if ((await Notification.requestPermission()) !== 'granted') return 'refuse'
  const reg = await registration()
  const { publicKey } = (await fetch(api(l, '/push/key')).then((r) => r.json())) as { publicKey: string }
  const existing = await reg.pushManager.getSubscription()
  let sub = existing
  try {
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) })
  } catch {
    // Navigation privée, navigateur sans service de push : rien à faire de plus ici.
    return 'indisponible'
  }
  const res = await fetch(api(l, `/dossiers/${l.dossier}/push`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${l.token}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  if (!res.ok) throw new Error(`abonnement ${res.status}`)
  return 'active'
}

export async function disablePush(l: Link): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await fetch(api(l, `/dossiers/${l.dossier}/push`), {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${l.token}` },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe()
}
