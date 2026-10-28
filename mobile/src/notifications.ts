import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

/**
 * Rappels de prise programmés sur le téléphone. La page web calcule la liste (`src/lib/reminders.ts`)
 * et l'envoie à chaque changement ; ici on la remplace telle quelle.
 */
export type Reminder = { id: string; at: number; title: string; body: string; doseKeys: string[]; snoozeMin: number }

/** Réponse à une notification, transmise à la page (`src/lib/bridge.ts`). */
export type FromNative = { type: 'take'; doseKeys: string[]; at: number } | { type: 'snooze'; doseKeys: string[]; until: number }

const CATEGORY = 'prise'
const CHANNEL = 'prises'

type Data = { kind?: string; doseKeys?: string[]; snoozeMin?: number; group?: string }

export async function prepareNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  })
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    // « J'ai pris » ouvre l'appli : la page coche la prise et l'annonce, c'est le chemin le plus sûr.
    { identifier: 'take', buttonTitle: 'J’ai pris', options: { opensAppToForeground: true } },
    { identifier: 'snooze', buttonTitle: 'Plus tard', options: { opensAppToForeground: false } },
  ])
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Prises de médicaments',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }
  const perm = await Notifications.getPermissionsAsync()
  if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync()
}

const at = (date: number): Notifications.DateTriggerInput => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(date), channelId: CHANNEL })

/** Remplace tous les rappels de prise par la nouvelle liste. */
export async function scheduleReminders(list: Reminder[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    scheduled.filter((n) => (n.content.data as Data | null)?.kind === 'prise').map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )
  const now = Date.now()
  for (const r of list) {
    if (r.at <= now) continue
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: 'default',
        categoryIdentifier: CATEGORY,
        interruptionLevel: 'timeSensitive',
        data: { kind: 'prise', doseKeys: r.doseKeys, snoozeMin: r.snoozeMin, group: r.id.split('|')[1] },
      },
      trigger: at(r.at),
    })
  }
}

/** Notification immédiate (appli ouverte mais en arrière-plan). */
export const notifyNow = (title: string, body: string) =>
  Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null })

/**
 * Traite le bouton touché. « Plus tard » est géré ici même appli fermée : un nouveau rappel est
 * programmé ; la page en est informée à sa prochaine ouverture.
 */
export async function handleResponse(r: Notifications.NotificationResponse): Promise<FromNative | null> {
  const { content, identifier } = r.notification.request
  const data = content.data as Data | null
  if (data?.kind !== 'prise' || !Array.isArray(data.doseKeys)) return null
  if (r.actionIdentifier !== 'take' && r.actionIdentifier !== 'snooze') return null
  await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {})
  // Le second rappel du même moment n'a plus lieu d'être.
  if (data.group) await Notifications.cancelScheduledNotificationAsync(`retard|${data.group}`).catch(() => {})
  if (r.actionIdentifier === 'take') return { type: 'take', doseKeys: data.doseKeys, at: Date.now() }
  const until = Date.now() + (data.snoozeMin ?? 10) * 60000
  await Notifications.scheduleNotificationAsync({
    identifier: `report|${identifier}|${until}`,
    content: { title: 'Rappel', body: content.body ?? '', sound: 'default', categoryIdentifier: CATEGORY, interruptionLevel: 'timeSensitive', data: { ...data, kind: 'prise' } },
    trigger: at(until),
  })
  return { type: 'snooze', doseKeys: data.doseKeys, until }
}
