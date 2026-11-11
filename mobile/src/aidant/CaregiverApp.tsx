import { useEffect, useState } from 'react'
import { Alert as RNAlert, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  asNeededLabel,
  changeTitle,
  deliveredAlerts,
  dosesForDay,
  formatTime,
  momentOf,
  refills,
  resolvedMessage,
  rhythmLabel,
  spokenTime,
  stockLabel,
  type Dose,
  type Medication,
} from '../core'
import { useSession } from '../session'
import { useStore } from '../store'
import { C, lid, useU } from '../theme'
import { Backdrop } from '../ui/Backdrop'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'
import { Reglette } from '../ui/Reglette'
import { Screen } from '../ui/Screen'
import { Btn, Card, IconBtn, Kicker, Label, T } from '../ui/kit'
import { MedEditor } from './MedEditor'
import { SettingsTab } from './SettingsTab'

type Tab = 'jour' | 'ordonnance' | 'alertes' | 'reglages'

/**
 * Le téléphone d'un proche, dans le crépuscule du site. Il veut savoir une chose : est-ce que tout
 * va bien ? Medoc le dit en une phrase, et ne le dérange que si la relance n'a pas suffi.
 */
export function CaregiverApp() {
  const { state, now } = useStore()
  const { session } = useSession()
  const [tab, setTab] = useState<Tab>('jour')
  const unread = deliveredAlerts(state, now).filter((a) => !a.read).length
  return (
    <Backdrop u="crepuscule">
      <View style={{ flex: 1 }}>
        {tab === 'jour' && <TodayTab />}
        {tab === 'ordonnance' && <MedsTab />}
        {tab === 'alertes' && <AlertsTab />}
        {tab === 'reglages' && <SettingsTab />}
      </View>
      <Reglette
        value={tab}
        onChange={setTab}
        now={now}
        who={session?.name ?? 'Proche'}
        items={[
          { key: 'jour', label: 'Aujourd’hui', short: 'Jour', tone: C.matin },
          { key: 'ordonnance', label: 'Ordonnance', short: 'Ordo', tone: C.midi },
          { key: 'alertes', label: 'Alertes', tone: C.soir, badge: unread },
          { key: 'reglages', label: 'Réglages', short: 'Régl.', tone: C.coucher },
        ]}
      />
    </Backdrop>
  )
}

const STATUS: Record<Dose['status'], string> = {
  pris: 'Pris',
  'a-venir': 'À venir',
  'a-prendre': 'C’est l’heure',
  reporte: 'Reporté',
  'en-retard': 'Pas encore pris',
}

