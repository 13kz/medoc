'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Le menu du site : une réglette horaire posée en bas de l'écran, comme le bord d'un pilulier.
 * Faire défiler la page fait passer la journée de Mireille ; toucher un couvercle y saute.
 */
export const MOMENTS = [
  { id: 'reveil', time: '07:55', label: 'Réveil', tone: '#ffe9a0' },
  { id: 'matin', time: '08:00', label: 'Mireille', tone: '#ffd43b' },
  { id: 'proches', time: '09:00', label: 'Naz', tone: '#ff9f43' },
  { id: 'medecin', time: '12:30', label: 'Dr Martin', tone: '#ff9f43' },
  { id: 'notice', time: '15:00', label: 'La notice', tone: '#7fd6a4' },
  { id: 'essayer', time: '19:30', label: 'À vous', tone: '#6cb4ff' },
  { id: 'nuit', time: '22:00', label: 'Bonne nuit', tone: '#b69cff' },
] as const

const LIDS = [
  { label: 'Matin', tone: '#ffd43b', from: 6 * 60, to: 11 * 60, target: 'matin' },
  { label: 'Midi', tone: '#ff9f43', from: 11 * 60, to: 18 * 60, target: 'medecin' },
  { label: 'Soir', tone: '#6cb4ff', from: 18 * 60, to: 21 * 60, target: 'essayer' },
  { label: 'Coucher', tone: '#b69cff', from: 21 * 60, to: 23 * 60, target: 'nuit' },
]

const START = 6 * 60
const END = 23 * 60
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fmt = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.floor(min % 60)
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function Rail() {
  const [min, setMin] = useState(toMin(MOMENTS[0].time))
  const [idx, setIdx] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const els = MOMENTS.map((m) => document.getElementById(m.id))
    const update = () => {
      raf.current = 0
      const mid = window.innerHeight * 0.45
      let i = 0
      for (let k = 0; k < els.length; k++) {
        const el = els[k]
        if (el && el.getBoundingClientRect().top <= mid) i = k
      }
      const el = els[i]
      const next = MOMENTS[i + 1]
      let t = toMin(MOMENTS[i].time)
      if (el && next) {
        const r = el.getBoundingClientRect()
        const p = Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height)))
        t += (toMin(next.time) - t) * p
      }
      setIdx(i)
      setMin(t)
      document.documentElement.style.setProperty('--now-tone', MOMENTS[i].tone)
    }
    const on = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])

  const pct = (m: number) => `${((m - START) / (END - START)) * 100}%`
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <nav className="rail" aria-label="La journée de Mireille">
      <a className="rail-logo" href="#reveil" aria-label="Medoc, retour au réveil">
        <i />
        <i />
        <i />
        <i />
      </a>
      <div className="rail-clock" aria-live="off">
        <strong>{fmt(min)}</strong>
        <span>{MOMENTS[idx].label}</span>
      </div>
      <div className="rail-ruler">
        {LIDS.map((l) => (
          <button key={l.label} className="rail-lid" style={{ left: pct(l.from), width: `calc(${pct(l.to)} - ${pct(l.from)})`, ['--tone' as string]: l.tone }} onClick={() => go(l.target)}>
            <span>{l.label}</span>
          </button>
        ))}
        {Array.from({ length: END / 60 - START / 60 + 1 }, (_, k) => (
          <i key={k} className="rail-tick" style={{ left: pct(START + k * 60) }} data-major={(START / 60 + k) % 3 === 0} />
        ))}
        {MOMENTS.map((m, k) => (
          <button key={m.id} className="rail-stop" data-on={k === idx} style={{ left: pct(toMin(m.time)) }} onClick={() => go(m.id)} aria-label={`${m.time.replace(':', ' h ')}, ${m.label}`} title={m.label} />
        ))}
        <span className="rail-now" style={{ left: pct(min) }} aria-hidden="true" />
      </div>
      <button className="rail-cta" onClick={() => go('essayer')}>
        Essayer
      </button>
    </nav>
  )
}
