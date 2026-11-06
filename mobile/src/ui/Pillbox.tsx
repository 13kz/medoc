import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { IconName } from '../core'
import { C } from '../theme'
import { Icon } from './Icon'
import { T, tap } from './kit'

export type Compartment<K extends string> = { key: K; label: string; icon: IconName; tone: string; badge?: number }

/**
 * La navigation est un pilulier posé en bas de l'écran : une case par section, chacune avec son
 * couvercle coloré. La case ouverte soulève son couvercle.
 */
export function Pillbox<K extends string>({ items, value, onChange }: { items: Compartment<K>[]; value: K; onChange: (k: K) => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.box, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {items.map((it) => {
        const open = it.key === value
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: open }}
            accessibilityLabel={it.badge ? `${it.label}, ${it.badge} nouveau${it.badge > 1 ? 'x' : ''}` : it.label}
            onPress={() => {
              tap()
              onChange(it.key)
            }}
            style={s.cell}
          >
            <View style={[s.lid, { backgroundColor: it.tone, transform: [{ translateY: open ? -10 : 0 }, { rotate: open ? '-4deg' : '0deg' }] }, !open && { opacity: 0.55 }]}>
              <View style={s.tab} />
            </View>
            <View style={[s.well, open && { borderColor: it.tone, backgroundColor: C.night3 }]}>
              <Icon name={it.icon} size={26} color={open ? it.tone : C.muted} />
              <T size="xs" bold color={open ? C.text : C.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {it.label}
              </T>
              {!!it.badge && (
                <View style={s.badge}>
                  <T size="xs" bold color={C.ink}>
                    {it.badge}
                  </T>
                </View>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingTop: 14, backgroundColor: C.night, borderTopWidth: 1, borderTopColor: C.line },
  cell: { flex: 1, alignItems: 'stretch' },
  lid: { height: 12, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginHorizontal: 2, alignItems: 'center' },
  tab: { width: 18, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,.25)', marginTop: 4 },
  well: { minHeight: 64, borderWidth: 2, borderColor: C.line, borderTopWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  badge: { position: 'absolute', top: 4, right: 6, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.late, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
})
