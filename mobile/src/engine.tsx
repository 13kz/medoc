import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { deliveredAlerts, planAlerts, remindersSignature, upcomingReminders, type Role } from './core'
import { handleResponse, notifyNow, prepareNotifications, scheduleReminders } from './notifications'
import { useStore } from './store'

/**
 * Ce qui tourne en fond, selon le profil :
 * - patient et aidant : le moteur d'alertes partagé (relance, puis proches), comme le serveur ;
 * - patient : les rappels des 3 prochains jours programmés dans le téléphone, et les boutons
 *   « J'ai pris » / « Plus tard » des notifications ;
 * - aidant : une notification quand une alerte pour les proches arrive, appli ouverte.
 */
export function Engine({ role }: { role: Role }) {
  const { state, dispatch, now } = useStore()

  useEffect(() => {
    void prepareNotifications().catch(() => {})
  }, [])

  // Moteur d'alertes. Les actions sont idempotentes : le serveur peut créer les mêmes.
  useEffect(() => {
    if (role === 'medecin') return
    const plan = planAlerts(state, now)
    for (const alert of plan.create) dispatch({ type: 'addAlert', alert })
    for (const r of plan.resolve) dispatch({ type: 'resolveAlert', id: r.id, at: r.at })
  }, [state, now, role, dispatch])

  // Rappels programmés : on ne reprogramme que si la liste change.
  const signature = useRef('')
  useEffect(() => {
    if (role !== 'patient') return
    const list = upcomingReminders(state, now)
    const sig = remindersSignature(list)
    if (sig === signature.current) return
    signature.current = sig
    void scheduleReminders(list).catch(() => {})
  }, [state, now, role])

  // Boutons des notifications, y compris quand ils ont lancé l'appli.
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  useEffect(() => {
    if (role !== 'patient') return
    const apply = (r: Notifications.NotificationResponse) =>
      void handleResponse(r).then((msg) => {
        if (!msg) return
        for (const doseKey of msg.doseKeys) {
          if (msg.type === 'take') dispatchRef.current({ type: 'take', doseKey, by: 'patient', at: msg.at })
          else dispatchRef.current({ type: 'snooze', doseKey, until: msg.until })
        }
      })
    const sub = Notifications.addNotificationResponseReceivedListener(apply)
    void Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (!r) return
        apply(r)
        void Notifications.clearLastNotificationResponseAsync()
      })
      .catch(() => {})
    return () => sub.remove()
  }, [role])

  // Aidant : prévenir des nouvelles alertes reçues pendant que l'appli tourne.
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (role !== 'aidant') return
    const delivered = deliveredAlerts(state, now).filter((a) => !a.resolvedAt)
    if (!seen.current) {
      seen.current = new Set(delivered.map((a) => a.id))
      return
    }
    for (const a of delivered) {
      if (seen.current.has(a.id)) continue
      seen.current.add(a.id)
      void notifyNow('Prise oubliée', a.message).catch(() => {})
    }
  }, [state, now, role])

  return null
}
