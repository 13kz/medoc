/** Rôle de l'appli installée : `/patient`, `/aidant`, `/medecin` (ou `#/patient` dans une page autonome). */
export type Role = 'patient' | 'aidant' | 'medecin'

export function roleFromLocation(loc: Pick<Location, 'pathname' | 'hash'> = location): Role | null {
  const m = loc.pathname.match(/\/(patient|aidant|medecin)\/?$/) ?? loc.hash.match(/^#\/(patient|aidant|medecin)\b/)
  return (m?.[1] as Role | undefined) ?? null
}

/** Enregistre le service worker (hors ligne, notifications) quand la page est servie pour de vrai. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'single') return
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Pas de service worker (aperçu, navigation privée) : l'appli marche quand même, sans hors-ligne.
  })
}

/** Choisit le manifeste du rôle, pour que l'icône installée ouvre directement le bon écran. */
export function applyRoleManifest(role: Role | null): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (link) link.href = role ? `/manifest-${role}.webmanifest` : '/manifest.webmanifest'
}

export const canNotify = () => 'Notification' in window
export const notifyPermission = (): NotificationPermission | 'unsupported' => (canNotify() ? Notification.permission : 'unsupported')

/** Demande l'accord pour les notifications ; à appeler depuis un geste de l'utilisateur. */
export async function askNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canNotify()) return 'unsupported'
  return Notification.requestPermission()
}

/**
 * Notification du système quand l'appli n'est pas à l'écran (onglet en arrière-plan, appli installée réduite).
 * À l'écran, les bandeaux et la voix suffisent.
 */
export async function webNotify(title: string, body: string, opts: { tag?: string; url?: string } = {}): Promise<void> {
  if (!canNotify() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  const options: NotificationOptions = { body, tag: opts.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: opts.url ?? location.pathname } }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return await reg.showNotification(title, options)
    new Notification(title, options)
  } catch {
    // Notifications bloquées par le navigateur : rien à faire.
  }
}
