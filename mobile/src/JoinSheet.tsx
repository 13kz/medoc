import { useState } from 'react'
import { fetch as expoFetch } from 'expo/fetch'
import { acceptInvitation, ROLE_LABEL, type Link } from './core'
import { SERVER_URL } from './session'
import { C, useU } from './theme'
import { Btn, Field, T } from './ui/kit'
import { Sheet } from './ui/Sheet'

/** « J'ai un code » : rejoindre un dossier partagé. Le rôle est celui prévu par l'invitation. */
export function JoinSheet({ visible, onClose, onJoined, defaultName = '' }: { visible: boolean; onClose: () => void; onJoined: (l: Link) => void; defaultName?: string }) {
  const u = useU()
  const [code, setCode] = useState('')
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    setBusy(true)
    setError('')
    try {
      const link = await acceptInvitation(SERVER_URL, code, name.trim(), expoFetch as unknown as typeof fetch)
      onJoined(link)
      setCode('')
    } catch (e) {
      const status = (e as { status?: number }).status
      setError(status === 404 || status === 410 ? 'Ce code n’existe pas, a déjà servi ou a expiré. Demandez-en un nouveau.' : 'Impossible de joindre le serveur. Vérifiez la connexion et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} title="J’ai un code d’invitation" onClose={onClose}>
      {!SERVER_URL ? (
        <T size="md" color={u.muted}>
          Le partage n’est pas activé dans cette version de l’appli (aucun serveur configuré).
        </T>
      ) : (
        <>
          <T size="md" color={u.muted} style={{ marginBottom: 18 }}>
            Le code à 8 caractères vient d’un proche ou du patient, depuis « Inviter » dans ses réglages. Il sert une fois, pendant 48 heures.
          </T>
          <Field label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="ABCD-EFGH" autoCap="characters" />
          <Field label="Votre nom, tel que les autres le verront" value={name} onChange={setName} placeholder="Ex. Karim, Dr Martin" autoCap="words" />
          {!!error && (
            <T size="sm" color={C.alert} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">
              {error}
            </T>
          )}
          <Btn label={busy ? 'Connexion…' : 'Rejoindre le dossier'} icon="key" onPress={join} size="lg" disabled={busy || code.replace(/[\s-]/g, '').length < 8 || !name.trim()} />
          <T size="xs" color={u.muted} style={{ marginTop: 14 }}>
            Vous ouvrirez le dossier avec le rôle prévu par l’invitation : {Object.values(ROLE_LABEL).join(', ').toLowerCase()}.
          </T>
        </>
      )}
    </Sheet>
  )
}
