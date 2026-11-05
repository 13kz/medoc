'use client'

import { useState } from 'react'
import { formatGlucose, glucoseLevel, glucoseWeek } from '@medoc/lib/glucose'
import { adherence, missedByMed, weekGrid, type WeekDay } from '@medoc/lib/schedule'
import type { Medication } from '@medoc/lib/types'
import { SAMPLE_PATIENTS, sampleWeek } from '@medoc/doctor/roster'
import { LIDS } from '@/lib/box'
import { useStore } from '@/lib/store'
import { cx, hhmm } from '@/lib/util'
import { Icon } from '../ui/Icon'
import { Pill } from '../ui/Pill'

const DOCTOR = 'Dr Martin'
const ROWS = LIDS.map((l) => l.id)

const SUGGESTIONS = [
  'Gardez le collyre près de la brosse à dents : vous ne l’oublierez plus le soir.',
  'Mesurez votre glycémie avant l’insuline, même quand vous vous sentez bien.',
  'Si vous oubliez la Metformine, ne doublez pas la prise suivante.',
]

/**
 * La tablette du médecin. Il voit l'observance, les oublis qui se répètent et la glycémie,
 * ajuste le traitement et envoie un conseil. Il ne reçoit pas les alertes du quotidien.
 */
export function DoctorView() {
  const { state, now } = useStore()
  const [sel, setSel] = useState<string>('demo')
  const week = weekGrid(state, now)
  const rate = adherence(week)
  const roster = [
    { id: 'demo', name: state.patient.fullName, rate, attention: missedByMed(state, now).length > 0, live: true },
    ...SAMPLE_PATIENTS.map((sp) => {
      const w = sampleWeek(sp, now)
      return { id: sp.id, name: sp.fullName, rate: adherence(w), attention: sp.attention.length > 0, live: false }
    }),
  ].sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))

  return (
    <div className="dr">
      <aside className="dr-side">
        <p className="dr-brand">
          <Icon name="stethoscope" size={18} /> Cabinet du {DOCTOR}
        </p>
        <p className="dr-side-h">Mes patients · triés par observance</p>
        <ul>
          {roster.map((r) => (
            <li key={r.id}>
              <button className={cx(sel === r.id && 'is-on')} onClick={() => setSel(r.id)}>
                <Ring value={r.rate} />
                <span className="dr-side-name">
                  {r.name}
                  {r.live && <small>Dossier relié à la démo</small>}
                </span>
                {r.attention && <i className="dr-flag" title="À surveiller" />}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="dr-main">{sel === 'demo' ? <LivePatient week={week} rate={rate} /> : <SamplePatientCard id={sel} />}</main>
    </div>
  )
}

function Ring({ value }: { value: number | null }) {
  const v = value ?? 0
  const c = 2 * Math.PI * 15
  const color = v >= 0.9 ? '#0b6e4f' : v >= 0.75 ? '#c27a07' : '#c2361f'
  return (
    <svg className="dr-ring" viewBox="0 0 36 36" width="36" height="36" aria-label={value === null ? '' : `${Math.round(v * 100)} %`}>
      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="4" />
      <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${v * c} ${c}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      <text x="18" y="21.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">
        {value === null ? '–' : Math.round(v * 100)}
      </text>
    </svg>
  )
}

function Heat({ week }: { week: WeekDay[] }) {
  return (
    <div className="dr-heat" role="table" aria-label="Semainier des 7 derniers jours">
      <div className="dr-heat-row" role="row">
        <span />
        {week.map((d) => (
          <span key={d.day} className={cx('dr-heat-day', d.isToday && 'is-today')} role="columnheader">
            {d.label}
          </span>
        ))}
      </div>
      {ROWS.map((m) => {
        const lid = LIDS.find((l) => l.id === m)!
        return (
          <div key={m} className="dr-heat-row" role="row" style={{ ['--tone' as string]: lid.tone }}>
            <span className="dr-heat-label">{lid.label}</span>
            {week.map((d) => {
              const cells = d.cells.filter((c) => c.moment === m || (m === 'midi' && c.moment === 'apres-midi'))
              const total = cells.reduce((s, c) => s + c.total, 0)
              const taken = cells.reduce((s, c) => s + c.taken, 0)
              const missed = cells.reduce((s, c) => s + c.missed, 0)
              const st = total === 0 ? 'none' : missed > 0 ? 'missed' : taken === total ? 'ok' : 'wait'
              return (
                <span key={d.day} className="dr-heat-cell" data-st={st} role="cell" title={`${taken}/${total} pris`}>
                  {st === 'missed' ? '×' : st === 'ok' ? '' : ''}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function GlucoseChart() {
  const { state, now } = useStore()
  const data = glucoseWeek(state, now)
  if (data.length < 2) return <p className="dr-muted">Pas assez de mesures cette semaine.</p>
  const W = 320
  const H = 120
  const min = 0.4
  const max = 2.8
  const x = (i: number) => 16 + (i / (data.length - 1)) * (W - 32)
  const y = (v: number) => H - 12 - ((v - min) / (max - min)) * (H - 24)
  const path = data.map((g, i) => `${i ? 'L' : 'M'}${x(i)},${y(g.value)}`).join(' ')
  const s = state.settings
  return (
    <svg className="dr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Glycémie du soir sur 7 jours">
      <rect x="0" y={y(s.hyperAbove)} width={W} height={y(s.hypoBelow) - y(s.hyperAbove)} fill="#0b6e4f" opacity=".07" rx="6" />
      <line x1="0" x2={W} y1={y(s.hypoBelow)} y2={y(s.hypoBelow)} stroke="#c2361f" strokeDasharray="3 4" strokeOpacity=".6" />
      <line x1="0" x2={W} y1={y(s.hyperAbove)} y2={y(s.hyperAbove)} stroke="#c27a07" strokeDasharray="3 4" strokeOpacity=".6" />
      <path d={path} fill="none" stroke="#14201a" strokeWidth="2" strokeLinejoin="round" />
      {data.map((g, i) => {
        const lvl = glucoseLevel(s, g.value)
        return (
          <g key={g.id}>
            <circle cx={x(i)} cy={y(g.value)} r="5" fill={lvl === 'normal' ? '#0b6e4f' : lvl === 'hypo' ? '#c2361f' : '#c27a07'} stroke="#fff" strokeWidth="2" />
            <text x={x(i)} y={y(g.value) - 10} textAnchor="middle" fontSize="9.5" fill="#4b5a52">
              {formatGlucose(g.value).replace(' g/L', '')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function DoseEditor({ med }: { med: Medication }) {
  const { now, dispatch } = useStore()
  const m = med.dose.match(/^(\d+)(.*)$/)
  const n = m ? Number(m[1]) : null
  const set = (patch: Partial<Medication>) => dispatch({ type: 'upsertMed', med: { ...med, ...patch }, by: DOCTOR, at: now })
  return (
    <li className={cx('dr-med', !med.active && 'is-off')}>
      <Pill med={med} size="sm" />
      <div className="dr-med-name">
        <strong>{med.name}</strong>
        <small>{med.asNeeded ? 'Si besoin' : med.times.map(hhmm).join(' · ')}</small>
      </div>
      <div className="dr-med-dose">
        {n !== null && med.active ? (
          <>
            <button onClick={() => set({ dose: `${Math.max(1, n - (n > 4 ? 2 : 1))}${m![2]}` })} aria-label="Diminuer la dose">
              −
            </button>
            <span>{med.dose}</span>
            <button onClick={() => set({ dose: `${n + (n > 4 ? 2 : 1)}${m![2]}` })} aria-label="Augmenter la dose">
              +
            </button>
          </>
        ) : (
          <span>{med.active ? med.dose : 'Arrêté'}</span>
        )}
      </div>
      <button className="dr-link" onClick={() => set({ active: !med.active })}>
        {med.active ? 'Arrêter' : 'Reprendre'}
      </button>
    </li>
  )
}

function LivePatient({ week, rate }: { week: WeekDay[]; rate: number | null }) {
  const { state, now, dispatch } = useStore()
  const p = state.patient
  const missed = missedByMed(state, now)
  const [text, setText] = useState('')
  const send = (t: string) => {
    if (!t.trim()) return
    dispatch({ type: 'addNote', note: { id: `n-${now}`, at: new Date(now).toISOString(), from: DOCTOR, text: t.trim(), acknowledged: false } })
    setText('')
  }
  const gly = glucoseWeek(state, now)
  const hypo = gly.filter((g) => glucoseLevel(state.settings, g.value) === 'hypo').length
  return (
    <>
      <header className="dr-head">
        <div>
          <h3>{p.fullName}</h3>
          <p>
            {p.age} ans · {p.conditions.join(' · ')}
          </p>
        </div>
        <span className="dr-tag">Suivie par Naz (fils), Sylvie (voisine)</span>
      </header>
      <div className="dr-kpis">
        <div>
          <strong>{rate === null ? '–' : `${Math.round(rate * 100)} %`}</strong>
          <span>observance sur 7 jours</span>
        </div>
        <div>
          <strong>{missed.reduce((s, x) => s + x.count, 0)}</strong>
          <span>prises oubliées</span>
        </div>
        <div className={cx(hypo > 0 && 'is-warn')}>
          <strong>{hypo}</strong>
          <span>hypoglycémie{hypo > 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="dr-grid">
        <section className="dr-card">
          <h4>Semainier</h4>
          <Heat week={week} />
        </section>
        <section className="dr-card">
          <h4>À surveiller</h4>
          {missed.length === 0 ? (
            <p className="dr-muted">Aucun oubli répété.</p>
          ) : (
            <ul className="dr-watch">
              {missed.slice(0, 3).map((x) => (
                <li key={`${x.med.id}${x.time}`}>
                  <b>{x.count}×</b> {x.med.name.replace(/ \d.*$/, '')} de {hhmm(x.time)}
                </li>
              ))}
            </ul>
          )}
          <h4>Glycémie avant l’insuline</h4>
          <GlucoseChart />
        </section>
        <section className="dr-card dr-wide">
          <h4>Traitement</h4>
          <ul className="dr-meds">
            {state.medications.map((m) => (
              <DoseEditor key={m.id} med={m} />
            ))}
          </ul>
          <p className="dr-muted">Chaque changement est expliqué au patient avec ses mots et visible par ses proches.</p>
        </section>
        <section className="dr-card dr-wide">
          <h4>Conseil au patient</h4>
          <div className="dr-suggest">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setText(s)}>
                {s.split(':')[0].split(',')[0]}
              </button>
            ))}
          </div>
          <div className="dr-compose">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrit simplement : il sera lu à voix haute sur le téléphone de la patiente." rows={2} />
            <button onClick={() => send(text)} disabled={!text.trim()}>
              Envoyer
            </button>
          </div>
          {state.notes.slice(0, 2).map((n) => (
            <p key={n.id} className="dr-sent">
              <span>{n.text}</span>
              <em className={cx(n.acknowledged && 'is-ok')}>{n.acknowledged ? 'Lu par la patiente' : 'Pas encore lu'}</em>
            </p>
          ))}
        </section>
      </div>
    </>
  )
}

function SamplePatientCard({ id }: { id: string }) {
  const { now } = useStore()
  const sp = SAMPLE_PATIENTS.find((s) => s.id === id)!
  const week = sampleWeek(sp, now)
  const rate = adherence(week)
  return (
    <>
      <header className="dr-head">
        <div>
          <h3>{sp.fullName}</h3>
          <p>
            {sp.age} ans · {sp.conditions.join(' · ')}
          </p>
        </div>
        <span className="dr-tag">Suivi par {sp.followers.join(', ')}</span>
      </header>
      <div className="dr-kpis">
        <div>
          <strong>{rate === null ? '–' : `${Math.round(rate * 100)} %`}</strong>
          <span>observance sur 7 jours</span>
        </div>
        <div className={cx(sp.attention.length > 0 && 'is-warn')}>
          <strong>{sp.attention.length}</strong>
          <span>point{sp.attention.length > 1 ? 's' : ''} d’attention</span>
        </div>
      </div>
      <div className="dr-grid">
        <section className="dr-card">
          <h4>Semainier</h4>
          <Heat week={week} />
        </section>
        <section className="dr-card">
          <h4>À surveiller</h4>
          {sp.attention.length ? (
            <ul className="dr-watch">
              {sp.attention.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="dr-muted">Rien à signaler cette semaine.</p>
          )}
          <p className="dr-muted">Patient d’exemple. Le dossier de Mireille Benali, lui, est relié aux téléphones de la démo.</p>
        </section>
      </div>
    </>
  )
}
