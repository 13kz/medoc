import { useState } from 'react'
import { acceptInvitation, defaultServer, ROLE_LABEL, type Link } from '../lib/links'

/** Rejoindre un dossier avec le code donné par le patient ou un proche. */
export function JoinScreen({ code: initial, onJoined, onCancel }: { code: string; onJoined: (link: Link) => void; onCancel: () => void }) {
  const [code, setCode] = useState(initial)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      onJoined(await acceptInvitation(defaultServer(), code, name.trim()))
    } catch (e) {
      const status = (e as { status?: number }).status
      setError(status === 404 ? 'Ce code n’existe pas ou a expiré. Demandez-en un nouveau.' : 'Impossible de joindre le serveur. Vérifiez la connexion et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="join">
      <h1>Rejoindre un dossier</h1>
      <p>Saisissez le code reçu. Il sert une seule fois et reste valable 48 heures.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="join-code">Code</label>
        <input
          id="join-code"
          value={code}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          onChange={(e) => setCode(e.target.value)}
        />
        <label htmlFor="join-name">Votre prénom</label>
        <input id="join-name" value={name} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        {error && (
          <p className="join-error" role="alert">
            {error}
          </p>
        )}
        <button className="join-primary" type="submit" disabled={busy || code.replace(/[\s-]/g, '').length < 8}>
          {busy ? 'Connexion…' : 'Rejoindre'}
        </button>
        <button className="join-secondary" type="button" onClick={onCancel}>
          Annuler
        </button>
      </form>
      <p className="join-roles">Le rôle ({Object.values(ROLE_LABEL).join(', ').toLowerCase()}) est choisi par la personne qui vous invite.</p>
    </main>
  )
}
