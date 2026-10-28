import { useState } from 'react'
import { askNotifyPermission, notifyPermission, roleFromLocation } from '../lib/pwa'
import { Icon } from './Icon'

/**
 * Propose d'activer les notifications, dans l'appli installée seulement (pas dans la démo à plusieurs
 * appareils) et tant que la personne n'a pas répondu.
 */
export function NotifyOffer({ className, label }: { className?: string; label: string }) {
  const [perm, setPerm] = useState(notifyPermission)
  if (roleFromLocation() === null || perm !== 'default') return null
  return (
    <button className={className} onClick={async () => setPerm(await askNotifyPermission())}>
      <Icon name="bell" size="1.1em" />
      {label}
    </button>
  )
}
