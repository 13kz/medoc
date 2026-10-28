/**
 * Pont vers l'appareil. Dans la future coque React Native (EAS), la page tourne
 * dans une WebView : on délègue alors la voix, les notifications et la vibration
 * au natif (expo-speech, expo-notifications, expo-haptics) via postMessage.
 * Dans un navigateur, on utilise les API web équivalentes.
 */

import { webNotify } from './pwa'
import type { Reminder } from './reminders'

type NativeMessage =
  | { type: 'speak'; text: string; rate: number }
  | { type: 'stopSpeaking' }
  | { type: 'notify'; title: string; body: string }
  | { type: 'vibrate' }
  /** Remplace tous les rappels programmés sur le téléphone. */
  | { type: 'schedule'; reminders: Reminder[] }
  /** La page écoute `window.medocNative` : la coque peut envoyer les réponses en attente. */
  | { type: 'ready' }

interface RNWebView {
  postMessage(message: string): void
}

function native(): RNWebView | undefined {
  return (window as unknown as { ReactNativeWebView?: RNWebView }).ReactNativeWebView
}

function post(msg: NativeMessage): boolean {
  const rn = native()
  if (!rn) return false
  rn.postMessage(JSON.stringify(msg))
  return true
}

export const isNative = () => native() !== undefined

export const canSpeak = () => isNative() || 'speechSynthesis' in window

function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang === 'fr-FR' && v.localService) ?? voices.find((v) => v.lang.startsWith('fr'))
}

export function speak(text: string, rate = 0.9): void {
  if (post({ type: 'speak', text, rate })) return
  if (!('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'fr-FR'
  u.rate = rate
  const voice = frenchVoice()
  if (voice) u.voice = voice
  synth.speak(u)
}

export function stopSpeaking(): void {
  if (post({ type: 'stopSpeaking' })) return
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function vibrate(): void {
  if (post({ type: 'vibrate' })) return
  navigator.vibrate?.([200, 100, 200])
}

/** Notification système : le natif dans la coque mobile, sinon une notification web si l'appli n'est pas à l'écran. */
export function systemNotify(title: string, body: string, tag?: string): void {
  if (post({ type: 'notify', title, body })) return
  void webNotify(title, body, { tag })
}

/** Programme les rappels dans la coque mobile ; sans effet dans un navigateur. */
export const scheduleReminders = (reminders: Reminder[]) => post({ type: 'schedule', reminders })

export const nativeReady = () => post({ type: 'ready' })

let audio: AudioContext | undefined

/** Petit carillon doux pour annoncer une prise. */
export function chime(): void {
  try {
    audio ??= new AudioContext()
    const ctx = audio
    const t = ctx.currentTime
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + i * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + i * 0.25)
      osc.stop(t + i * 0.25 + 0.65)
    }
  } catch {
    // Audio bloqué tant que l'utilisateur n'a pas touché l'écran.
  }
}

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function recognitionCtor(): (new () => Recognition) | undefined {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined
}

export const canListen = () => recognitionCtor() !== undefined

/** Écoute une courte phrase et renvoie la transcription (ou null). */
export function listenOnce(onText: (text: string | null) => void): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    onText(null)
    return () => {}
  }
  const rec = new Ctor()
  rec.lang = 'fr-FR'
  rec.interimResults = false
  rec.maxAlternatives = 3
  let done = false
  const finish = (text: string | null) => {
    if (done) return
    done = true
    onText(text)
  }
  rec.onresult = (e) => {
    const alts = Array.from(e.results[0] ?? [])
    finish(alts.map((a) => a.transcript).join(' | '))
  }
  rec.onerror = () => finish(null)
  rec.onend = () => finish(null)
  rec.start()
  return () => rec.stop()
}

/** Reconnaît une confirmation orale : « c'est pris », « oui », « fait »… */
export function isConfirmation(text: string): boolean {
  return /\b(pris|prise|oui|fait|ok|d'accord|c'est bon|termin)/i.test(text)
}

export function isPostpone(text: string): boolean {
  return /\b(plus tard|attends?|tout à l'heure|pas maintenant|après)\b/i.test(text)
}
