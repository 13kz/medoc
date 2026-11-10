import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  announce,
  asNeededAdvice,
  asNeededMeds,
  asNeededStatus,
  changeSentence,
  daySummary,
  describeDose,
  dosesForDay,
  formatTime,
  MOMENTS,
  momentOf,
  nextUpcoming,
  pendingNow,
  spokenTime,
  tv,
  type Dose,
  type Medication,
} from '../core'
import { ProfileSheet } from '../ProfileSheet'
import { buzz, speak, stopSpeaking, success } from '../speech'
import { useStore } from '../store'
import { C, U, UniverseContext, useU, type Universe } from '../theme'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'
import { Btn, IconBtn, Kicker, T, tap } from '../ui/kit'
import { TakeButton } from './TakeButton'

/** Le nom sans le dosage : « Metformine » plutôt que « Metformine 1000 mg ». */
const short = (name: string) => name.replace(/ \d.*$/, '')

/**
 * Le téléphone de la patiente : « une chose à la fois », comme sur le site.
 * Pas de statistiques, pas d'alertes, pas de stock : seulement le geste à faire maintenant.
 * Trois affichages, choisis par le proche : gros caractères (jaune sur noir), voix d'abord, standard.
 */
export function PatientApp() {
  const { state } = useStore()
  const mode = state.patient.displayMode
  const u: Universe = mode === 'standard' ? U.clair : mode === 'voix' ? U.voix : U.patiente
  return (
    <UniverseContext.Provider value={u}>
      <View style={{ flex: 1, backgroundColor: u.bg }}>
        <PatientScreen />
      </View>
    </UniverseContext.Provider>
  )
}

