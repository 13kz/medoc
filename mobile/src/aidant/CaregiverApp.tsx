import { useEffect, useState } from 'react'
import { Alert as RNAlert, Pressable, StyleSheet, View } from 'react-native'
import {
  changeTitle,
  deliveredAlerts,
  dosesForDay,
  MOMENTS,
  momentOf,
  refills,
  resolvedMessage,
  rhythmLabel,
  spokenTime,
  stockLabel,
  asNeededLabel,
  formatTime,
  type Dose,
  type Medication,
} from '../core'
import { useSession } from '../session'
import { useStore } from '../store'
import { C, lid } from '../theme'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'
import { Pillbox } from '../ui/Pillbox'
import { Screen } from '../ui/Screen'
import { Btn, Card, IconBtn, Label, T } from '../ui/kit'
import { MedEditor } from './MedEditor'
import { SettingsTab } from './SettingsTab'

type Tab = 'jour' | 'ordonnance' | 'alertes' | 'reglages'

/** Le téléphone du proche aidant : suivre, saisir l'ordonnance, être prévenu, régler. */
export function CaregiverApp() {
  const { state, now } = useStore()
  const [tab, setTab] = useState<Tab>('jour')
  const unread = deliveredAlerts(state, now).filter((a) => !a.read).length
  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <View style={{ flex: 1 }}>
        {tab === 'jour' && <TodayTab />}
        {tab === 'ordonnance' && <MedsTab />}
        {tab === 'alertes' && <AlertsTab />}
        {tab === 'reglages' && <SettingsTab />}
      </View>
      <Pillbox
        value={tab}
        onChange={setTab}
        items={[
          { key: 'jour', label: 'Aujourd’hui', icon: 'sun', tone: lid('matin') },
          { key: 'ordonnance', label: 'Ordonnance', icon: 'box', tone: lid('midi') },
          { key: 'alertes', label: 'Alertes', icon: 'bell', tone: lid('soir'), badge: unread },
          { key: 'reglages', label: 'Réglages', icon: 'settings', tone: lid('nuit') },
        ]}
      />
    </View>
  )
}

const STATUS: Record<Dose['status'], { label: string; color: string }> = {
  pris: { label: 'Pris', color: C.taken },
  'a-venir': { label: 'À venir', color: C.muted },
  'a-prendre': { label: 'À prendre', color: lid('matin') },
  reporte: { label: 'Reporté', color: C.later },
  'en-retard': { label: 'En retard', color: C.late },
}

function TodayTab() {
  const { state, dispatch, now } = useStore()
  const doses = dosesForDay(state, now)
  const taken = doses.filter((d) => d.status === 'pris').length
  const late = doses.filter((d) => d.status === 'en-retard')
  const low = refills(state)
  const unseen = state.changes.filter((c) => !c.acknowledged).length

  const toggle = (d: Dose) => {
    if (d.status !== 'pris') return dispatch({ type: 'take', doseKey: d.key, by: 'aidant', at: now })
    RNAlert.alert('Annuler cette prise ?', `${d.med.name} de ${spokenTime(d.time)} repassera « à prendre ».`, [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler la prise', style: 'destructive', onPress: () => dispatch({ type: 'untake', doseKey: d.key }) },
    ])
  }

  return (
    <Screen title={state.patient.name} now={now} tone={lid('matin')}>
      {/* Le ruban du jour : une case par prise, dans l'ordre, colorée par son état. */}
      <View style={s.ribbon} accessible accessibilityLabel={`${taken} prises faites sur ${doses.length}${late.length ? `, ${late.length} en retard` : ''}`}>
        <T size="giant" bold>
          {taken}
          <T size="xl" color={C.muted}>
            {' '}
            / {doses.length}
          </T>
        </T>
        <T size="sm" color={C.muted}>
          prises faites aujourd’hui
        </T>
        <View style={s.strip}>
          {doses.map((d) => (
            <View key={d.key} style={[s.cell, { backgroundColor: d.status === 'pris' ? C.taken : d.status === 'en-retard' ? C.late : C.night3, borderColor: lid(momentOf(d.time)) }]} />
          ))}
        </View>
      </View>

      {late.length > 0 && (
        <Card tone={C.late}>
          <T size="md" bold color={C.late}>
            {late.length} prise{late.length > 1 ? 's' : ''} en retard
          </T>
          <T size="sm" color={C.muted}>
            {late.map((d) => `${d.med.name} (${spokenTime(d.time)})`).join(', ')}
          </T>
        </Card>
      )}
      {low.map((m) => (
        <Card key={m.id} tone={lid('midi')}>
          <T size="md" bold>
            À racheter : {m.name}
          </T>
          <T size="sm" color={C.muted}>
            {stockLabel(m)}
          </T>
          <Btn label="J’ai racheté une boîte" variant="ghost" onPress={() => dispatch({ type: 'restock', medId: m.id })} style={{ marginTop: 10 }} />
        </Card>
      ))}
      {unseen > 0 && (
        <T size="sm" color={C.muted} style={{ marginBottom: 8 }}>
          {unseen} changement{unseen > 1 ? 's' : ''} de traitement pas encore confirmé{unseen > 1 ? 's' : ''} par {state.patient.name}.
        </T>
      )}

      {MOMENTS.filter((m) => doses.some((d) => momentOf(d.time) === m.id)).map((m) => (
        <View key={m.id}>
          <View style={s.momentHead}>
            <View style={[s.dot, { backgroundColor: m.tone }]} />
            <T size="md" bold accessibilityRole="header">
              {m.label}
            </T>
          </View>
          {doses
            .filter((d) => momentOf(d.time) === m.id)
            .map((d) => (
              <Pressable
                key={d.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: d.status === 'pris' }}
                accessibilityLabel={`${spokenTime(d.time)}, ${d.med.name}, ${STATUS[d.status].label}`}
                accessibilityHint={d.status === 'pris' ? 'Annuler la prise' : 'Marquer comme pris'}
                onPress={() => toggle(d)}
                style={s.row}
              >
                <Pill med={d.med} size={46} />
                <View style={{ flex: 1 }}>
                  <T size="md" bold>
                    {d.med.name}
                  </T>
                  <T size="sm" color={C.muted}>
                    {spokenTime(d.time)} · {d.med.dose}
                    {d.intake ? ` · ${d.intake.by === 'patient' ? 'par ' + state.patient.name : 'par un proche'} à ${spokenTime(formatTime(Date.parse(d.intake.takenAt)))}` : ''}
                  </T>
                </View>
                <View style={[s.chip, { borderColor: STATUS[d.status].color }, d.status === 'pris' && { backgroundColor: C.taken }]}>
                  <T size="xs" bold color={d.status === 'pris' ? C.ink : STATUS[d.status].color}>
                    {STATUS[d.status].label}
                  </T>
                </View>
              </Pressable>
            ))}
        </View>
      ))}
      {doses.length === 0 && (
        <Card>
          <T size="md">Aucune prise prévue aujourd’hui.</T>
          <T size="sm" color={C.muted}>
            Ajoutez les médicaments dans l’onglet Ordonnance.
          </T>
        </Card>
      )}
    </Screen>
  )
}

