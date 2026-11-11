import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useU } from '../theme'
import { T } from './kit'

const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** En-tête façon site : une ligne de contexte, puis un grand titre en Fraunces, avec sa suite en italique. */
export function Screen({ title, italic, kicker, now, right, children, accent, scrollOnly }: { title: string; italic?: string; kicker?: string; now?: number; right?: ReactNode; children: ReactNode; accent?: string; /** Sans en-tête : l'écran a déjà le sien. */ scrollOnly?: boolean }) {
  const u = useU()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: scrollOnly ? 8 : insets.top + 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {!scrollOnly && (
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <T size="sm" color={u.muted}>
              {[kicker, now !== undefined ? DATE.format(now) : null].filter(Boolean).join(' · ')}
            </T>
            <T size="xxl" face="display" accessibilityRole="header">
              {title}
            </T>
            {italic && (
              <T size="xl" face="italic" color={accent ?? u.muted}>
                {italic}
              </T>
            )}
          </View>
          {right}
        </View>
        )}
        {children}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 } })
