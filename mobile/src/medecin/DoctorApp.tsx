import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetch as expoFetch } from 'expo/fetch'
import {
  adherence,
  fetchDossier,
  formatTime,
  missedByMed,
  reducer,
  refills,
  rhythmLabel,
  SAMPLE_PATIENTS,
  sampleWeek,
  shortDate,
  simulatedNow,
  spokenTime,
  stockLabel,
  dayKey,
  weekGrid,
  type AppState,
  type Link,
  type SamplePatient,
  type WeekDay,
} from '../core'
import { JoinSheet } from '../JoinSheet'
import { useSession } from '../session'
import { DossierProvider, readLocalDossier, useStore } from '../store'
import { C, useU } from '../theme'
import { Backdrop } from '../ui/Backdrop'
import { Pill } from '../ui/Pill'
import { Reglette } from '../ui/Reglette'
import { Btn, Field, Kicker, T } from '../ui/kit'
import { Sheet } from '../ui/Sheet'
import { WeekGrid } from '../ui/WeekGrid'

type Row = { id: string; fullName: string; age: number; conditions: string[]; followers: string[]; week: WeekDay[]; attention: string[]; source: 'local' | 'link' | 'exemple'; link?: Link; sample?: SamplePatient }
type Tab = 'patients' | 'ajouter' | 'profil'

const f = expoFetch as unknown as typeof fetch

const rowFrom = (state: AppState, now: number, source: Row['source'], link?: Link): Row => ({
  id: link?.dossier ?? 'local',
  fullName: state.patient.fullName || state.patient.name,
  age: state.patient.age,
  conditions: state.patient.conditions,
  followers: state.contacts.map((c) => c.name),
  week: weekGrid(state, now),
  attention: missedByMed(state, now)
    .filter((m) => m.count >= 2)
    .map((m) => `${m.med.name.replace(/ \d.*$/, '')}, ${spokenTime(m.time)} : oublié ${m.count} fois sur 7`),
  source,
  link,
})

/** Une feuille de papier posée sur le bureau, comme le compte rendu du site. */
function Paper({ children, tilt = 0 }: { children: ReactNode; tilt?: number }) {
  return <View style={[s.paper, { transform: [{ rotate: `${tilt}deg` }] }]}>{children}</View>
}

/** Le pourcentage d'observance, en grand, en Fraunces. */
function Score({ value, size = 'giant' }: { value: number | null; size?: 'xxl' | 'giant' }) {
  const u = useU()
  return (
    <T size={size} face="display" accessibilityLabel={value === null ? 'Observance inconnue' : `${Math.round(value * 100)} pour cent des prises faites`}>
      {value === null ? '–' : Math.round(value * 100)}
      {value !== null && (
        <T size={size === 'giant' ? 'xl' : 'lg'} face="display" color={u.muted}>
          %
        </T>
      )}
    </T>
  )
}

/**
 * Le médecin, entre deux patients : quinze minutes de consultation, il lui faut des faits, pas un
 * journal. Un bureau, et une feuille par patient, triés du moins observant au plus observant.
 */
