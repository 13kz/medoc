import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { NotifyOffer } from '../components/NotifyOffer'
import { useLink } from '../lib/linkContext'
import { disablePush, enablePush, pushActive, pushSupported } from '../lib/push'

/**
 * Alertes sur ce téléphone. Dossier partagé : push envoyé par le serveur, même appli fermée.
 * Sinon : simples notifications tant que l'appli tourne.
 */
export function PushOffer() {
  const { link } = useLink()
  const [active, setActive] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (link) void pushActive().then(setActive)
  }, [link])

  if (!link || !pushSupported()) return <NotifyOffer className="secondary block" label="Recevoir les alertes en notification" />
  if (active === null) return null

  const toggle = async () => {
    setBusy(true)
    setNote('')
    try {
      if (active) {
        await disablePush(link)
        setActive(false)
      } else {
        const r = await enablePush(link)
        setActive(r === 'active')
        if (r === 'refuse') setNote('Les notifications sont bloquées pour Medoc dans les réglages du téléphone.')
        if (r === 'indisponible') setNote('Ce navigateur ne reçoit pas les alertes push. Installez Medoc sur l’écran d’accueil, hors navigation privée.')
      }
    } catch {
      setNote('Pas de réseau : réessayez dans un moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="push-offer">
      {active ? (
        <p className="push-on">
          <Icon name="bell" size={18} />
          Ce téléphone reçoit les alertes, même appli fermée.
        </p>
      ) : (
        <p className="cg-help">Recevez un oubli ou une glycémie anormale sur ce téléphone, même quand l’appli est fermée.</p>
      )}
      <button className={active ? 'ghost block' : 'secondary block'} disabled={busy} onClick={toggle}>
        <Icon name="bell" size="1.1em" />
        {active ? 'Ne plus recevoir les alertes ici' : 'Recevoir les alertes sur ce téléphone'}
      </button>
      {note && (
        <p className="share-error" role="alert">
          {note}
        </p>
      )}
    </div>
  )
}
