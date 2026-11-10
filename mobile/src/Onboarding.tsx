import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { IconName, Role } from './core'
import { JoinSheet } from './JoinSheet'
import { useSession } from './session'
import { emptyState, exampleState, readLocalDossier, writeLocalDossier } from './store'
import { C, ROLE_TONE, U } from './theme'
import { Backdrop } from './ui/Backdrop'
import { Icon } from './ui/Icon'
import { Logo } from './ui/Reglette'
import { Btn, Field, Kicker, T, tap } from './ui/kit'

const u = U.nuit

const ROLES: { role: Role; icon: IconName; who: string; title: string; desc: string }[] = [
  { role: 'patient', icon: 'phone', who: 'La patiente', title: 'Je prends le traitement', desc: 'Une chose à la fois : ce qu’il faut prendre maintenant, lu à voix haute.' },
  { role: 'aidant', icon: 'heart', who: 'Les proches', title: 'J’accompagne un proche', desc: 'Je ne reçois pas tout. Je reçois ce qui compte.' },
  { role: 'medecin', icon: 'stethoscope', who: 'Le médecin', title: 'Je suis soignant', desc: 'Des faits, pas un journal : l’observance de la semaine en un coup d’œil.' },
]

/** Premier lancement : « Un pilulier, trois regards », puis le dossier de départ. */
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
    <Backdrop u="nuit">
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: insets.top + 26, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel="Medoc">
          <Logo size={26} />
          <T size="lg" face="displayBold">
            medoc
          </T>
        </View>

        {!role ? (
          <>
            <T size="giant" face="display" style={{ marginTop: 34 }} accessibilityRole="header">
              Un pilulier,
            </T>
            <T size="giant" face="italic" color={C.peach} style={{ marginTop: -6 }}>
              trois regards.
            </T>
            <T size="md" color={u.muted} style={{ marginTop: 14, marginBottom: 26 }}>
              Qui utilise ce téléphone ? Chacun a son appli, pensée pour lui. On peut changer plus tard.
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
                <View style={[s.lid, { backgroundColor: ROLE_TONE[r.role] }]}>
                  <Icon name={r.icon} size={20} color={C.ink} stroke={2.4} />
                  <T size="xs" face="black" color={C.ink} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    {r.who}
                  </T>
                </View>
                <View style={{ padding: 18, paddingTop: 14 }}>
                  <T size="xl" face="display">
                    {r.title}
                  </T>
                  <T size="sm" face="italic" color={u.muted} style={{ marginTop: 6, fontSize: 18, lineHeight: 23 }}>
                    {r.desc}
                  </T>
                </View>
              </Pressable>
            ))}
            <Btn label="J’ai un code d’invitation" icon="key" variant="ghost" onPress={() => setJoining(true)} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour au choix du profil" onPress={() => setRole(null)} style={{ marginTop: 26, minHeight: 48, justifyContent: 'center' }}>
              <Kicker>‹ Changer de profil</Kicker>
            </Pressable>
            <T size="xxl" face="display" style={{ marginBottom: 20 }} accessibilityRole="header">
              {ROLES.find((r) => r.role === role)!.title}
            </T>
            <Field
              label={role === 'patient' ? 'Comment vous appeler ?' : role === 'aidant' ? 'Votre prénom' : 'Votre nom'}
              value={name}
              onChange={setName}
              placeholder={role === 'patient' ? 'Ex. Mireille' : role === 'aidant' ? 'Ex. Naz' : 'Ex. Dr Martin'}
              autoCap="words"
            />
            {role === 'aidant' && !existing && <Field label="Le prénom de votre proche, tel qu’il l’entendra" value={patientName} onChange={setPatientName} placeholder="Ex. Maman" autoCap="words" />}

            {role === 'medecin' ? (
              <Btn label="Commencer" icon="chevron" size="lg" tone={ROLE_TONE.medecin} onPress={() => begin('keep')} />
            ) : (
              <View style={{ gap: 12 }}>
                {existing && <Btn label={`Reprendre le dossier de ${existing.patient.name}`} icon="chevron" size="lg" tone={ROLE_TONE[role]} onPress={() => begin('keep')} />}
                <Btn label="Commencer un dossier vide" icon="plus" size={existing ? 'md' : 'lg'} tone={existing ? C.porcelain : ROLE_TONE[role]} onPress={() => begin('empty')} />
                <Btn label="Essayer avec l’ordonnance de Mireille" icon="play" variant="ghost" onPress={() => begin('example')} />
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
    </Backdrop>
  )
}

const s = StyleSheet.create({
  role: { backgroundColor: C.night2, borderRadius: 26, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(244,241,234,0.1)' },
  lid: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
})
