import { View } from 'react-native'
import { MOMENTS, type WeekDay } from '../core'
import { C, useU } from '../theme'
import { T } from './kit'

/**
 * Le semainier du compte rendu : une ligne par moment de la journée, une colonne par jour.
 * Pris = case à la couleur du couvercle, oublié = case rouge marquée d'une croix.
 */
export function WeekGrid({ week, cell = 34, labels = true }: { week: WeekDay[]; cell?: number; labels?: boolean }) {
  const u = useU()
  const rows = MOMENTS.map((m, i) => ({ m, i })).filter(({ i }) => week.some((d) => d.cells[i].total > 0))
  const taken = week.reduce((n, d) => n + d.cells.reduce((m, c) => m + c.taken, 0), 0)
  const missed = week.reduce((n, d) => n + d.cells.reduce((m, c) => m + c.missed, 0), 0)
  const h = Math.round(cell * 0.62)
  return (
    <View accessible accessibilityLabel={`Semainier : ${taken} prises faites, ${missed} oubliées sur 7 jours`} style={{ gap: 5 }}>
      {labels && (
        <View style={{ flexDirection: 'row', gap: 5, marginLeft: 70 }}>
          {week.map((d) => (
            <T key={d.day} size="xs" bold={d.isToday} color={d.isToday ? u.fg : u.muted} style={{ width: cell, textAlign: 'center', textTransform: 'capitalize' }}>
              {d.label}
            </T>
          ))}
        </View>
      )}
      {rows.map(({ m, i }) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {labels && (
            <T size="xs" bold color={u.muted} style={{ width: 65 }}>
              {m.label}
            </T>
          )}
          {week.map((d) => {
            const c = d.cells[i]
            const upcoming = c.total > 0 && c.taken + c.missed < c.total && !c.missed
            const bg = c.total === 0 ? 'transparent' : c.missed ? C.red : upcoming ? (u.dark ? 'rgba(244,241,234,0.12)' : C.paper2) : m.tone
            return (
              <View key={d.day} style={{ width: cell, height: h, borderRadius: 6, backgroundColor: bg, borderWidth: c.total === 0 ? 1 : 0, borderColor: u.line, alignItems: 'center', justifyContent: 'center' }}>
                {!!c.missed && (
                  <T size="xs" face="black" color="#fff" style={{ lineHeight: 14 }}>
                    ×
                  </T>
                )}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
