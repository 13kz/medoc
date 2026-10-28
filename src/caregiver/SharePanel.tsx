import { useCallback, useEffect, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import {
  cancelInvitation,
  createDossier,
  defaultServer,
  formatCode,
  invitationHref,
  invite,
  listMembers,
  revokeMember,
  ROLE_LABEL,
  type Member,
  type PendingInvitation,
  type Role,
} from '../lib/links'
import { useLink } from '../lib/linkContext'
import { useStore } from '../lib/store'

const ROLE_ICON: Record<Role, IconName> = { patient: 'phone', aidant: 'heart', medecin: 'stethoscope' }
const INVITES: { role: Role; label: string }[] = [
  { role: 'patient', label: 'Le téléphone du patient' },
  { role: 'aidant', label: 'Un autre proche' },
  { role: 'medecin', label: 'Son médecin' },
]

const until = (ms: number) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(ms)

/**
 * Partage du dossier : le créer sur le serveur, inviter le téléphone du patient, un proche ou le médecin
 * par un code, et retirer un accès. N'apparaît que dans l'appli de l'aidant installée.
 */
export function SharePanel() {
  const { state } = useStore()
  const { role, link, open } = useLink()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [fresh, setFresh] = useState<{ code: string; role: Role; expiresAt: number } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [name, setName] = useState(() => state.contacts.find((c) => c.role === 'famille')?.name ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!link) return
    try {
      const r = await listMembers(link)
      setMembers(r.members.filter((m) => !m.revokedAt))
      setInvitations(r.invitations)
      setError('')
    } catch {
      setError('Liste des accès indisponible hors ligne.')
    }
  }, [link])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  if (role !== 'aidant' || import.meta.env.MODE === 'single') return null

  if (!link) {
    return (
      <div className="group share">
        <h3>Partager le dossier</h3>
        <p className="cg-help">
          Pour que le téléphone de {state.patient.name}, les autres proches et le médecin voient la même ordonnance et les mêmes prises, le dossier est mis sur le serveur de Medoc.
        </p>
        <label className="field" htmlFor="share-name">
          <span>Votre prénom, vu par les autres</span>
          <input id="share-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="share-error" role="alert">{error}</p>}
        <button
          className="primary"
          disabled={busy || !name.trim()}
          onClick={() =>
            run(async () => {
              const base = { ...state, clock: { offsetMs: 0, speed: 1, anchorMs: Date.now() } }
              open(await createDossier(defaultServer(), base, 'aidant', name.trim()))
            }, 'Le serveur ne répond pas. Réessayez quand le téléphone a du réseau.')
          }
        >
          Partager ce dossier
        </button>
      </div>
    )
  }

  return (
    <div className="group share">
      <h3>Qui a accès au dossier</h3>
      <ul className="contacts">
        {members.map((m) => (
          <li key={m.id}>
            <span className={`ct-icon ct-${m.role === 'medecin' ? 'medecin' : 'famille'}`}>
              <Icon name={ROLE_ICON[m.role]} size={18} />
            </span>
            <span className="ct-text">
              <strong>{m.name || ROLE_LABEL[m.role]}</strong>
              <span>
                {ROLE_LABEL[m.role]}
                {m.id === link.memberId ? ', cet appareil' : ''}
              </span>
            </span>
            {m.id !== link.memberId &&
              (confirm === m.id ? (
                <button
                  className="armed compact"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await revokeMember(link, m.id)
                      setConfirm(null)
                      await refresh()
                    }, 'Accès non retiré : pas de réseau.')
                  }
                >
                  Confirmer
                </button>
              ) : (
                <button className="ghost compact" onClick={() => setConfirm(m.id)}>
                  Retirer l’accès
                </button>
              ))}
          </li>
        ))}
        {invitations.map((i) => (
          <li key={i.code ?? i.expiresAt} className="share-pending">
            <span className="ct-icon">
              <Icon name="snooze" size={18} />
            </span>
            <span className="ct-text">
              <strong>{i.code ? formatCode(i.code) : 'Invitation'}</strong>
              <span>
                {ROLE_LABEL[i.role]}, en attente jusqu’à {until(i.expiresAt)}
              </span>
            </span>
            {i.code && (
              <button className="ghost compact" aria-label={`Annuler l’invitation ${formatCode(i.code)}`} onClick={() => run(async () => {
                await cancelInvitation(link, i.code!)
                if (fresh?.code === i.code) setFresh(null)
                await refresh()
              }, 'Invitation non annulée : pas de réseau.')}>
                Annuler
              </button>
            )}
          </li>
        ))}
      </ul>

      {fresh && (
        <div className="share-code" role="status">
          <p>
            Code pour {fresh.role === 'patient' ? 'le téléphone du patient' : fresh.role === 'medecin' ? 'le médecin' : 'le proche'} :
          </p>
          <p className="share-code-value">{formatCode(fresh.code)}</p>
          <p className="cg-help">
            À saisir sur l’autre appareil, page « Rejoindre », ou ouvrir ce lien. Valable une fois, jusqu’à {until(fresh.expiresAt)}.
          </p>
          <p className="share-link">{invitationHref(fresh.code, fresh.role)}</p>
          {'share' in navigator && (
            <button
              className="secondary"
              onClick={() => navigator.share({ title: 'Medoc', text: `Code Medoc : ${formatCode(fresh.code)}`, url: invitationHref(fresh.code, fresh.role) }).catch(() => {})}
            >
              Envoyer le lien
            </button>
          )}
        </div>
      )}

      <fieldset className="field">
        <legend>Inviter</legend>
        <div className="share-invites">
          {INVITES.map((x) => (
            <button
              key={x.role}
              className="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setFresh(await invite(link, x.role, x.role === 'patient' ? state.patient.name : ''))
                  await refresh()
                }, 'Pas de réseau : le code n’a pas pu être créé.')
              }
            >
              <Icon name={ROLE_ICON[x.role]} size={18} />
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="share-error" role="alert">{error}</p>}
    </div>
  )
}
