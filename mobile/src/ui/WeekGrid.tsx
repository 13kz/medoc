import { View } from 'react-native'
import { MOMENTS, type WeekDay } from '../core'
import { C } from '../theme'
import { T } from './kit'

/**
 * Le semainier : 7 colonnes (jours) × 5 cases (moments). Pris = couvercle plein,
 * oublié = case rouge, rien de prévu = vide.
 */
export function WeekGrid({ week, cell = 30, labels = true }: { week: WeekDay[]; cell?: number; labels?: boolean }) {
  const taken = week.reduce((n, d) => n + d.cells.reduce((m, c) => m + c.taken, 0), 0)
  const missed = week.reduce((n, d) => n + d.cells.reduce((m, c) => m + c.missed, 0), 0)
  return (
    <View accessible accessibilityLabel={`Semaine : ${taken} prises faites, ${missed} oubliées`} style={{ flexDirection: 'row', gap: 4 }}>
      {week.map((d) => (
        <View key={d.day} style={{ alignItems: 'center', gap: 3 }}>
          {d.cells.map((c, i) => {
            const tone = MOMENTS[i].tone
            const bg = c.total === 0 ? 'transparent' : c.missed ? C.late : c.taken === c.total ? tone : C.night3
            return <View key={c.moment} style={{ width: cell, height: cell * 0.62, borderRadius: 5, backgroundColor: bg, borderWidth: c.total === 0 ? 1 : 0, borderColor: C.line, opacity: c.total === 0 ? 0.4 : 1 }} />
          })}
          {labels && (
            <T size="xs" bold={d.isToday} color={d.isToday ? C.text : C.muted}>
              {d.label}
            </T>
          )}
        </View>
      ))}
    </View>
  )
}
