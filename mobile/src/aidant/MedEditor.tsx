import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { FORMS, type MedForm, type Medication } from '../core'
import { useSession } from '../session'
import { useStore } from '../store'
import { C, lid, useU } from '../theme'
import { Pill } from '../ui/Pill'
import { Btn, Choice, Field, Label, T, Toggle, tap } from '../ui/kit'
import { Sheet } from '../ui/Sheet'

const COLORS = ['#ffffff', '#f2a33a', '#e64545', '#3fb37f', '#2f8fd8', '#8e5bd6', '#f5d33a', '#e8e1cf']
const PRESETS: { time: string; label: string; tone: string }[] = [
  { time: '08:00', label: 'Matin 8 h', tone: lid('matin') },
  { time: '12:30', label: 'Midi 12 h 30', tone: lid('midi') },
  { time: '19:30', label: 'Soir 19 h 30', tone: lid('soir') },
  { time: '22:00', label: 'Coucher 22 h', tone: lid('nuit') },
]
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
/** Index de `DAYS` vers le jour JavaScript (0 = dimanche). */
const JS_DAY = [1, 2, 3, 4, 5, 6, 0]
const HHMM = /^([01]?\d|2[0-3])[:hH ]?([0-5]\d)?$/

const normalize = (t: string) => {
  const m = t.trim().match(HHMM)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`
}

export const blankMed = (): Medication => ({ id: `med-${Date.now().toString(36)}`, name: '', form: 'comprime', dose: '1 comprimé', times: ['08:00'], color: '#ffffff', active: true })

/** Ajouter ou modifier un médicament de l'ordonnance. Chaque changement entre au journal du traitement. */
export function MedEditor({ med, onClose }: { med: Medication | null; onClose: () => void }) {
  const u = useU()
  const { dispatch, now, state } = useStore()
  const { session } = useSession()
  const [m, setM] = useState<Medication>(() => med ?? blankMed())
  const [custom, setCustom] = useState('')
  const isNew = !state.medications.some((x) => x.id === m.id)
  const set = (patch: Partial<Medication>) => setM((cur) => ({ ...cur, ...patch }))
  const who = { by: session?.name ?? 'Un proche', at: now }

  const toggleTime = (t: string) => set({ times: m.times.includes(t) ? m.times.filter((x) => x !== t) : [...m.times, t].sort() })
  const days = m.rhythm?.kind === 'weekdays' ? m.rhythm.days : [0, 1, 2, 3, 4, 5, 6]
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    set({ rhythm: next.length === 7 || next.length === 0 ? { kind: 'daily' } : { kind: 'weekdays', days: next } })
  }

  const save = () => {
    dispatch({ type: 'upsertMed', med: { ...m, name: m.name.trim(), since: isNew ? new Date(now).toISOString() : m.since }, ...who })
    onClose()
  }
  const remove = () =>
    Alert.alert('Supprimer ce médicament ?', `${m.name} disparaît de l’ordonnance. Pour une pause, utilisez plutôt « En cours ».`, [
      { text: 'Garder', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => (dispatch({ type: 'deleteMed', id: m.id, ...who }), onClose()) },
    ])

  const valid = m.name.trim().length > 1 && (m.asNeeded || m.times.length > 0)
  return (
    <Sheet visible title={isNew ? 'Nouveau médicament' : m.name} onClose={onClose}>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Pill med={m} size={96} />
      </View>
      <Field label="Nom et dosage" value={m.name} onChange={(name) => set({ name })} placeholder="Ex. Metformine 1000 mg" autoCap="words" />
      <Label>Forme</Label>
      <Choice label="Forme" options={FORMS.map((x) => ({ value: x.id, label: x.label }))} value={m.form} onChange={(form: MedForm) => set({ form })} />
      <Field label="Quantité à chaque prise" value={m.dose} onChange={(dose) => set({ dose })} placeholder="Ex. 1 comprimé, 14 unités, 1 goutte" />
      <Label>Couleur (celle du comprimé ou de la boîte)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }} accessibilityRole="radiogroup">
        {COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ selected: m.color === c }}
            accessibilityLabel={`Couleur ${c}`}
            onPress={() => {
              tap()
              set({ color: c })
            }}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c, borderWidth: m.color === c ? 4 : 1, borderColor: m.color === c ? C.mint : u.line }}
          />
        ))}
      </View>

      <Toggle label="Si besoin" desc="Sans heure fixe : le patient le prend quand il en a besoin." value={!!m.asNeeded} onChange={(v) => set({ asNeeded: v ? { maxPerDay: 3, minGapH: 6 } : undefined })} />
      {m.asNeeded ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Maximum par 24 h" value={String(m.asNeeded.maxPerDay)} keyboard="number-pad" onChange={(v) => set({ asNeeded: { ...m.asNeeded!, maxPerDay: Math.max(1, Number(v) || 1) } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Heures entre deux prises" value={String(m.asNeeded.minGapH)} keyboard="number-pad" onChange={(v) => set({ asNeeded: { ...m.asNeeded!, minGapH: Math.max(0, Number(v) || 0) } })} />
          </View>
        </View>
      ) : (
        <>
          <Label>Heures de prise</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...new Set([...PRESETS.map((p) => p.time), ...m.times])].sort().map((t) => {
              const p = PRESETS.find((x) => x.time === t)
              const on = m.times.includes(t)
              return (
                <Pressable
                  key={t}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={p?.label ?? t}
                  onPress={() => {
                    tap()
                    toggleTime(t)
                  }}
                  style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', borderWidth: 2, borderColor: p?.tone ?? u.accent, backgroundColor: on ? p?.tone ?? u.accent : 'transparent' }}
                >
                  <T size="sm" bold color={on ? C.ink : u.fg}>
                    {p?.label ?? t.replace(':', ' h ')}
                  </T>
                </Pressable>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Autre heure" value={custom} onChange={setCustom} placeholder="Ex. 16:00" keyboard="numeric" />
            </View>
            <Btn
              label="Ajouter"
              onPress={() => {
                const t = normalize(custom)
                if (t && !m.times.includes(t)) toggleTime(t)
                setCustom('')
              }}
              style={{ marginBottom: 14 }}
              disabled={!normalize(custom)}
            />
          </View>
          <Label>Jours</Label>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAYS.map((d, i) => {
              const on = days.includes(JS_DAY[i])
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]}
                  onPress={() => {
                    tap()
                    toggleDay(JS_DAY[i])
                  }}
                  style={{ flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? u.accent : u.field }}
                >
                  <T size="md" bold color={on ? C.ink : u.muted}>
                    {d}
                  </T>
                </Pressable>
              )
            })}
          </View>
        </>
      )}
      <View style={{ height: 12 }} />
      <Field label="Consignes" value={m.instructions ?? ''} onChange={(instructions) => set({ instructions: instructions || undefined })} placeholder="Ex. Pendant le repas" />
      <Toggle label="Suivre le stock" desc="Prévenir quand il faut racheter une boîte." value={!!m.stock} onChange={(v) => set({ stock: v ? { units: 30, perDose: 1, boxSize: 30 } : undefined })} />
      {m.stock && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Restant" value={String(m.stock.units)} keyboard="number-pad" onChange={(v) => set({ stock: { ...m.stock!, units: Math.max(0, Number(v) || 0) } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Par boîte" value={String(m.stock.boxSize)} keyboard="number-pad" onChange={(v) => set({ stock: { ...m.stock!, boxSize: Math.max(1, Number(v) || 1) } })} />
          </View>
        </View>
      )}
      {!isNew && <Toggle label="En cours" desc="Désactivé : le traitement est suspendu, sans perdre la fiche." value={m.active} onChange={(active) => set({ active })} />}
      <Btn label="Enregistrer" icon="check" size="lg" tone={C.mint} onPress={save} disabled={!valid} style={{ marginTop: 20 }} />
      {!isNew && <Btn label="Supprimer" icon="trash" variant="ghost" onPress={remove} style={{ marginTop: 10 }} />}
    </Sheet>
  )
}
