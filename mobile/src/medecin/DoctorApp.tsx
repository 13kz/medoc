import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetch as expoFetch } from 'expo/fetch'
import {
  adherence,
  fetchDossier,
  missedByMed,
  reducer,
  rhythmLabel,
  SAMPLE_PATIENTS,
  sampleWeek,
  simulatedNow,
  spokenTime,
  weekGrid,
  type AppState,
  type Link,
  type SamplePatient,
  type WeekDay,
} from '../core'
import { JoinSheet } from '../JoinSheet'
import { useSession } from '../session'
import { DossierProvider, readLocalDossier, useStore } from '../store'
import { C, lid, ROLE_TONE } from '../theme'
import { Pill } from '../ui/Pill'
import { Pillbox } from '../ui/Pillbox'
import { Screen } from '../ui/Screen'
import { Btn, Card, Field, Label, T } from '../ui/kit'
import { Sheet } from '../ui/Sheet'
import { WeekGrid } from '../ui/WeekGrid'

type Row = { id: string; fullName: string; age: number; conditions: string[]; week: WeekDay[]; attention: string[]; source: 'local' | 'link' | 'exemple'; link?: Link; sample?: SamplePatient }
type Tab = 'patients' | 'rejoindre' | 'profil'

const f = expoFetch as unknown as typeof fetch

const rowFrom = (state: AppState, now: number, source: Row['source'], link?: Link): Row => {
  const week = weekGrid(state, now)
  return {
    id: link?.dossier ?? 'local',
    fullName: state.patient.fullName || state.patient.name,
    age: state.patient.age,
    conditions: state.patient.conditions,
    week,
    attention: missedByMed(state, now)
      .filter((m) => m.count >= 2)
      .map((m) => `${m.med.name} de ${spokenTime(m.time)} oublié ${m.count} fois sur 7`),
    source,
    link,
  }
}

