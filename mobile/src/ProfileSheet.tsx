import { ROLE_LABEL } from './core'
import { useSession } from './session'
import { SharePanel } from './SharePanel'
import { useU } from './theme'
import { Btn, Label, T } from './ui/kit'
import { Sheet } from './ui/Sheet'

/** Profil du téléphone : partage du dossier, et changement de profil. */
export function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const u = useU()
  const { session, link, detach, leave } = useSession()
  if (!session) return null
  return (
    <Sheet visible={visible} title="Ce téléphone" onClose={onClose}>
      <T size="lg" bold>
        {session.name}
      </T>
      <T size="sm" color={u.muted}>
        {ROLE_LABEL[session.role]}
      </T>
      <Label>Partage</Label>
      <SharePanel />
      {link && <Btn label="Revenir au dossier du téléphone" variant="ghost" onPress={detach} style={{ marginTop: 12 }} />}
      <Label>Profil</Label>
      <T size="sm" color={u.muted} style={{ marginBottom: 12 }}>
        Changer de profil garde toutes les données. Pratique pour essayer les trois rôles sur le même téléphone.
      </T>
      <Btn label="Changer de profil" icon="reset" variant="ghost" onPress={() => { onClose(); leave() }} />
    </Sheet>
  )
}
