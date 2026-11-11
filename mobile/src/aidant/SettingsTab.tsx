import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import type { ContactRole, DisplayMode, IconName } from '../core'
import { ProfileSheet } from '../ProfileSheet'
import { useSession } from '../session'
import { speak } from '../speech'
import { useStore } from '../store'
import { C, lid, useU } from '../theme'
import { Icon } from '../ui/Icon'
import { Screen } from '../ui/Screen'
import { Btn, Choice, Field, IconBtn, Label, Stepper, T, Toggle, tap } from '../ui/kit'

const MODES: { id: DisplayMode; icon: IconName; title: string; desc: string }[] = [
  { id: 'voix', icon: 'ear', title: 'Voix d’abord', desc: 'Ne voit pas ou presque : deux zones géantes, tout est lu.' },
  { id: 'malvoyant', icon: 'glass', title: 'Gros caractères', desc: 'Cataracte, glaucome : jaune sur noir, une chose à la fois.' },
  { id: 'standard', icon: 'eye', title: 'Standard', desc: 'Voit bien : la journée par moment, avec des cases à cocher.' },
]
const ROLES: { value: ContactRole; label: string }[] = [
  { value: 'famille', label: 'Famille' },
  { value: 'medecin', label: 'Médecin' },
  { value: 'tiers', label: 'Personne de confiance' },
]

export function SettingsTab() {
  const u = useU()
  const { state, dispatch, now } = useStore()
  const { session } = useSession()
  const { patient, settings } = state
  const [profile, setProfile] = useState(false)
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<ContactRole>('famille')

  return (
    <Screen title="Réglages" italic={`du téléphone de ${patient.name}`} accent={C.peach} now={now} right={<IconBtn icon="user" label="Ce téléphone et partage" onPress={() => setProfile(true)} />}>
      <Label>Le téléphone de {patient.name}</Label>
      <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Affichage du patient">
        {MODES.map((m) => {
          const on = patient.displayMode === m.id
          return (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.title}. ${m.desc}`}
              onPress={() => {
                tap()
                dispatch({ type: 'patient', patch: { displayMode: m.id } })
              }}
              style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 22, borderWidth: 2, borderColor: on ? lid('nuit') : u.line, backgroundColor: on ? u.field : u.card }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: on ? lid('nuit') : u.field, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={28} color={on ? C.ink : u.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <T size="md" bold>
                  {m.title}
                </T>
                <T size="sm" color={u.muted}>
                  {m.desc}
                </T>
              </View>
            </Pressable>
          )
        })}
      </View>
      <Field label="Prénom entendu par le patient" value={patient.name} onChange={(name) => dispatch({ type: 'patient', patch: { name } })} autoCap="words" />
      <Field label="Nom complet (vu par le médecin)" value={patient.fullName} onChange={(fullName) => dispatch({ type: 'patient', patch: { fullName } })} autoCap="words" />
      <Toggle label="Lire à voix haute à l’heure de la prise" value={patient.autoRead} onChange={(autoRead) => dispatch({ type: 'patient', patch: { autoRead } })} />
      <Toggle label="Tutoyer" value={patient.tutoiement} onChange={(tutoiement) => dispatch({ type: 'patient', patch: { tutoiement } })} />
      <Toggle label="Utilise VoiceOver ou TalkBack" desc="L’appli laisse alors parler le lecteur d’écran." value={patient.screenReader} onChange={(screenReader) => dispatch({ type: 'patient', patch: { screenReader } })} />
      <Label>Vitesse de la voix</Label>
      <Choice
        label="Vitesse de la voix"
        options={[
          { value: 0.7, label: 'Lente' },
          { value: 0.9, label: 'Normale' },
          { value: 1.1, label: 'Rapide' },
        ]}
        value={patient.voiceRate}
        onChange={(voiceRate) => {
          dispatch({ type: 'patient', patch: { voiceRate } })
          speak(`Bonjour ${patient.name}, c’est l’heure de ${patient.tutoiement ? 'ton' : 'votre'} médicament.`, voiceRate)
        }}
      />

      <Label>Relances et alertes</Label>
      <Stepper label="Relancer le patient après" value={settings.lateAfterMin} step={5} min={5} max={120} unit="min" onChange={(lateAfterMin) => dispatch({ type: 'settings', patch: { lateAfterMin } })} />
      <Stepper label="Puis prévenir les proches après" value={settings.escalateAfterMin} step={5} min={0} max={180} unit="min" onChange={(escalateAfterMin) => dispatch({ type: 'settings', patch: { escalateAfterMin } })} />
      <Stepper label="« Plus tard » reporte de" value={settings.snoozeMin} step={5} min={5} max={60} unit="min" onChange={(snoozeMin) => dispatch({ type: 'settings', patch: { snoozeMin } })} />
      <Toggle label={`Heures calmes (${settings.quietFrom.replace(':', ' h ')} – ${settings.quietTo.replace(':', ' h ')})`} desc="Les alertes aux proches attendent le matin." value={settings.quietHours} onChange={(quietHours) => dispatch({ type: 'settings', patch: { quietHours } })} />

      <Label>Personnes à prévenir</Label>
      {state.contacts.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Toggle label={c.name} desc={ROLES.find((r) => r.value === c.role)?.label} value={c.notify} onChange={(notify) => dispatch({ type: 'upsertContact', contact: { ...c, notify } })} />
          </View>
          <IconBtn
            icon="trash"
            label={`Retirer ${c.name}`}
            onPress={() =>
              Alert.alert(`Retirer ${c.name} ?`, 'Cette personne ne recevra plus les alertes.', [
                { text: 'Garder', style: 'cancel' },
                { text: 'Retirer', style: 'destructive', onPress: () => dispatch({ type: 'deleteContact', id: c.id }) },
              ])
            }
          />
        </View>
      ))}
      <View style={{ marginTop: 12 }}>
        <Field label="Ajouter une personne" value={contact} onChange={setContact} placeholder={session?.name ?? 'Prénom'} autoCap="words" />
        <Choice label="Lien avec le patient" options={ROLES} value={role} onChange={setRole} />
        <Btn
          label="Ajouter"
          icon="plus"
          variant="ghost"
          disabled={!contact.trim()}
          onPress={() => {
            dispatch({ type: 'upsertContact', contact: { id: `c-${Date.now().toString(36)}`, name: contact.trim(), role, notify: true } })
            setContact('')
          }}
        />
      </View>

      <Label>Démonstration</Label>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="+1 h" variant="ghost" onPress={() => dispatch({ type: 'clockJump', deltaMs: 3600000, realNow: Date.now() })} style={{ flex: 1 }} />
        <Btn label="Heure réelle" variant="ghost" onPress={() => dispatch({ type: 'clockReset', realNow: Date.now() })} style={{ flex: 1 }} />
      </View>
      <Btn
        label="Remettre l’ordonnance d’exemple"
        variant="ghost"
        onPress={() =>
          Alert.alert('Remettre l’exemple ?', 'Le dossier actuel sera remplacé par l’ordonnance fictive de démonstration.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Remplacer', style: 'destructive', onPress: () => dispatch({ type: 'reset' }) },
          ])
        }
        style={{ marginTop: 10 }}
      />
      <ProfileSheet visible={profile} onClose={() => setProfile(false)} />
    </Screen>
  )
}
