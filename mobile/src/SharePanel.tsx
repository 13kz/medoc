import { useCallback, useEffect, useState } from 'react'
import { Share, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { fetch as expoFetch } from 'expo/fetch'
import { createDossier, formatCode, invite, listMembers, revokeMember, ROLE_LABEL, type Member, type PendingInvitation, type Role } from './core'
import { SERVER_URL, useSession } from './session'
import { useStore } from './store'
import { C, ROLE_TONE } from './theme'
import { Btn, Card, Field, IconBtn, Label, T } from './ui/kit'

const f = expoFetch as unknown as typeof fetch

/**
 * Partager le dossier entre les téléphones : le patient, les proches et le médecin.
 * Le premier appareil envoie son dossier au serveur ; les autres le rejoignent avec un code.
 */
export function SharePanel() {
  const { session, link, addLink } = useSession()
  const { state, sync } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvitation[]>([])
  const [code, setCode] = useState<{ code: string; role: Role; name: string } | null>(null)
  const [inviteName, setInviteName] = useState('')

  const refresh = useCallback(async () => {
    if (!link) return
    try {
      const r = await listMembers(link, f)
      setMembers(r.members.filter((m) => !m.revokedAt))
      setPending(r.invitations)
    } catch {
      // Hors réseau : la liste reviendra.
    }
  }, [link])
  useEffect(() => void refresh(), [refresh])

  if (!SERVER_URL)
    return (
      <T size="sm" color={C.muted}>
        Le partage entre téléphones n’est pas activé dans cette version (aucun serveur configuré dans eas.json).
      </T>
    )
  if (!session || session.role === 'medecin') return null

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch {
      setError('Le serveur ne répond pas. Vérifiez la connexion et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  if (!link)
    return (
      <View>
        <T size="md" color={C.muted} style={{ marginBottom: 12 }}>
          Le dossier de {state.patient.name} est pour l’instant sur ce téléphone seulement. Partagez-le pour que le patient, les proches et le médecin voient les mêmes prises.
        </T>
        <Btn label={busy ? 'Envoi…' : 'Partager ce dossier'} icon="cloud" disabled={busy} onPress={() => run(async () => addLink(await createDossier(SERVER_URL, state, session.role as 'patient' | 'aidant', session.name, f)))} />
        {!!error && (
          <T size="sm" color={C.late} style={{ marginTop: 8 }}>
            {error}
          </T>
        )}
      </View>
    )

  const ask = (role: Role) =>
    run(async () => {
      const name = inviteName.trim() || ROLE_LABEL[role]
      const r = await invite(link, role, name, f)
      setCode({ code: r.code, role, name })
      setInviteName('')
      void refresh()
    })

  return (
    <View>
      <T size="sm" color={sync?.online ? C.taken : C.muted} style={{ marginBottom: 10 }} accessibilityLiveRegion="polite">
        {sync?.online ? 'Dossier partagé, à jour' : 'Dossier partagé, hors ligne'}
        {sync && sync.pending > 0 ? ` · ${sync.pending} geste${sync.pending > 1 ? 's' : ''} en attente` : ''}
      </T>
      {code ? (
        <Card tone={ROLE_TONE[code.role]}>
          <T size="sm" color={C.muted}>
            Code pour {code.name} ({ROLE_LABEL[code.role].toLowerCase()}), valable 48 h, une seule fois
          </T>
          <T size="xxl" bold selectable style={{ letterSpacing: 4, marginVertical: 8 }} accessibilityLabel={`Code : ${code.code.split('').join(' ')}`}>
            {formatCode(code.code)}
          </T>
          <T size="sm" color={C.muted} style={{ marginBottom: 12 }}>
            Sur l’autre téléphone : installer Medoc, puis « J’ai un code d’invitation ».
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label="Copier" icon="list" variant="ghost" onPress={() => void Clipboard.setStringAsync(formatCode(code.code))} style={{ flex: 1 }} />
            <Btn label="Envoyer" icon="send" onPress={() => void Share.share({ message: `Rejoins le dossier Medoc de ${state.patient.name} avec le code ${formatCode(code.code)} (valable 48 h).` })} style={{ flex: 1 }} />
          </View>
          <Btn label="Fermer" variant="ghost" onPress={() => setCode(null)} style={{ marginTop: 10 }} />
        </Card>
      ) : (
        <>
          <Field label="Pour qui ? (facultatif)" value={inviteName} onChange={setInviteName} placeholder="Ex. Leïla, Dr Martin" autoCap="words" />
          <View style={{ gap: 10 }}>
            {(['patient', 'aidant', 'medecin'] as Role[]).map((r) => (
              <Btn key={r} label={`Inviter : ${ROLE_LABEL[r].toLowerCase()}`} icon="plus" variant="ghost" disabled={busy} onPress={() => ask(r)} />
            ))}
          </View>
        </>
      )}
      {!!error && (
        <T size="sm" color={C.late} style={{ marginTop: 8 }}>
          {error}
        </T>
      )}
      <Label>Qui a accès au dossier</Label>
      {members.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ width: 10, height: 32, borderRadius: 4, backgroundColor: ROLE_TONE[m.role], marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <T size="md">{m.id === link.memberId ? `${m.name} (ce téléphone)` : m.name}</T>
            <T size="xs" color={C.muted}>
              {ROLE_LABEL[m.role]}
            </T>
          </View>
          {m.id !== link.memberId && <IconBtn icon="trash" label={`Retirer l’accès de ${m.name}`} onPress={() => run(async () => { await revokeMember(link, m.id, f); await refresh() })} />}
        </View>
      ))}
      {pending.map((p, i) => (
        <T key={i} size="sm" color={C.muted} style={{ paddingVertical: 8 }}>
          Invitation en attente : {p.name} ({ROLE_LABEL[p.role].toLowerCase()})
        </T>
      ))}
    </View>
  )
}
