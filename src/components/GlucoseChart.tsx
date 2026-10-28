import { useState } from 'react'
import { formatGlucose, glucoseLevel } from '../lib/glucose'
import { formatTime } from '../lib/schedule'
import type { GlucoseReading, Settings } from '../lib/types'

const W = 560
const H = 180
const PAD = { top: 12, right: 12, bottom: 24, left: 36 }
const Y_MAX = 3.5
const DAY = 86400000
const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric' })

/** Courbe des glycémies sur 7 jours, avec la zone entre les seuils d'hypo et d'hyperglycémie. */
export function GlucoseChart({ readings, settings, now }: { readings: GlucoseReading[]; settings: Settings; now: number }) {
  const [hover, setHover] = useState<string | null>(null)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const from = start.getTime() - 6 * DAY
  const to = start.getTime() + DAY
  const x = (t: number) => PAD.left + ((t - from) / (to - from)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - Math.min(v, Y_MAX) / Y_MAX) * (H - PAD.top - PAD.bottom)
  const pts = readings.map((r) => ({ r, cx: x(Date.parse(r.at)), cy: y(r.value), level: glucoseLevel(settings, r.value) }))
  const active = pts.find((p) => p.r.id === hover)

  return (
    <figure className="glu-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Glycémies des 7 derniers jours : ${readings.length} mesures`}>
        <rect className="glu-band" x={PAD.left} width={W - PAD.left - PAD.right} y={y(settings.hyperAbove)} height={y(settings.hypoBelow) - y(settings.hyperAbove)} />
        {[0, 1, 2, 3].map((v) => (
          <g key={v}>
            <line className="glu-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="glu-axis" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => from + i * DAY).map((d, i) => (
          <text key={d} className="glu-axis" x={x(d + DAY / 2)} y={H - 6} textAnchor="middle">
            {i === 6 ? 'auj.' : WEEKDAY.format(d).replace('.', '')}
          </text>
        ))}
        {pts.length > 1 && <polyline className="glu-line" points={pts.map((p) => `${p.cx},${p.cy}`).join(' ')} />}
        {pts.map((p) => (
          <g key={p.r.id} onMouseEnter={() => setHover(p.r.id)} onMouseLeave={() => setHover(null)}>
            <circle className={`glu-dot lv-${p.level}`} cx={p.cx} cy={p.cy} r={5} />
            <circle cx={p.cx} cy={p.cy} r={14} fill="transparent">
              <title>
                {DATE.format(Date.parse(p.r.at))}, {formatTime(Date.parse(p.r.at))} : {formatGlucose(p.r.value)}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      {active && (
        <div className="glu-tip" style={{ left: `${(active.cx / W) * 100}%`, top: `${(active.cy / H) * 100}%` }}>
          <strong>{formatGlucose(active.r.value)}</strong>
          <span>
            {DATE.format(Date.parse(active.r.at))}, {formatTime(Date.parse(active.r.at))}
          </span>
        </div>
      )}
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Moment</th>
              <th>Glycémie</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id}>
                <td>
                  {DATE.format(Date.parse(r.at))}, {formatTime(Date.parse(r.at))}
                </td>
                <td>{formatGlucose(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}