/** La tablette ou le téléphone du médecin : ses patients, triés par observance. */
export function DoctorApp() {
  const { links, addLink, session, leave } = useSession()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('patients')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<Row | null>(null)
  const mine = links.filter((l) => l.role === 'medecin')

  const load = useCallback(async () => {
    const now = Date.now()
    setLoading(true)
    const out: Row[] = []
    const local = readLocalDossier()
    if (local && local.medications.length > 0) out.push(rowFrom(local, simulatedNow(local.clock, now), 'local'))
    for (const l of mine) {
      try {
        out.push(rowFrom(await fetchDossier(l, reducer, f), now, 'link', l))
      } catch {
        // Hors réseau ou accès retiré : le dossier n'apparaît pas pour l'instant.
      }
    }
    if (mine.length === 0)
      for (const p of SAMPLE_PATIENTS) out.push({ id: p.id, fullName: p.fullName, age: p.age, conditions: p.conditions, week: sampleWeek(p, now), attention: p.attention, source: 'exemple', sample: p })
    out.sort((a, b) => (adherence(a.week) ?? 1) - (adherence(b.week) ?? 1))
    setRows(out)
    setLoading(false)
  }, [mine.map((l) => l.dossier).join(',')])
  useEffect(() => void load(), [load])

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <View style={{ flex: 1 }}>
        {tab === 'patients' && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18 }}>
              <T size="sm" color={C.muted}>
                {session?.name}
              </T>
              <T size="xl" bold color={ROLE_TONE.medecin} accessibilityRole="header">
                Mes patients
              </T>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.paper} />}>
              {mine.length === 0 && (
                <T size="sm" color={C.muted} style={{ marginBottom: 12 }}>
                  Patients d’exemple. Quand un patient ou un proche vous invite, son dossier remplace ces exemples.
                </T>
              )}
              {rows.map((r) => {
                const a = adherence(r.week)
                return (
                  <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.fullName}, observance ${a === null ? 'inconnue' : Math.round(a * 100) + ' pour cent'}${r.attention.length ? '. À surveiller' : ''}`} onPress={() => setOpen(r)} style={s.patient}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <T size="md" bold>
                          {r.fullName}
                        </T>
                        <T size="xs" color={C.muted}>
                          {[r.age ? `${r.age} ans` : null, ...r.conditions].filter(Boolean).join(' · ')}
                          {r.source === 'local' ? ' · sur ce téléphone' : ''}
                        </T>
                      </View>
                      <View style={[s.score, { borderColor: a === null ? C.line : a >= 0.9 ? C.taken : a >= 0.75 ? lid('midi') : C.late }]}>
                        <T size="lg" bold>
                          {a === null ? '–' : `${Math.round(a * 100)}`}
                          <T size="xs" color={C.muted}>
                            {a === null ? '' : ' %'}
                          </T>
                        </T>
                      </View>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <WeekGrid week={r.week} cell={26} labels={false} />
                    </View>
                    {r.attention[0] && (
                      <T size="xs" color={C.late} style={{ marginTop: 10 }}>
                        {r.attention[0]}
                      </T>
                    )}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        )}
        {tab === 'rejoindre' && (
          <Screen title="Ajouter un patient" tone={ROLE_TONE.medecin}>
            <T size="md" color={C.muted} style={{ marginBottom: 16 }}>
              Le patient ou son proche vous invite depuis ses réglages (« Inviter : médecin ») et vous donne un code.
            </T>
            <JoinInline onJoined={(l) => (addLink(l), setTab('patients'))} name={session?.name ?? ''} />
          </Screen>
        )}
        {tab === 'profil' && (
          <Screen title="Profil" tone={ROLE_TONE.medecin}>
            <T size="lg" bold>
              {session?.name}
            </T>
            <T size="sm" color={C.muted} style={{ marginBottom: 20 }}>
              {mine.length} dossier{mine.length > 1 ? 's' : ''} partagé{mine.length > 1 ? 's' : ''} avec vous
            </T>
            <Btn label="Changer de profil" icon="reset" variant="ghost" onPress={leave} />
          </Screen>
        )}
      </View>
      <Pillbox
        value={tab}
        onChange={setTab}
        items={[
          { key: 'patients', label: 'Patients', icon: 'list', tone: lid('apres-midi') },
          { key: 'rejoindre', label: 'Ajouter', icon: 'key', tone: lid('soir') },
          { key: 'profil', label: 'Profil', icon: 'user', tone: lid('nuit') },
        ]}
      />
      {open && (
        <Sheet visible title={open.fullName} onClose={() => (setOpen(null), void load())}>
          {open.source === 'exemple' ? (
            <SampleDetail row={open} />
          ) : (
            <DossierProvider key={open.id} link={open.link ?? null}>
              <LiveDetail />
            </DossierProvider>
          )}
        </Sheet>
      )}
    </View>
  )
}

function JoinInline({ onJoined, name }: { onJoined: (l: Link) => void; name: string }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <Btn label="J’ai un code" icon="key" size="lg" tone={ROLE_TONE.medecin} onPress={() => setShow(true)} />
      <JoinSheet visible={show} onClose={() => setShow(false)} onJoined={(l) => (setShow(false), onJoined(l))} defaultName={name} />
    </>
  )
}

function SampleDetail({ row }: { row: Row }) {
  return (
    <>
      <T size="sm" color={C.muted}>
        {row.age} ans · {row.conditions.join(' · ')}
      </T>
      <T size="sm" color={C.muted}>
        Suivi par {row.sample?.followers.join(', ')}
      </T>
      <Label>Les 7 derniers jours</Label>
      <WeekGrid week={row.week} cell={38} />
      <Label>À surveiller</Label>
      {row.attention.length === 0 ? <T size="md">Rien de particulier.</T> : row.attention.map((a) => <T key={a} size="md" color={C.late}>• {a}</T>)}
      <T size="xs" color={C.muted} style={{ marginTop: 20 }}>
        Patient d’exemple : les conseils s’envoient aux vrais dossiers partagés.
      </T>
    </>
  )
}

/** Dossier réel (sur ce téléphone ou partagé) : semainier, oublis, traitement, conseils. */
function LiveDetail() {
  const { state, dispatch, now } = useStore()
  const { session } = useSession()
  const [text, setText] = useState('')
  const week = weekGrid(state, now)
  const missed = missedByMed(state, now)
  const a = adherence(week)
  return (
    <>
      <T size="sm" color={C.muted}>
        {[state.patient.age ? `${state.patient.age} ans` : null, ...state.patient.conditions].filter(Boolean).join(' · ')}
      </T>
      <T size="sm" color={C.muted}>
        Suivi par {state.contacts.map((c) => c.name).join(', ') || 'personne'}
      </T>
      <Label>Les 7 derniers jours{a === null ? '' : ` · ${Math.round(a * 100)} % des prises faites`}</Label>
      <WeekGrid week={week} cell={38} />
      <Label>Oublis répétés</Label>
      {missed.length === 0 ? (
        <T size="md">Aucun oubli cette semaine.</T>
      ) : (
        missed.slice(0, 5).map((m) => (
          <T key={`${m.med.id}${m.time}`} size="md" color={m.count >= 2 ? C.late : C.text}>
            {m.med.name} de {spokenTime(m.time)} : {m.count} fois
          </T>
        ))
      )}
      <Label>Traitement</Label>
      {state.medications
        .filter((m) => m.active)
        .map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }}>
            <Pill med={m} size={40} />
            <View style={{ flex: 1 }}>
              <T size="md" bold>
                {m.name}
              </T>
              <T size="xs" color={C.muted}>
                {m.dose} · {m.asNeeded ? 'si besoin' : `${m.times.map(spokenTime).join(', ')} · ${rhythmLabel(m)}`}
              </T>
            </View>
          </View>
        ))}
      <Label>Conseil au patient</Label>
      <T size="sm" color={C.muted} style={{ marginBottom: 10 }}>
        Affiché et lu sur le téléphone de {state.patient.name}, visible par ses proches.
      </T>
      <Field label="Message" value={text} onChange={setText} multiline placeholder="Ex. Prenez l’insuline avant le coucher, même si vous avez peu mangé." />
      <Btn
        label="Envoyer"
        icon="send"
        tone={ROLE_TONE.medecin}
        disabled={!text.trim()}
        onPress={() => {
          dispatch({ type: 'addNote', note: { id: `n-${now}`, at: new Date(now).toISOString(), from: session?.name ?? 'Votre médecin', text: text.trim(), acknowledged: false } })
          setText('')
        }}
      />
      {state.notes.slice(0, 5).map((n) => (
        <Card key={n.id} style={{ marginTop: 12 }}>
          <T size="xs" color={C.muted}>
            {n.from} · {new Date(n.at).toLocaleDateString('fr-FR')} · {n.acknowledged ? 'lu par le patient' : 'pas encore lu'}
          </T>
          <T size="sm">{n.text}</T>
        </Card>
      ))}
    </>
  )
}

const s = StyleSheet.create({
  patient: { backgroundColor: C.night2, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  score: { width: 72, height: 56, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
})