export function DoctorApp() {
  const { links, addLink, session, leave } = useSession()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('patients')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<Row | null>(null)
  const [joining, setJoining] = useState(false)
  const [now, setNow] = useState(Date.now())
  const mine = links.filter((l) => l.role === 'medecin')

  const load = useCallback(async () => {
    const real = Date.now()
    setNow(real)
    setLoading(true)
    const out: Row[] = []
    const local = readLocalDossier()
    if (local && local.medications.length > 0) out.push(rowFrom(local, simulatedNow(local.clock, real), 'local'))
    for (const l of mine) {
      try {
        out.push(rowFrom(await fetchDossier(l, reducer, f), real, 'link', l))
      } catch {
        // Hors réseau ou accès retiré : le dossier n'apparaît pas pour l'instant.
      }
    }
    if (mine.length === 0)
      for (const p of SAMPLE_PATIENTS) out.push({ id: p.id, fullName: p.fullName, age: p.age, conditions: p.conditions, followers: p.followers, week: sampleWeek(p, real), attention: p.attention, source: 'exemple', sample: p })
    out.sort((a, b) => (adherence(a.week) ?? 1) - (adherence(b.week) ?? 1))
    setRows(out)
    setLoading(false)
  }, [mine.map((l) => l.dossier).join(',')])
  useEffect(() => void load(), [load])

  const name = session?.name ?? 'Docteur'
  return (
    <Backdrop u="bureau">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.ink} />}>
        {tab === 'patients' && (
          <>
            <T size="lg" face="italic" color="#3d3528">
              {spokenTime(formatTime(now))} · {name}, entre deux patients.
            </T>
            <T size="xxl" face="display" style={{ marginBottom: 6 }} accessibilityRole="header">
              Mes patients
            </T>
            <T size="sm" color="#3d3528" style={{ marginBottom: 18 }}>
              {mine.length === 0 ? 'Patients d’exemple. Quand un patient ou un proche vous invite, son dossier remplace ces exemples.' : 'Du moins observant au plus observant, sur 7 jours.'}
            </T>
            {rows.map((r, i) => {
              const a = adherence(r.week)
              return (
                <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.fullName}, ${a === null ? 'observance inconnue' : Math.round(a * 100) + ' pour cent'}${r.attention.length ? '. À surveiller : ' + r.attention[0] : ''}`} onPress={() => setOpen(r)}>
                  <Paper tilt={i % 2 ? 0.5 : -0.4}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T size="lg" face="display">
                          {r.fullName}
                        </T>
                        <T size="xs" color={C.ink3}>
                          {[r.age ? `${r.age} ans` : null, ...r.conditions].filter(Boolean).join(' · ')}
                          {r.source === 'local' ? ' · sur ce téléphone' : ''}
                        </T>
                      </View>
                      <Score value={a} size="xxl" />
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <WeekGrid week={r.week} cell={30} labels={false} />
                    </View>
                    {r.attention[0] && (
                      <T size="md" face="italic" color={C.red} style={{ marginTop: 12 }}>
                        {r.attention[0]}
                      </T>
                    )}
                  </Paper>
                </Pressable>
              )
            })}
          </>
        )}
        {tab === 'ajouter' && (
          <Paper>
            <Kicker color={C.ink3}>Nouveau patient</Kicker>
            <T size="xxl" face="display" style={{ marginVertical: 8 }}>
              Ajouter un dossier
            </T>
            <T size="md" color={C.ink2} style={{ marginBottom: 18 }}>
              Le patient ou son proche vous invite depuis ses réglages (« Inviter : médecin ») et vous donne un code à 8 caractères.
            </T>
            <Btn label="J’ai un code" icon="key" size="lg" tone={C.ink} ink={C.porcelain} onPress={() => setJoining(true)} />
          </Paper>
        )}
        {tab === 'profil' && (
          <Paper>
            <Kicker color={C.ink3}>Cabinet</Kicker>
            <T size="xxl" face="display" style={{ marginVertical: 8 }}>
              {name}
            </T>
            <T size="md" color={C.ink2} style={{ marginBottom: 18 }}>
              {mine.length} dossier{mine.length > 1 ? 's' : ''} partagé{mine.length > 1 ? 's' : ''} avec vous.
            </T>
            <Btn label="Changer de profil" icon="reset" variant="ghost" onPress={leave} />
          </Paper>
        )}
      </ScrollView>
      <Reglette
        value={tab}
        onChange={setTab}
        now={now}
        who={name}
        items={[
          { key: 'patients', label: 'Patients', tone: C.matin },
          { key: 'ajouter', label: 'Ajouter', tone: C.midi },
          { key: 'profil', label: 'Cabinet', tone: C.soir },
        ]}
      />
      <JoinSheet visible={joining} onClose={() => setJoining(false)} onJoined={(l) => (setJoining(false), addLink(l), setTab('patients'))} defaultName={name} />
      {open && (
        <Sheet visible title="Compte rendu d’observance" onClose={() => (setOpen(null), void load())} u="bureau">
          {open.source === 'exemple' ? (
            <Report row={open} doctor={name} now={now} />
          ) : (
            <DossierProvider key={open.id} link={open.link ?? null}>
              <LiveReport doctor={name} />
            </DossierProvider>
          )}
        </Sheet>
      )}
    </Backdrop>
  )
}

/** Le compte rendu, sur sa feuille : en-tête du cabinet, le pourcentage, le semainier, les faits. */
function Report({ row, doctor, now, facts = [], notes, children }: { row: Row; doctor: string; now: number; facts?: { title: string; text: string }[]; notes?: AppState['notes']; children?: ReactNode }) {
  const from = new Date(now)
  from.setDate(from.getDate() - 6)
  const read = notes?.find((n) => n.acknowledged)
  return (
    <Paper>
      <Kicker color={C.ink3} style={{ fontSize: 13 }}>
        Cabinet de {doctor}
      </Kicker>
      {read && (
        <View style={s.stamp} accessibilityLabel="Lu par la patiente">
          <T size="xs" face="black" color={C.stamp} style={{ letterSpacing: 2 }}>
            LU PAR LA PATIENTE
          </T>
        </View>
      )}
      <View style={{ marginTop: 14, gap: 4 }}>
        {[
          ['Patient', `${row.fullName}${row.age ? `, ${row.age} ans` : ''}`],
          ['Période', `du ${shortDate(dayKey(from.getTime()))} au ${shortDate(dayKey(now))}`],
          ['Suivi par', row.followers.join(', ') || 'personne'],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
            <T size="sm" color={C.ink3} style={{ width: 84 }}>
              {k}
            </T>
            <T size="sm" bold style={{ flex: 1 }}>
              {v}
            </T>
          </View>
        ))}
      </View>
      <View style={s.rule} />
      <Score value={adherence(row.week)} />
      <T size="sm" color={C.ink3} style={{ marginBottom: 16 }}>
        des prises faites sur 7 jours
      </T>
      <WeekGrid week={row.week} cell={32} />
      <View style={{ marginTop: 18, gap: 12 }}>
        {row.attention.map((a) => (
          <View key={a} style={s.fact}>
            <T size="sm">{a}</T>
          </View>
        ))}
        {facts.map((f) => (
          <View key={f.title} style={s.fact}>
            <T size="sm">
              <T size="sm" bold>
                {f.title}
              </T>{' '}
              : {f.text}
            </T>
          </View>
        ))}
        {row.attention.length === 0 && facts.length === 0 && <T size="sm">Rien de particulier cette semaine.</T>}
      </View>
      {children}
    </Paper>
  )
}

/** Un vrai dossier (sur ce téléphone ou partagé) : le compte rendu, le traitement et les conseils. */
function LiveReport({ doctor }: { doctor: string }) {
  const { state, dispatch, now } = useStore()
  const [text, setText] = useState('')
  const row = rowFrom(state, now, 'local')
  const low = refills(state)
  return (
    <Report row={row} doctor={doctor} now={now} notes={state.notes} facts={low.map((m) => ({ title: m.name.replace(/ \d.*$/, ''), text: stockLabel(m).toLowerCase() }))}>
      <View style={s.rule} />
      <T size="lg" face="display" style={{ marginBottom: 8 }}>
        Traitement
      </T>
      {state.medications
        .filter((m) => m.active)
        .map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 }}>
            <Pill med={m} size={38} bg={C.paper} />
            <View style={{ flex: 1 }}>
              <T size="md" bold>
                {m.name}
              </T>
              <T size="xs" color={C.ink3}>
                {m.dose} · {m.asNeeded ? 'si besoin' : `${m.times.map(spokenTime).join(', ')} · ${rhythmLabel(m)}`}
              </T>
            </View>
          </View>
        ))}
      <View style={s.rule} />
      <T size="lg" face="display" style={{ marginBottom: 4 }}>
        Conseil au patient
      </T>
      <T size="sm" color={C.ink3} style={{ marginBottom: 10 }}>
        Affiché et lu sur le téléphone de {state.patient.name}, visible par ses proches.
      </T>
      {state.notes.slice(0, 4).map((n) => (
        <T key={n.id} size="lg" face="italic" color={C.red} style={{ marginBottom: 8 }}>
          « {n.text} »{' '}
          <T size="xs" color={C.ink3}>
            {n.acknowledged ? 'lu' : 'pas encore lu'}
          </T>
        </T>
      ))}
      <Field label="Nouveau conseil" value={text} onChange={setText} multiline placeholder="Ex. Gardez le collyre près de la brosse à dents." />
      <Btn
        label="Envoyer"
        icon="send"
        tone={C.ink}
        ink={C.porcelain}
        disabled={!text.trim()}
        onPress={() => {
          dispatch({ type: 'addNote', note: { id: `n-${now}`, at: new Date(now).toISOString(), from: doctor, text: text.trim(), acknowledged: false } })
          setText('')
        }}
      />
    </Report>
  )
}

const s = StyleSheet.create({
  paper: { backgroundColor: '#fbfaf6', borderRadius: 4, padding: 20, marginBottom: 18, shadowColor: '#3d3528', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  rule: { height: 2, backgroundColor: C.ink, marginVertical: 18 },
  fact: { borderTopWidth: 1, borderTopColor: 'rgba(20,32,26,0.14)', paddingTop: 8 },
  stamp: { alignSelf: 'flex-end', marginTop: 10, borderWidth: 3, borderColor: C.stamp, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-8deg' }] },
})