function PatientScreen() {
  const { state, dispatch, now } = useStore()
  const u = useU()
  const { patient, settings } = state
  const insets = useSafeAreaInsets()
  const doses = dosesForDay(state, now)
  const pending = pendingNow(doses)
  const next = nextUpcoming(doses)
  const mode = patient.displayMode
  const [done, setDone] = useState<{ text: string; undo: () => void } | null>(null)
  const [profile, setProfile] = useState(false)

  // Avec VoiceOver ou TalkBack, l'appli ne parle pas elle-même : elle laisse le lecteur d'écran lire.
  const say = (text: string) => {
    if (!patient.screenReader) speak(text, patient.voiceRate)
  }

  // Annonce dès qu'une prise devient due, puis à nouveau si elle passe en retard.
  const announced = useRef(new Map<string, Dose['status']>())
  const signature = pending.map((d) => `${d.key}:${d.status}`).join(',')
  useEffect(() => {
    const fresh = pending.filter((d) => announced.current.get(d.key) !== d.status)
    for (const d of pending) announced.current.set(d.key, d.status)
    if (fresh.length === 0) return
    buzz()
    if (patient.autoRead || mode === 'voix') {
      const late = fresh.every((d) => d.status === 'en-retard')
      const prefix = late ? tv(patient, 'Rappel. Tu n’as pas encore pris tes médicaments. ', 'Rappel. Vous n’avez pas encore pris vos médicaments. ') : ''
      say(prefix + announce(patient, pending, now))
    }
  }, [signature])

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setDone(null), 5000)
    return () => clearTimeout(id)
  }, [done])

  useEffect(() => () => void stopSpeaking(), [])

  // « J'ai pris » coche tout ce qui est dû maintenant, comme le geste réel devant le pilulier.
  const takeAll = () => {
    const keys = pending.map((d) => d.key)
    for (const k of keys) dispatch({ type: 'take', doseKey: k, by: 'patient', at: now })
    success()
    const rest = next ? ` Prochaine prise à ${spokenTime(next.time)}.` : ''
    setDone({ text: 'C’est noté. Bravo !', undo: () => keys.forEach((k) => dispatch({ type: 'untake', doseKey: k })) })
    say(`C’est noté. Bravo !${rest}`)
  }
  const takeOne = (d: Dose) => {
    dispatch({ type: 'take', doseKey: d.key, by: 'patient', at: now })
    success()
    setDone({ text: `${short(d.med.name)} : c’est noté`, undo: () => dispatch({ type: 'untake', doseKey: d.key }) })
    say(`C’est noté. ${describeDose(d)}`)
  }
  const later = () => {
    for (const d of pending) {
      dispatch({ type: 'snooze', doseKey: d.key, until: now + settings.snoozeMin * 60000 })
      announced.current.delete(d.key)
    }
    say(tv(patient, `D’accord, je te le redis dans ${settings.snoozeMin} minutes.`, `D’accord, je vous le redis dans ${settings.snoozeMin} minutes.`))
  }
  const takePrn = (med: Medication) => {
    const status = asNeededStatus(state, med, now)
    if (!status.allowed) return say(asNeededAdvice(patient, med, status, now))
    const id = `${med.id}|${now}`
    const intake = { id, medId: med.id, takenAt: new Date(now).toISOString(), by: 'patient' as const, early: false }
    dispatch({ type: 'takeAsNeeded', intake })
    success()
    setDone({ text: `${short(med.name)} : c’est noté`, undo: () => dispatch({ type: 'untakeAsNeeded', id }) })
    say(asNeededAdvice(patient, med, asNeededStatus({ ...state, asNeededIntakes: [intake, ...state.asNeededIntakes] }, med, now), now))
  }
  const listen = () =>
    say(pending.length ? announce(patient, pending, now) : next ? `${tv(patient, 'Tu n’as', 'Vous n’avez')} rien à prendre maintenant. Prochaine prise à ${spokenTime(next.time)} : ${short(next.med.name)}.` : daySummary(patient, doses))
  const hint = () => say(tv(patient, 'Appuie longtemps sur le bouton pour confirmer.', 'Appuyez longtemps sur le bouton pour confirmer.'))

  // Messages du médecin et changements de traitement : à entendre et confirmer, quand rien n'est dû.
  const note = state.notes.find((n) => !n.acknowledged)
  const change = state.changes.find((c) => !c.acknowledged)
  const message = !pending.length && (note || change)
    ? note
      ? { from: `Message de ${note.from}`, text: note.text, ack: () => dispatch({ type: 'ackNote', id: note.id }) }
      : { from: 'Votre traitement change', text: changeSentence(patient, change!), ack: () => dispatch({ type: 'ackChange', id: change!.id }) }
    : null
  const prn = asNeededMeds(state)
  const late = pending.some((d) => d.status === 'en-retard')

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 8 }}>
      <View style={s.top}>
        <T size="lg" face="black" style={{ flex: 1 }}>
          Bonjour {patient.name}
        </T>
        <T size="xl" face="black" accessibilityLabel={`Il est ${spokenTime(formatTime(now))}`}>
          {spokenTime(formatTime(now))}
        </T>
        <IconBtn icon="user" label="Ce téléphone" onPress={() => setProfile(true)} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 16, flexGrow: 1 }}>
        {message && (
          <View style={[s.msg, { borderColor: u.cardLine, backgroundColor: u.card }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="stethoscope" size={22} color={u.muted} />
              <Kicker>{message.from}</Kicker>
            </View>
            <T size="xl" face="bold">
              {message.text}
            </T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Écouter" icon="speaker" variant="ghost" onPress={() => say(message.text)} style={{ flex: 1 }} />
              <Btn label="J’ai compris" onPress={message.ack} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {mode === 'voix' ? (
          <View style={{ flex: 1, gap: 14, minHeight: 440 }}>
            <Kicker>{pending.length ? `${pending.length} médicament${pending.length > 1 ? 's' : ''} à prendre` : next ? `Prochaine prise à ${spokenTime(next.time)}` : 'Journée terminée'}</Kicker>
            <Pressable accessibilityRole="button" accessibilityLabel="Répéter" onPress={() => (tap(), listen())} style={({ pressed }) => [s.zone, { backgroundColor: u.card, borderColor: u.cardLine }, pressed && { opacity: 0.8 }]}>
              <Icon name="speaker" size={84} stroke={2.4} />
              <T size="xxl" face="black">
                Répéter
              </T>
            </Pressable>
            {pending.length > 0 && (
              <TakeButton label="C’est pris" onTake={takeAll} onHint={hint} screenReader={patient.screenReader} grow />
            )}
            {pending.length > 0 && <Btn label="Plus tard" icon="snooze" variant="ghost" size="lg" onPress={later} />}
          </View>
        ) : pending.length > 0 ? (
          <>
            <Kicker>{late ? 'Un peu en retard' : 'C’est l’heure'}</Kicker>
            {pending.map((d) => (
              <View key={d.key} style={[s.med, { backgroundColor: u.card, borderColor: u.cardLine }]} accessible accessibilityLabel={describeDose(d)}>
                <Pill med={d.med} size={mode === 'malvoyant' ? 84 : 72} photo />
                <View style={{ flex: 1 }}>
                  <T size={mode === 'malvoyant' ? 'xl' : 'lg'} face="black">
                    {short(d.med.name)}
                  </T>
                  <T size="md" face="bold">
                    {[d.med.dose, d.med.instructions?.toLowerCase()].filter(Boolean).join(' · ')}
                  </T>
                </View>
              </View>
            ))}
            <TakeButton onTake={takeAll} onHint={hint} screenReader={patient.screenReader} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label="Plus tard" icon="snooze" variant="ghost" onPress={later} style={{ flex: 1 }} />
              <Btn label="Écouter" icon="speaker" variant="ghost" onPress={listen} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          !message && (
            <View style={{ gap: 14, alignItems: 'flex-start' }}>
              <Kicker>Rien à prendre maintenant</Kicker>
              {next ? (
                <>
                  <T size="giant" face="black" accessibilityLabel={`Prochaine prise à ${spokenTime(next.time)}`}>
                    {spokenTime(next.time)}
                  </T>
                  <Pill med={next.med} size={84} photo />
                  <T size="lg" face="bold">
                    Prochaine prise : {short(next.med.name)}
                    {next.status === 'reporte' ? ' (reportée)' : ''}
                  </T>
                </>
              ) : (
                <T size="xl" face="bold">
                  {doses.length ? 'Tout est pris pour aujourd’hui. Bravo !' : 'Aucun médicament prévu aujourd’hui.'}
                </T>
              )}
              <Btn label="Ma journée" icon="speaker" variant="ghost" onPress={() => say(daySummary(patient, doses))} />
            </View>
          )
        )}

        {mode === 'standard' && <DayList doses={doses} onTake={takeOne} />}
        {mode !== 'voix' && prn.length > 0 && <PrnList meds={prn} onTake={takePrn} />}
      </ScrollView>

      <DayDots doses={doses} />

      {done && (
        <View style={[s.done, { bottom: insets.bottom + 90 }]} accessibilityLiveRegion="polite">
          <View style={s.ring}>
            <Icon name="check" size={30} color={C.ink} stroke={3} />
          </View>
          <T size="lg" face="black" color={C.ink} style={{ flex: 1 }}>
            {done.text}
          </T>
          <Btn label="Annuler" variant="solid" tone={C.ink} ink="#fff" onPress={() => (done.undo(), setDone(null), say('C’est annulé.'))} />
        </View>
      )}
      <ProfileSheet visible={profile} onClose={() => setProfile(false)} />
    </View>
  )
}

/** En bas de l'écran, les couvercles de la journée se cochent au fil des prises. */
function DayDots({ doses }: { doses: Dose[] }) {
  const u = useU()
  const moments = MOMENTS.filter((m) => doses.some((d) => momentOf(d.time) === m.id))
  if (!moments.length) return null
  return (
    <View style={s.dots} accessibilityLabel="Ma journée" accessible>
      {moments.map((m) => {
        const ok = doses.filter((d) => momentOf(d.time) === m.id).every((d) => d.status === 'pris')
        return (
          <View key={m.id} style={{ alignItems: 'center', gap: 4, flex: 1 }} accessibilityLabel={`${m.label} : ${ok ? 'fait' : 'à faire'}`}>
            <View style={[s.dot, { backgroundColor: ok ? m.tone : 'transparent', borderColor: m.tone }]}>{ok && <Icon name="check" size={20} color={C.ink} stroke={3} />}</View>
            <T size="xs" bold color={u.muted}>
              {m.label}
            </T>
          </View>
        )
      })}
    </View>
  )
}

function DayList({ doses, onTake }: { doses: Dose[]; onTake: (d: Dose) => void }) {
  const u = useU()
  return (
    <View style={{ marginTop: 10 }}>
      <Kicker style={{ marginBottom: 6 }}>Ma journée</Kicker>
      {doses.map((d) => {
        const taken = d.status === 'pris'
        const tone = MOMENTS.find((m) => m.id === momentOf(d.time))!.tone
        return (
          <Pressable
            key={d.key}
            disabled={taken || d.status === 'a-venir'}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: taken, disabled: d.status === 'a-venir' }}
            accessibilityLabel={`${spokenTime(d.time)}, ${d.med.name}${taken ? ', pris' : ''}`}
            onPress={() => onTake(d)}
            style={[s.listRow, { borderBottomColor: u.line }]}
          >
            <View style={[s.check, { borderColor: tone }, taken && { backgroundColor: tone }]}>{taken && <Icon name="check" size={20} color={C.ink} stroke={3} />}</View>
            <T size="md" face="black" style={{ width: 78 }}>
              {spokenTime(d.time)}
            </T>
            <T size="md" style={[{ flex: 1 }, taken && { textDecorationLine: 'line-through', opacity: 0.6 }]}>
              {d.med.name}
            </T>
          </Pressable>
        )
      })}
    </View>
  )
}

function PrnList({ meds, onTake }: { meds: Medication[]; onTake: (m: Medication) => void }) {
  const u = useU()
  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      <Kicker>Si besoin</Kicker>
      {meds.map((m) => (
        <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`J’ai pris ${m.name}`} onPress={() => onTake(m)} style={[s.med, { backgroundColor: u.card, borderColor: u.cardLine, paddingVertical: 10 }]}>
          <Pill med={m} size={48} />
          <T size="md" face="bold" style={{ flex: 1 }}>
            {short(m.name)}
          </T>
          <T size="sm" face="black">
            J’en prends
          </T>
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  msg: { borderRadius: 26, borderWidth: 2, padding: 20, gap: 14 },
  med: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 26, borderWidth: 2 },
  zone: { flex: 1, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 180 },
  dots: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10 },
  dot: { width: 40, height: 26, borderRadius: 8, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1 },
  check: { width: 36, height: 36, borderRadius: 10, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  done: { position: 'absolute', left: 16, right: 16, backgroundColor: C.mint, borderRadius: 26, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
})
