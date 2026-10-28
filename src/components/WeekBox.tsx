import type { CSSProperties } from 'react'
import { MOMENTS, type WeekDay } from '../lib/schedule'
import { Icon } from './Icon'

/**
 * Le semainier : une colonne par jour, une rangée par moment, comme le pilulier de la semaine.
 * Plein = tout pris, à moitié = en partie, croix rouge = oublié, vide = pas encore l'heure.
 */
export function WeekBox({ week, caption }: { week: WeekDay[]; caption: string }) {
  const rows = MOMENTS.filter((m) => week.some((d) => d.cells.find((c) => c.moment === m.id)!.total > 0))
  return (
    <div className="wk-wrap">
      <table className="wk">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {week.map((d) => (
              <th key={d.day} scope="col" className={d.isToday ? 'today' : ''}>
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} style={{ '--lid': m.tone } as CSSProperties}>
              <th scope="row">
                <span className="wk-lid">
                  <Icon name={m.icon} size={14} stroke={2.4} />
                </span>
                <span className="wk-row-label">{m.label}</span>
              </th>
              {week.map((d) => {
                const c = d.cells.find((x) => x.moment === m.id)!
                const due = c.taken + c.missed
                const kind =
                  c.total === 0 ? 'none' : c.missed > 0 && c.taken === 0 ? 'missed' : c.missed > 0 ? 'partial' : due === 0 ? 'future' : c.taken < c.total ? 'partial' : 'full'
                const label =
                  kind === 'none'
                    ? 'rien de prévu'
                    : kind === 'future'
                      ? 'pas encore l’heure'
                      : kind === 'full'
                        ? 'tout pris'
                        : kind === 'missed'
                          ? 'oublié'
                          : `${c.taken} sur ${c.total} pris`
                return (
                  <td key={d.day} className={`wk-cell wk-${kind} ${d.isToday ? 'today' : ''}`}>
                    <span className="wk-dot">
                      {kind === 'full' && <Icon name="check" size={14} stroke={3.2} />}
                      {kind === 'missed' && <Icon name="close" size={13} stroke={3} />}
                    </span>
                    <span className="sr-only">{label}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