function TodayTab() {
  const { state, dispatch, now, sync } = useStore()
  const { session } = useSession()
  const u = useU()
  const insets = useSafeAreaInsets()
  const p = state.patient
  const doses = dosesForDay(state, now)
  const done = doses.filter((d) => d.status === 'pris').length
  const late = doses.filter((d) => d.status === 'en-retard')
  const open = deliveredAlerts(state, now).filter((a) => !a.resolvedAt && !a.doseKey.startsWith('glycemie'))
  const low = refills(state)

  let tone: 'ok' | 'wait' | 'alert' = 'ok'
  let headline = 'Tout va bien.'
  let sub = doses.length ? `${done} prise${done > 1 ? 's' : ''} sur ${doses.length} faite${done > 1 ? 's' : ''} aujourd’hui.` : 'Rien n’est prévu aujourd’hui.'
  if (open.length) {
    tone = 'alert'
    headline = open[0].message
    sub = `${p.name} a été relancée sur son téléphone, sans réponse.`
  } else if (late.length) {
    tone = 'wait'
    headline = 'Petit retard.'
    sub = `${p.name} a été relancée. Vous serez prévenu si la prise n’est toujours pas faite.`
  }
  const lateDose = open.length ? doses.find((d) => d.key === open[0].doseKey) : late[0]

  const toggle = (d: Dose) => {
    if (d.status !== 'pris') return dispatch({ type: 'take', doseKey: d.key, by: 'aidant', at: now })
    RNAlert.alert('Annuler cette prise ?', `${d.med.name} de ${spokenTime(d.time)} repassera « à prendre ».`, [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler la prise', style: 'destructive', onPress: () => dispatch({ type: 'untake', doseKey: d.key }) },
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.who, { paddingTop: insets.top + 12 }]}>
        <View style={s.avatar}>
          <T size="lg" face="displayBold" color={C.ink}>
            {p.name.slice(0, 1).toUpperCase()}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T size="lg" face="display">
            {p.name}
          </T>
          <T size="xs" color={u.muted}>
            Suivi par {session?.name ?? 'vous'}
          </T>
        </View>
        <View style={s.sync} accessibilityLabel={sync ? (sync.online ? 'Dossier partagé, en direct' : 'Dossier partagé, hors ligne') : 'Dossier sur ce téléphone'} accessible>
          <View style={[s.syncDot, { backgroundColor: sync ? (sync.online ? C.mint : C.amber) : u.muted }]} />
          <T size="xs" bold color={u.muted}>
            {sync ? (sync.online ? 'en direct' : 'hors ligne') : 'ce téléphone'}
          </T>
        </View>
      </View>
      <Screen title="" scrollOnly>
        <View style={[s.status, tone === 'alert' && { backgroundColor: '#2a0d08', borderColor: 'transparent' }]} accessibilityLiveRegion="polite">
          <View style={[s.statusIcon, { backgroundColor: tone === 'ok' ? C.mint : tone === 'wait' ? C.amber : C.alert }]}>
            <Icon name={tone === 'ok' ? 'check' : tone === 'wait' ? 'snooze' : 'alert'} size={24} color={tone === 'ok' ? C.ink : '#fff'} stroke={2.6} />
          </View>
          <T size={tone === 'alert' ? 'xl' : 'xxl'} face="display" style={{ marginTop: 12 }}>
            {headline}
          </T>
          <T size="lg" face="italic" color={C.peach} style={{ marginTop: 4 }}>
            {sub}
          </T>
          {tone !== 'ok' && lateDose && (
            <Btn label="Je l’ai vue le prendre" icon="check" onPress={() => dispatch({ type: 'take', doseKey: lateDose.key, by: 'aidant', at: now })} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          )}
        </View>

        <View style={{ marginTop: 8 }}>
          {doses.map((d, i) => {
            const tone = lid(momentOf(d.time))
            const taken = d.status === 'pris'
            return (
              <Pressable
                key={d.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: taken }}
                accessibilityLabel={`${spokenTime(d.time)}, ${d.med.name}, ${STATUS[d.status]}`}
                accessibilityHint={taken ? 'Annuler la prise' : 'Noter comme pris'}
                onPress={() => toggle(d)}
                style={s.line}
              >
                <T size="sm" face="black" style={{ width: 66 }}>
                  {spokenTime(d.time)}
                </T>
                <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                  <View style={[s.rail, { opacity: i === 0 ? 0 : 1 }]} />
                  <View style={[s.lineDot, { borderColor: tone, backgroundColor: taken ? tone : d.status === 'en-retard' ? C.alert : 'transparent' }]} />
                  <View style={[s.rail, { opacity: i === doses.length - 1 ? 0 : 1 }]} />
                </View>
                <Pill med={d.med} size={40} />
                <View style={{ flex: 1 }}>
                  <T size="md" bold>
                    {d.med.name}
                  </T>
                  <T size="xs" color={d.status === 'en-retard' ? '#ffb4a8' : u.muted}>
                    {STATUS[d.status]}
                    {d.intake ? ` à ${spokenTime(formatTime(Date.parse(d.intake.takenAt)))}${d.intake.by === 'aidant' ? ' (noté par un proche)' : ''}` : ''}
                  </T>
                </View>
              </Pressable>
            )
          })}
        </View>

        {state.notes.slice(0, 1).map((n) => (
          <Card key={n.id} style={{ marginTop: 14 }}>
            <Kicker>Conseil de {n.from}</Kicker>
            <T size="md" style={{ marginTop: 6 }}>
              {n.text}
            </T>
            <T size="sm" bold color={n.acknowledged ? C.mint : u.muted} style={{ marginTop: 8 }}>
              {n.acknowledged ? `${p.name} l’a lu ✓` : `${p.name} ne l’a pas encore lu`}
            </T>
          </Card>
        ))}
        {state.changes.slice(0, 1).map((c) => (
          <Card key={c.id}>
            <Kicker>Traitement modifié</Kicker>
            <T size="md" style={{ marginTop: 6 }}>
              {changeTitle(c)}
            </T>
            <T size="xs" color={u.muted}>
              {c.details.join(' · ')}
            </T>
          </Card>
        ))}
        {low.map((m) => (
          <Card key={m.id} tone={C.midi}>
            <T size="md" bold>
              {m.name} : {stockLabel(m).toLowerCase()}
            </T>
            <Btn label="J’ai racheté une boîte" variant="ghost" onPress={() => dispatch({ type: 'restock', medId: m.id })} style={{ marginTop: 10 }} />
          </Card>
        ))}
        {doses.length === 0 && (
          <T size="md" color={u.muted}>
            Ajoutez les médicaments dans l’Ordonnance.
          </T>
        )}
      </Screen>
    </View>
  )
}

