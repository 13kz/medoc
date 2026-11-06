import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { IconName, Role } from './core'
import { JoinSheet } from './JoinSheet'
import { useSession } from './session'
import { emptyState, exampleState, readLocalDossier, writeLocalDossier } from './store'
import { C, ROLE_TONE } from './theme'
import { Icon } from './ui/Icon'
import { Btn, Field, T, tap } from './ui/kit'

const ROLES: { role: Role; icon: IconName; title: string; desc: string }[] = [
  { role: 'patient', icon: 'phone', title: 'Je prends le traitement', desc: 'Un seul écran : ce qu’il faut prendre maintenant, lu à voix haute.' },
  { role: 'aidant', icon: 'heart', title: 'J’accompagne un proche', desc: 'Je saisis l’ordonnance, je suis les prises, je suis prévenu en cas d’oubli.' },
  { role: 'medecin', icon: 'stethoscope', title: 'Je suis soignant', desc: 'Je suis l’observance de mes patients et je leur envoie des conseils.' },
]

/** Premier lancement : « Qui utilise ce téléphone ? », puis le dossier de départ. */
export function Onboarding() {
  const { start, addLink } = useSession()
  const insets = useSafeAreaInsets()
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [patientName, setPatientName] = useState('')
  const [joining, setJoining] = useState(false)
  const existing = readLocalDossier()

  const begin = (mode: 'keep' | 'empty' | 'example') => {
    if (!role) return
    if (mode === 'empty') writeLocalDossier(emptyState(role === 'patient' ? name.trim() || 'Moi' : patientName.trim() || 'Mon proche'))
    if (mode === 'example') writeLocalDossier(exampleState())
    start(role, name.trim() || (role === 'medecin' ? 'Docteur' : 'Moi'))
  }

  return (
    <ScrollView style={{ backgroundColor: C.night }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 }}>
      <View style={s.brand} accessible accessibilityLabel="Medoc">
        {(['#ffd43b', '#ff9f43', '#6cb4ff', '#b69cff'] as const).map((c, i) => (
          <View key={c} style={[s.brandLid, { backgroundColor: c, transform: [{ translateY: i % 2 ? 6 : 0 }] }]} />
        ))}
        <T size="xxl" bold style={{ marginLeft: 12 }}>
          medoc
        </T>
      </View>

      {!role ? (
        <>
          <T size="xl" bold style={{ marginTop: 28, marginBottom: 6 }} accessibilityRole="header">
            Qui utilise ce téléphone ?
          </T>
          <T size="md" color={C.muted} style={{ marginBottom: 20 }}>
            Chacun a son appli, pensée pour lui. On peut changer plus tard.
          </T>
          {ROLES.map((r) => (
            <Pressable
              key={r.role}
              accessibilityRole="button"
              accessibilityLabel={`${r.title}. ${r.desc}`}
              onPress={() => {
                tap()
                setRole(r.role)
              }}
              style={({ pressed }) => [s.role, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={[s.roleLid, { backgroundColor: ROLE_TONE[r.role] }]}>
                <Icon name={r.icon} size={30} color={C.ink} stroke={2.4} />
              </View>
              <View style={{ flex: 1, padding: 18 }}>
                <T size="lg" bold>
                  {r.title}
                </T>
                <T size="sm" color={C.muted} style={{ marginTop: 4 }}>
                  {r.desc}
                </T>
              </View>
            </Pressable>
          ))}
          <Btn label="J’ai un code d’invitation" icon="key" variant="ghost" onPress={() => setJoining(true)} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour au choix du profil" onPress={() => setRole(null)} style={{ marginTop: 24, minHeight: 48, justifyContent: 'center' }}>
            <T size="sm" bold color={C.muted}>
              ‹ Changer de profil
            </T>
          </Pressable>
          <T size="xl" bold color={ROLE_TONE[role]} style={{ marginBottom: 16 }} accessibilityRole="header">
            {ROLES.find((r) => r.role === role)!.title}
          </T>
          <Field
            label={role === 'patient' ? 'Comment vous appeler ?' : role === 'aidant' ? 'Votre prénom' : 'Votre nom'}
            value={name}
            onChange={setName}
            placeholder={role === 'patient' ? 'Ex. Mireille' : role === 'aidant' ? 'Ex. Karim' : 'Ex. Dr Martin'}
            autoCap="words"
          />
          {role === 'aidant' && !existing && <Field label="Le prénom de votre proche, tel qu’il l’entendra" value={patientName} onChange={setPatientName} placeholder="Ex. Maman" autoCap="words" />}

          {role === 'medecin' ? (
            <Btn label="Commencer" icon="chevron" size="lg" tone={ROLE_TONE.medecin} onPress={() => begin('keep')} />
          ) : (
            <View style={{ gap: 12 }}>
              {existing && <Btn label={`Reprendre le dossier de ${existing.patient.name}`} icon="chevron" size="lg" tone={ROLE_TONE[role]} onPress={() => begin('keep')} />}
              <Btn label="Commencer un dossier vide" icon="plus" size={existing ? 'md' : 'lg'} tone={existing ? C.paper : ROLE_TONE[role]} onPress={() => begin('empty')} />
              <Btn label="Essayer avec une ordonnance d’exemple" icon="play" variant="ghost" onPress={() => begin('example')} />
            </View>
          )}
        </>
      )}

      <JoinSheet
        visible={joining}
        onClose={() => setJoining(false)}
        onJoined={(l) => {
          setJoining(false)
          addLink(l)
        }}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandLid: { width: 18, height: 30, borderRadius: 6, marginRight: 4 },
  role: { flexDirection: 'row', backgroundColor: C.night2, borderRadius: 26, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.line, minHeight: 110 },
  roleLid: { width: 72, alignItems: 'center', justifyContent: 'center' },
})
