'use client'

import { useEffect, useState } from 'react'

/** « 8 h 05 » à partir d'un instant en ms. */
export const hm = (ms: number) => {
  const d = new Date(ms)
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/** « 8 h » ou « 19 h 30 » à partir de « HH:MM ». */
export const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

export function speak(text: string, rate = 0.95) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const s = window.speechSynthesis
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'fr-FR'
  u.rate = rate
  const voice = s.getVoices().find((v) => v.lang.startsWith('fr'))
  if (voice) u.voice = voice
  s.speak(u)
  return true
}

/** Faux tant que le composant n'est pas monté côté navigateur (l'état de démo dépend de l'heure). */
export function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
