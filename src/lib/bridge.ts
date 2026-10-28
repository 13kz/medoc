import type { Action } from './reducer'
import type { AppState } from './types'

/**
 * Messages de la coque mobile vers la page : la réponse à une notification (« J'ai pris », « Plus tard »).
 * La coque appelle `window.medocNative(message)` une fois la page prête.
 */
export type FromNative = { type: 'take'; doseKeys: string[]; at: number } | { type: 'snooze'; doseKeys: string[]; until: number }

/** Les actions à appliquer au dossier ; une prise déjà cochée entre-temps n'est pas recomptée. */
export function actionsFromNative(msg: FromNative, state: AppState): Action[] {
  if (!msg || !Array.isArray(msg.doseKeys)) return []
  const keys = msg.doseKeys.filter((k) => typeof k === 'string' && !state.intakes[k])
  if (msg.type === 'take' && Number.isFinite(msg.at)) return keys.map((doseKey) => ({ type: 'take', doseKey, by: 'patient', at: msg.at }))
  if (msg.type === 'snooze' && Number.isFinite(msg.until)) return keys.map((doseKey) => ({ type: 'snooze', doseKey, until: msg.until }))
  return []
}

/** Branche le récepteur ; renvoie de quoi le débrancher. */
export function onNativeMessage(handler: (msg: FromNative) => void): () => void {
  const w = window as unknown as { medocNative?: (m: FromNative | string) => void }
  w.medocNative = (m) => handler(typeof m === 'string' ? (JSON.parse(m) as FromNative) : m)
  return () => {
    delete w.medocNative
  }
}