function MedsTab() {
  const { state, now } = useStore()
  const u = useU()
  const [editing, setEditing] = useState<Medication | null | 'new'>(null)
  const active = state.medications.filter((m) => m.active)
  const paused = state.medications.filter((m) => !m.active)
  const row = (m: Medication) => (
    <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`${m.name}, ${m.dose}. Modifier`} onPress={() => setEditing(m)} style={[s.medRow, { backgroundColor: u.card, borderColor: u.cardLine }]}>
      <Pill med={m} size={52} />
      <View style={{ flex: 1 }}>
        <T size="md" bold color={m.active ? u.fg : u.muted}>
          {m.name}
        </T>
        <T size="sm" color={u.muted}>
          {m.dose} · {m.asNeeded ? asNeededLabel(m) : `${m.times.map(spokenTime).join(', ')} · ${rhythmLabel(m)}`}
        </T>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>{!m.asNeeded && m.times.map((t) => <View key={t} style={[s.lidMini, { backgroundColor: lid(momentOf(t)) }]} />)}</View>
      </View>
      <Icon name="chevron" color={u.muted} />
    </Pressable>
  )
  return (
    <Screen title="Ordonnance" italic={`de ${state.patient.name}`} accent={C.peach} now={now} right={<IconBtn icon="plus" label="Ajouter un médicament" onPress={() => setEditing('new')} bg={C.midi} color={C.ink} />}>
      {active.length === 0 && (
        <Card>
          <T size="md">L’ordonnance est vide.</T>
          <Btn label="Ajouter un médicament" icon="plus" onPress={() => setEditing('new')} style={{ marginTop: 12 }} />
        </Card>
      )}
      {active.map(row)}
      {paused.length > 0 && <Label>Suspendus</Label>}
      {paused.map(row)}
      {state.changes.length > 0 && <Label>Derniers changements</Label>}
      {state.changes.slice(0, 6).map((c) => (
        <View key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: u.line }}>
          <T size="sm" bold>
            {changeTitle(c)}
          </T>
          {c.details.map((d, i) => (
            <T key={i} size="xs" color={u.muted}>
              {d}
            </T>
          ))}
        </View>
      ))}
      {editing && <MedEditor med={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Screen>
  )
}

function AlertsTab() {
  const { state, dispatch, now } = useStore()
  const u = useU()
  const list = deliveredAlerts(state, now)
  const reminders = state.alerts.filter((a) => a.level === 'rappel').slice(0, 10)
  useEffect(() => {
    if (list.some((a) => !a.read)) dispatch({ type: 'readAlerts' })
  }, [list.length])
  return (
    <Screen title="Il ne reçoit pas tout." italic="Il reçoit ce qui compte." accent={C.peach} now={now}>
      {state.contacts.every((c) => !c.notify) && (
        <Card tone={C.soir}>
          <T size="sm">Personne n’est prévenu en cas d’oubli. Ajoutez-vous dans Réglages, « Personnes à prévenir ».</T>
        </Card>
      )}
      {list.length === 0 && (
        <T size="md" color={u.muted}>
          Aucune alerte. Medoc vous prévient seulement si {state.patient.name} ne répond pas à la relance, {state.settings.lateAfterMin + state.settings.escalateAfterMin} minutes après l’heure prévue.
        </T>
      )}
      {list.map((a) => {
        const ok = resolvedMessage(state, a)
        return (
          <View key={a.id} style={[s.notif, ok && { opacity: 0.7 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T size="sm" face="black" color={C.ink}>
                Medoc
              </T>
              <T size="xs" color={C.ink3}>
                {spokenTime(formatTime(Date.parse(a.deliverAt)))}
              </T>
            </View>
            <T size="md" color={C.ink} style={ok ? { textDecorationLine: 'line-through' } : undefined}>
              {a.message}
            </T>
            {ok && (
              <T size="md" bold color={C.green}>
                {ok}
              </T>
            )}
          </View>
        )
      })}
      {reminders.length > 0 && <Label>Relances faites sur le téléphone de {state.patient.name}</Label>}
      {reminders.map((a) => (
        <View key={a.id} style={[s.step, { backgroundColor: u.card, borderColor: u.cardLine }]}>
          <T size="sm" face="black" style={{ width: 66 }}>
            {spokenTime(formatTime(Date.parse(a.at)))}
          </T>
          <T size="sm" style={{ flex: 1 }}>
            {a.message}
          </T>
        </View>
      ))}
    </Screen>
  )
}

const s = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  status: { borderRadius: 28, padding: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  statusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 66 },
  rail: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  lineDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 14, marginBottom: 10, borderWidth: 1 },
  lidMini: { width: 22, height: 8, borderRadius: 3 },
  notif: { backgroundColor: 'rgba(251,247,242,0.94)', borderRadius: 22, padding: 16, marginBottom: 10, gap: 2 },
  step: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 6 },
})
