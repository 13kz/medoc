import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '../theme'
import { T } from './kit'

const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** En-tête : la date en toutes lettres au-dessus d'un grand titre, et une action à droite. */
export function Screen({ title, now, right, children, tone = C.paper, scroll = true }: { title: string; now?: number; right?: ReactNode; children: ReactNode; tone?: string; scroll?: boolean }) {
  const insets = useSafeAreaInsets()
  const head = (
    <View style={[s.head, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        {now !== undefined && (
          <T size="sm" color={C.muted}>
            {DATE.format(now)}
          </T>
        )}
        <T size="xl" bold color={tone} accessibilityRole="header">
          {title}
        </T>
      </View>
      {right}
    </View>
  )
  if (!scroll)
    return (
      <View style={s.root}>
        {head}
        <View style={{ flex: 1, paddingHorizontal: 18 }}>{children}</View>
      </View>
    )
  return (
    <View style={s.root}>
      {head}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  head: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 12, gap: 12 },
})
