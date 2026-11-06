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
  momentInfo,
  momentOf,
  nextUpcoming,
  pendingNow,
  spokenTime,
  tv,
  type Dose,
  type Medication,
} from '../core'
import { useStore } from '../store'
import { buzz, speak, stopSpeaking, success } from '../speech'
import { C } from '../theme'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'
import { Btn, IconBtn, T, tap } from '../ui/kit'
import { ProfileSheet } from '../ProfileSheet'

const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

type Flash = { text: string; undoKey?: string; undoPrn?: string }

/**
 * Le téléphone du patient. Une chose à la fois, en très grand, et tout ce qui s'affiche peut aussi
 * s'entendre. Trois affichages choisis par l'aidant : voix d'abord, gros caractères, standard.
 */
export function PatientApp() {
  const { state, dispatch, now } = useStore()
  const { patient, settings } = state
  const insets = useSafeAreaInsets()
  const doses = dosesForDay(state, now)
  const pending = pendingNow(doses)
  const next = nextUpcoming(doses)
  const mode = patient.displayMode
  const hi = mode === 'malvoyant'
  const fg = hi ? C.hiFg : C.text
  const bg = hi ? C.hiBg : C.night
  const [flash, setFlash] = useState<Flash | null>(null)
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
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 6000)
    return () => clearTimeout(id)
  }, [flash])

  useEffect(() => () => void stopSpeaking(), [])

  const afterTake = (taken: Dose) => {
    const rest = pending.filter((d) => d.key !== taken.key)
    if (rest.length > 0) return `C’est noté. Ensuite : ${describeDose(rest[0])}`
    if (next) return `C’est noté. Prochaine prise à ${spokenTime(next.time)}.`
    return `C’est noté. ${daySummary(patient, doses.map((d): Dose => (d.key === taken.key ? { ...d, status: 'pris' } : d)))}`
  }

  const take = (dose: Dose) => {
    dispatch({ type: 'take', doseKey: dose.key, by: 'patient', at: now })
    success()
    setFlash({ text: `${dose.med.name} : c’est noté`, undoKey: dose.key })
    say(afterTake(dose))
  }

  const later = (dose: Dose) => {
    dispatch({ type: 'snooze', doseKey: dose.key, until: now + settings.snoozeMin * 60000 })
    announced.current.delete(dose.key)
    setFlash({ text: `Rappel dans ${settings.snoozeMin} minutes` })
    say(`D’accord, je ${tv(patient, 'te', 'vous')} le rappelle dans ${settings.snoozeMin} minutes.`)
  }

  const takePrn = (med: Medication) => {
    const status = asNeededStatus(state, med, now)
    if (!status.allowed) return say(asNeededAdvice(patient, med, status, now))
    const id = `${med.id}|${now}`
    dispatch({ type: 'takeAsNeeded', intake: { id, medId: med.id, takenAt: new Date(now).toISOString(), by: 'patient', early: false } })
    success()
    setFlash({ text: `${med.name} : c’est noté`, undoPrn: id })
    say(asNeededAdvice(patient, med, asNeededStatus({ ...state, asNeededIntakes: [{ id, medId: med.id, takenAt: new Date(now).toISOString(), by: 'patient', early: false }, ...state.asNeededIntakes] }, med, now), now))
  }

  const undo = () => {
    if (flash?.undoKey) dispatch({ type: 'untake', doseKey: flash.undoKey })
    if (flash?.undoPrn) dispatch({ type: 'untakeAsNeeded', id: flash.undoPrn })
    setFlash(null)
    say('C’est annulé.')
  }

  const nothingNow = () =>
    next ? `${tv(patient, 'Tu n’as', 'Vous n’avez')} rien à prendre maintenant. Prochaine prise à ${spokenTime(next.time)} : ${next.med.name}.` : daySummary(patient, doses)
  const repeat = () => say(pending.length ? announce(patient, pending, now) : nothingNow())

  // Messages du médecin et changements de traitement : à entendre et confirmer avant le reste.
  const note = state.notes.find((n) => !n.acknowledged)
  const change = state.changes.find((c) => !c.acknowledged)
  const message = note
    ? { title: `Message de ${note.from}`, text: note.text, ack: () => dispatch({ type: 'ackNote', id: note.id }) }
    : change
      ? { title: 'Votre traitement a changé', text: changeSentence(patient, change), ack: () => dispatch({ type: 'ackChange', id: change.id }) }
      : null

  const first = pending[0]
  const prn = asNeededMeds(state)

  const top = (
    <View style={[s.top, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }} accessible accessibilityLabel={`Il est ${spokenTime(formatTime(now))}, ${DATE.format(now)}`}>
        <T size="xxl" bold color={fg}>
          {spokenTime(formatTime(now))}
        </T>
        <T size="sm" color={hi ? C.hiFg : C.muted}>
          {DATE.format(now)}
        </T>
      </View>
      <IconBtn icon="speaker" label="Écouter ce qu’il faut prendre" onPress={repeat} bg={hi ? '#222' : C.night3} color={fg} />
      <IconBtn icon="user" label="Mon profil" onPress={() => setProfile(true)} bg={hi ? '#222' : C.night3} color={fg} />
    </View>
  )

  let body
  if (message) {
    body = (
      <View style={[s.center, { gap: 20 }]}>
        <T size="lg" bold color={fg} accessibilityRole="header">
          {message.title}
        </T>
        <T size={hi ? 'xl' : 'lg'} color={fg}>
          {message.text}
        </T>
        <Btn label="Écouter" icon="speaker" variant="ghost" size="lg" onPress={() => say(`${message.title}. ${message.text}`)} />
        <Btn label="J’ai compris" icon="check" size="xl" tone={hi ? C.hiFg : C.taken} onPress={message.ack} />
      </View>
    )
  } else if (mode === 'voix') {
    // Deux zones géantes : impossible de les manquer, même sans voir.
    body = (
      <View style={{ flex: 1, gap: 12, paddingBottom: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={first ? `C’est pris. ${describeDose(first)}` : 'Qu’est-ce que je dois prendre ?'}
          onPress={() => {
            tap()
            first ? take(first) : say(nothingNow())
          }}
          style={({ pressed }) => [s.zone, { backgroundColor: first ? C.taken : C.night3 }, pressed && { opacity: 0.85 }]}
        >
          <Icon name={first ? 'check' : 'info'} size={88} color={first ? C.ink : C.text} stroke={2.6} />
          <T size="xxl" bold color={first ? C.ink : C.text} style={{ textAlign: 'center' }}>
            {first ? 'C’est pris' : 'Rien à prendre'}
          </T>
          {first && (
            <T size="lg" color={C.ink} style={{ textAlign: 'center' }}>
              {first.med.name}
            </T>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Répéter"
          onPress={() => {
            tap()
            repeat()
          }}
          style={({ pressed }) => [s.zone, { backgroundColor: C.paper }, pressed && { opacity: 0.85 }]}
        >
          <Icon name="speaker" size={80} color={C.ink} stroke={2.6} />
          <T size="xxl" bold color={C.ink}>
            Répéter
          </T>
        </Pressable>
        {first && <Btn label="Plus tard" icon="snooze" variant="ghost" size="lg" onPress={() => later(first)} />}
      </View>
    )
  } else if (first) {
    const m = momentInfo(first.time)
    body = (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <NowCard dose={first} hi={hi} count={pending.length} lid={m.tone} label={m.label} />
        <Btn label="J’ai pris" icon="check" size="xl" tone={hi ? C.hiFg : C.taken} onPress={() => take(first)} hint={describeDose(first)} />
        <Btn label="Plus tard" icon="snooze" variant="ghost" size="lg" onPress={() => later(first)} style={{ marginTop: 12 }} />
        {mode === 'standard' && <DayBox doses={doses} now={now} onTake={take} />}
        {mode === 'standard' && prn.length > 0 && <PrnList meds={prn} onTake={takePrn} />}
      </ScrollView>
    )
  } else {
    body = (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[s.rest, hi && { borderColor: C.hiFg, backgroundColor: '#000' }]}>
          <Icon name="check" size={56} color={hi ? C.hiFg : C.taken} stroke={2.6} />
          <T size={hi ? 'xxl' : 'xl'} bold color={fg} style={{ textAlign: 'center' }}>
            Rien à prendre maintenant
          </T>
          {next ? (
            <T size={hi ? 'xl' : 'lg'} color={fg} style={{ textAlign: 'center' }}>
              Prochaine prise à {spokenTime(next.time)}
              {'\n'}
              {next.med.name}
            </T>
          ) : (
            <T size="lg" color={fg} style={{ textAlign: 'center' }}>
              {doses.length ? 'Tout est pris pour aujourd’hui. Bravo !' : 'Aucun médicament prévu aujourd’hui.'}
            </T>
          )}
        </View>
        {mode === 'standard' && <DayBox doses={doses} now={now} onTake={take} />}
        {prn.length > 0 && <PrnList meds={prn} onTake={takePrn} hi={hi} />}
      </ScrollView>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {top}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: insets.bottom }}>{body}</View>
      {flash && (
        <View style={[s.flash, { bottom: insets.bottom + 16 }]} accessibilityLiveRegion="polite">
          <T size="md" bold color={C.ink} style={{ flex: 1 }}>
            {flash.text}
          </T>
          {(flash.undoKey || flash.undoPrn) && <Btn label="Annuler" onPress={undo} tone={C.ink} ink={C.paper} />}
        </View>
      )}
      <ProfileSheet visible={profile} onClose={() => setProfile(false)} />
    </View>
  )
}

/** La carte « Maintenant » : un médicament, dessiné en grand, avec son couvercle de pilulier. */
function NowCard({ dose, hi, count, lid, label }: { dose: Dose; hi: boolean; count: number; lid: string; label: string }) {
  const fg = hi ? C.hiFg : C.ink
  const late = dose.status === 'en-retard'
  return (
    <View style={[s.now, { backgroundColor: hi ? '#000' : C.paper, borderColor: hi ? C.hiFg : lid }]} accessible accessibilityLabel={`${late ? 'En retard. ' : ''}${label}, ${spokenTime(dose.time)}. ${describeDose(dose)}`}>
      <View style={[s.nowLid, { backgroundColor: hi ? C.hiFg : lid }]}>
        <T size="md" bold color={C.ink}>
          {label} · {spokenTime(dose.time)}
        </T>
        {count > 1 && (
          <T size="sm" bold color={C.ink}>
            1 sur {count}
          </T>
        )}
      </View>
      <View style={{ padding: 20, alignItems: 'center', gap: 10 }}>
        <Pill med={dose.med} size={hi ? 132 : 112} photo bg={hi ? '#111' : C.paper2} />
        <T size={hi ? 'giant' : 'xxl'} bold color={fg} style={{ textAlign: 'center' }}>
          {dose.med.name}
        </T>
        <T size={hi ? 'xl' : 'lg'} color={fg} style={{ textAlign: 'center' }}>
          {dose.med.dose}
        </T>
        {!!dose.med.instructions && (
          <T size={hi ? 'lg' : 'md'} color={hi ? C.hiFg : '#3d4743'} style={{ textAlign: 'center' }}>
            {dose.med.instructions}
          </T>
        )}
        {late && (
          <T size="md" bold color={hi ? C.hiFg : '#b3261e'}>
            En retard
          </T>
        )}
      </View>
    </View>
  )
}

/** Le pilulier du jour : une case par moment, cochée au fil des prises. */
function DayBox({ doses, now, onTake }: { doses: Dose[]; now: number; onTake: (d: Dose) => void }) {
  const moments = MOMENTS.filter((m) => doses.some((d) => momentOf(d.time) === m.id))
  if (moments.length === 0) return null
  const current = momentOf(formatTime(now))
  return (
    <View style={{ marginTop: 28 }}>
      <T size="sm" bold color={C.muted} accessibilityRole="header" style={{ marginBottom: 10 }}>
        Ma journée
      </T>
      {moments.map((m) => {
        const items = doses.filter((d) => momentOf(d.time) === m.id)
        const done = items.every((d) => d.status === 'pris')
        return (
          <View key={m.id} style={[s.slot, m.id === current && { borderColor: m.tone }]}>
            <View style={[s.slotLid, { backgroundColor: done ? C.night3 : m.tone }]}>
              <Icon name={done ? 'check' : m.icon} size={22} color={done ? C.taken : C.ink} />
              <T size="sm" bold color={done ? C.taken : C.ink}>
                {m.label}
              </T>
            </View>
            {items.map((d) => {
              const taken = d.status === 'pris'
              return (
                <Pressable
                  key={d.key}
                  disabled={taken || d.status === 'a-venir'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: taken, disabled: d.status === 'a-venir' }}
                  accessibilityLabel={`${spokenTime(d.time)}, ${d.med.name}, ${d.med.dose}${taken ? ', pris' : d.status === 'a-venir' ? ', plus tard' : ''}`}
                  onPress={() => onTake(d)}
                  style={s.slotRow}
                >
                  <Pill med={d.med} size={44} />
                  <View style={{ flex: 1 }}>
                    <T size="md" bold color={taken ? C.muted : C.text} style={taken && { textDecorationLine: 'line-through' }}>
                      {d.med.name}
                    </T>
                    <T size="sm" color={C.muted}>
                      {spokenTime(d.time)} · {d.med.dose}
                    </T>
                  </View>
                  <View style={[s.check, taken && { backgroundColor: C.taken, borderColor: C.taken }, d.status === 'en-retard' && { borderColor: C.late }]}>{taken && <Icon name="check" size={22} color={C.ink} stroke={3} />}</View>
                </Pressable>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

function PrnList({ meds, onTake, hi }: { meds: Medication[]; onTake: (m: Medication) => void; hi?: boolean }) {
  return (
    <View style={{ marginTop: 28 }}>
      <T size="sm" bold color={hi ? C.hiFg : C.muted} accessibilityRole="header" style={{ marginBottom: 10 }}>
        Si besoin
      </T>
      {meds.map((m) => (
        <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`J’ai pris ${m.name}`} onPress={() => onTake(m)} style={[s.slotRow, s.prn]}>
          <Pill med={m} size={44} />
          <View style={{ flex: 1 }}>
            <T size="md" bold color={hi ? C.hiFg : C.text}>
              {m.name}
            </T>
            <T size="sm" color={C.muted}>
              {m.dose}
            </T>
          </View>
          <T size="sm" bold color={hi ? C.hiFg : C.taken}>
            J’en prends
          </T>
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  center: { flex: 1, justifyContent: 'center' },
  zone: { flex: 1, borderRadius: 36, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  now: { borderRadius: 32, borderWidth: 3, overflow: 'hidden', marginBottom: 16 },
  nowLid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  rest: { alignItems: 'center', gap: 12, padding: 28, borderRadius: 32, borderWidth: 2, borderColor: C.line, backgroundColor: C.night2, marginTop: 8 },
  slot: { borderRadius: 22, borderWidth: 2, borderColor: C.line, marginBottom: 12, overflow: 'hidden', backgroundColor: C.night2 },
  slotLid: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64 },
  prn: { backgroundColor: C.night2, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  check: { width: 40, height: 40, borderRadius: 12, borderWidth: 3, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', left: 16, right: 16, backgroundColor: C.taken, borderRadius: 22, padding: 14, paddingLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
})
