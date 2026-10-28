import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { asNeededMeds } from '../lib/asNeeded'
import { formatGlucose } from '../lib/glucose'
import { adherenceByMed, historyCsv, historyDays, totalAdherence, type HistoryDay } from '../lib/history'
import { formatTime } from '../lib/schedule'
import { useStore } from '../lib/store'
import type { AppState } from '../lib/types'
import { Icon } from './Icon'

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function download(name: string, text: string) {
  // Le BOM fait reconnaître l'UTF-8 (accents) par les tableurs.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ce qui s'est passé un jour donné, dans l'ordre de la journée. */
function DayEntries({ state, d }: { state: AppState; d: HistoryDay }) {
  const name = (id: string) => state.medications.find((m) => m.id === id)?.name ?? id
  const items = [
    ...d.doses.map((x) => ({
      key: x.key,
      sort: x.time,
      text: `${x.time} ${x.med.name}`,
      meta:
        x.status === 'pris' && x.intake
          ? `pris à ${formatTime(Date.parse(x.intake.takenAt))}${x.intake.by === 'aidant' ? ' (validé par un proche)' : ''}`
          : x.status === 'en-retard'
            ? 'oublié'
            : 'à venir',
      kind: x.status === 'pris' ? 'ok' : x.status === 'en-retard' ? 'miss' : 'later',
    })),
    ...d.asNeeded.map((i) => {
      const t = formatTime(Date.parse(i.takenAt))
      return { key: i.id, sort: t, text: `${t} ${name(i.medId)}`, meta: i.early ? 'si besoin, trop tôt' : 'si besoin', kind: i.early ? 'miss' : 'ok' }
    }),
    ...d.glucose.map((g) => {
      const t = formatTime(Date.parse(g.at))
      return { key: g.id, sort: t, text: `${t} Glycémie`, meta: formatGlucose(g.value), kind: 'info' }
    }),
  ].sort((a, b) => a.sort.localeCompare(b.sort))
  return (
    <ul className="hist-entries">
      {items.map((i) => (
        <li key={i.key} className={`he-${i.kind}`}>
          <span className="he-mark" aria-hidden="true">
            <Icon name={i.kind === 'ok' ? 'check' : i.kind === 'miss' ? 'close' : i.kind === 'info' ? 'water' : 'snooze'} size={14} stroke={2.6} />
          </span>
          <span>{i.text}</span>
          <span className="he-meta">{i.meta}</span>
        </li>
      ))}
    </ul>
  )
}

/** Rapport imprimable (ou enregistrable en PDF) : observance et journal détaillé. */
function PrintReport({ state, history, onDone }: { state: AppState; history: HistoryDay[]; onDone: () => void }) {
  useEffect(() => {
    document.body.classList.add('printing')
    const done = () => {
      document.body.classList.remove('printing')
      onDone()
    }
    window.addEventListener('afterprint', done)
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('printing')
    }
  }, [onDone])
  const byMed = adherenceByMed(history)
  return createPortal(
    <article className="print-report">
      <h1>Suivi des médicaments de {state.patient.fullName}</h1>
      <p>
        {history.length} jours, du {DAY_FMT.format(history.at(-1)!.ms)} au {DAY_FMT.format(history[0].ms)}. Observance : {pct(totalAdherence(history))}.
      </p>
      <h2>Par médicament</h2>
      <table>
        <thead>
          <tr>
            <th>Médicament</th>
            <th>Prises faites</th>
            <th>Observance</th>
            <th>Plus d’une heure de retard</th>
          </tr>
        </thead>
        <tbody>
          {byMed.map((a) => (
            <tr key={a.med.id}>
              <td>{a.med.name}</td>
              <td>
                {a.taken} sur {a.due}
              </td>
              <td>{pct(a.taken / a.due)}</td>
              <td>{a.late}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Journal</h2>
      {history.map((d) => (
        <section key={d.day}>
          <h3>{cap(DAY_FMT.format(d.ms))}</h3>
          <DayEntries state={state} d={d} />
        </section>
      ))}
    </article>,
    document.body,
  )
}

/** Historique des 30 derniers jours, pour l'aidant et le médecin. */
export function HistoryView({ now, onClose }: { now: number; onClose: () => void }) {
  const { state } = useStore()
  const [printing, setPrinting] = useState(false)
  const history = historyDays(state, now, 30)
  // Jours avant l'ajout du premier médicament : rien à montrer.
  const shown = history.filter((d) => d.doses.length + d.asNeeded.length + d.glucose.length > 0)
  const byMed = adherenceByMed(history)
  const prn = asNeededMeds(state)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet hist"
        role="dialog"
        aria-modal="true"
        aria-label="Historique des 30 derniers jours"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
          <strong>30 derniers jours</strong>
          <span className="sheet-grip" aria-hidden="true" />
          <span />
        </div>

        <p className="hist-total">
          <strong>{pct(totalAdherence(history))}</strong> des prises faites
        </p>

        <ul className="hist-meds" aria-label="Observance par médicament">
          {byMed.map((a) => (
            <li key={a.med.id}>
              <span className="hm-name">{a.med.name}</span>
              <span className="hm-bar" aria-hidden="true">
                <span style={{ width: `${(a.taken / a.due) * 100}%` }} />
              </span>
              <span className="hm-val">
                {a.taken}/{a.due}
              </span>
            </li>
          ))}
          {prn.map((m) => (
            <li key={m.id}>
              <span className="hm-name">{m.name}</span>
              <span className="hm-val">{state.asNeededIntakes.filter((i) => i.medId === m.id && now - Date.parse(i.takenAt) < 30 * 86400000).length} fois (si besoin)</span>
            </li>
          ))}
        </ul>

        <div className="p-row">
          <button className="secondary" onClick={() => setPrinting(true)}>
            <Icon name="list" size={18} />
            Imprimer ou PDF
          </button>
          <button className="secondary" onClick={() => download(`medoc-${state.patient.name.toLowerCase().replace(/\W+/g, '-')}-30-jours.csv`, historyCsv(state, history))}>
            <Icon name="box" size={18} />
            Exporter (CSV)
          </button>
        </div>

        <div className="hist-days">
          {shown.map((d, i) => {
            const due = d.doses.filter((x) => x.status === 'pris' || x.status === 'en-retard')
            const taken = due.filter((x) => x.status === 'pris').length
            return (
              <details key={d.day} open={i === 0}>
                <summary>
                  <span>{cap(DAY_FMT.format(d.ms))}</span>
                  <span className={`hist-count ${taken < due.length ? 'miss' : ''}`}>{due.length ? `${taken}/${due.length}` : ''}</span>
                </summary>
                <DayEntries state={state} d={d} />
              </details>
            )
          })}
        </div>
      </div>
      {printing && <PrintReport state={state} history={shown} onDone={() => setPrinting(false)} />}
    </div>
  )
}
