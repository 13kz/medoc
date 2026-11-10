import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatTime, spokenTime } from '../core'
import { C, F, lid } from '../theme'
import { T, tap } from './kit'

export type Lid<K extends string> = { key: K; label: string; /** Libellé court, quand le couvercle est fermé. */ short?: string; tone: string; badge?: number }

const START = 6 * 60
const END = 23 * 60

/** Le logo : les quatre couvercles du pilulier. */
export function Logo({ size = 22 }: { size?: number }) {
  const c = size / 2 - 1.5
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }} accessible={false}>
      {[C.matin, C.midi, C.soir, C.coucher].map((t) => (
        <View key={t} style={{ width: c, height: c, borderRadius: 3, backgroundColor: t }} />
      ))}
    </View>
  )
}

/**
 * Le menu, comme sur le site : une réglette horaire posée en bas de l'écran, comme le bord d'un
 * pilulier. Chaque couvercle ouvre une section ; l'aiguille montre l'heure qu'il est dans la journée.
 */
export function Reglette<K extends string>({ items, value, onChange, now, who }: { items: Lid<K>[]; value: K; onChange: (k: K) => void; now: number; who: string }) {
  const insets = useSafeAreaInsets()
  const d = new Date(now)
  const min = d.getHours() * 60 + d.getMinutes()
  const pos = Math.min(1, Math.max(0, (min - START) / (END - START)))
  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, k) => k)
  const needleTone = lid(min < 11 * 60 ? 'matin' : min < 18 * 60 ? 'midi' : min < 21 * 60 ? 'soir' : 'nuit')
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={s.bar}>
        <View style={s.head}>
          <Logo />
          <T size="lg" face="display" color={C.ink} style={{ fontFamily: F.display }} accessibilityLabel={`Il est ${spokenTime(formatTime(now))}`}>
            {spokenTime(formatTime(now))}
          </T>
          <T size="xs" face="black" color={C.ink3} style={{ letterSpacing: 1.2, textTransform: 'uppercase', flex: 1, textAlign: 'right' }} numberOfLines={1}>
            {who}
          </T>
        </View>
        <View style={s.ruler} accessibilityRole="tablist">
          {items.map((it) => {
            const on = it.key === value
            return (
              <Pressable
                key={it.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={it.badge ? `${it.label}, ${it.badge} nouveau${it.badge > 1 ? 'x' : ''}` : it.label}
                onPress={() => {
                  tap()
                  onChange(it.key)
                }}
                style={({ pressed }) => [s.lid, { flex: on ? 1.7 : 1, backgroundColor: it.tone, opacity: on ? 1 : 0.55, transform: [{ translateY: on ? -5 : 0 }] }, on && s.lidOn, pressed && { opacity: 0.8 }]}
              >
                <T size="xs" face="black" color={C.ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {on ? it.label : it.short ?? it.label}
                </T>
                {!!it.badge && (
                  <View style={s.badge}>
                    <T size="xs" face="black" color="#fff">
                      {it.badge}
                    </T>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
        <View style={s.ticks} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
          {hours.map((k) => (
            <View key={k} style={[s.tick, { left: `${(k / (hours.length - 1)) * 100}%`, height: (START / 60 + k) % 3 === 0 ? 9 : 5 }]} />
          ))}
          <View style={[s.needle, { left: `${pos * 100}%` }]}>
            <View style={s.needleLine} />
            <View style={[s.needleDot, { backgroundColor: needleTone }]} />
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingTop: 6 },
  bar: { backgroundColor: '#ebe6da', borderRadius: 26, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  ruler: { flexDirection: 'row', gap: 4 },
  lid: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  lidOn: { borderWidth: 2, borderColor: C.ink },
  badge: { position: 'absolute', top: -8, right: -4, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  ticks: { height: 16, marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(20,32,26,0.25)' },
  tick: { position: 'absolute', top: 0, width: 1, backgroundColor: 'rgba(20,32,26,0.35)' },
  needle: { position: 'absolute', top: -64, alignItems: 'center', width: 14, marginLeft: -7 },
  needleLine: { width: 2, height: 70, backgroundColor: C.ink },
  needleDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.ink, marginTop: -2 },
})