function MedsTab() {
  const { state, now } = useStore()
  const [editing, setEditing] = useState<Medication | null | 'new'>(null)
  const active = state.medications.filter((m) => m.active)
  const paused = state.medications.filter((m) => !m.active)
  const row = (m: Medication) => (
    <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`${m.name}, ${m.dose}. Modifier`} onPress={() => setEditing(m)} style={s.medRow}>
      <Pill med={m} size={52} />
      <View style={{ flex: 1 }}>
        <T size="md" bold color={m.active ? C.text : C.muted}>
          {m.name}
        </T>
        <T size="sm" color={C.muted}>
          {m.dose} · {m.asNeeded ? asNeededLabel(m) : `${m.times.map(spokenTime).join(', ')} · ${rhythmLabel(m)}`}
        </T>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {!m.asNeeded && m.times.map((t) => <View key={t} style={[s.lidMini, { backgroundColor: lid(momentOf(t)) }]} />)}
        </View>
      </View>
      <Icon name="chevron" color={C.muted} />
    </Pressable>
  )
  return (
    <Screen title="Ordonnance" now={now} tone={lid('midi')} right={<IconBtn icon="plus" label="Ajouter un médicament" onPress={() => setEditing('new')} bg={lid('midi')} color={C.ink} />}>
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
        <View key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <T size="sm" bold>
            {changeTitle(c)}
          </T>
          {c.details.map((d, i) => (
            <T key={i} size="xs" color={C.muted}>
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
  const { session } = useSession()
  const list = deliveredAlerts(state, now)
  const reminders = state.alerts.filter((a) => a.level === 'rappel').slice(0, 10)
  useEffect(() => {
    if (list.some((a) => !a.read)) dispatch({ type: 'readAlerts' })
  }, [list.length])
  const mine = state.contacts.some((c) => c.notify && c.name === session?.name)
  return (
    <Screen title="Alertes" now={now} tone={lid('soir')}>
      {!mine && state.contacts.every((c) => !c.notify) && (
        <Card tone={lid('soir')}>
          <T size="sm">Personne n’est prévenu en cas d’oubli. Ajoutez-vous dans Réglages, « Personnes à prévenir ».</T>
        </Card>
      )}
      {list.length === 0 && (
        <T size="md" color={C.muted} style={{ marginTop: 12 }}>
          Aucune alerte. Quand une prise dépasse {state.settings.lateAfterMin + state.settings.escalateAfterMin} minutes de retard, elle arrive ici.
        </T>
      )}
      {list.map((a) => {
        const done = resolvedMessage(state, a)
        return (
          <Card key={a.id} tone={done ? C.taken : C.late}>
            <T size="xs" color={C.muted}>
              {new Date(a.deliverAt).toLocaleDateString('fr-FR', { weekday: 'long' })} à {spokenTime(formatTime(Date.parse(a.deliverAt)))}
            </T>
            <T size="md" bold>
              {a.message}
            </T>
            {done && (
              <T size="sm" color={C.taken}>
                {done}
              </T>
            )}
          </Card>
        )
      })}
      {reminders.length > 0 && <Label>Relances envoyées à {state.patient.name}</Label>}
      {reminders.map((a) => (
        <T key={a.id} size="sm" color={C.muted} style={{ paddingVertical: 6 }}>
          {spokenTime(formatTime(Date.parse(a.at)))} · {a.message}
        </T>
      ))}
    </Screen>
  )
}

const s = StyleSheet.create({
  ribbon: { backgroundColor: C.night2, borderRadius: 28, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  cell: { width: 26, height: 34, borderRadius: 8, borderTopWidth: 6 },
  momentHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 6 },
  dot: { width: 14, height: 26, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  chip: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.night2, borderRadius: 22, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  lidMini: { width: 22, height: 8, borderRadius: 3 },
})
