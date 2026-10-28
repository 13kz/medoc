import { useEffect, useRef, type ComponentRef } from 'react'
import { BackHandler, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import * as Speech from 'expo-speech'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { handleResponse, notifyNow, prepareNotifications, scheduleReminders, type FromNative, type Reminder } from './src/notifications'

/**
 * Coque mobile de Medoc : l'appli web dans une WebView, avec la voix, la vibration et surtout
 * des rappels programmés qui sonnent appli fermée et téléphone verrouillé.
 * Le contrat des messages est celui de `src/lib/platform.ts` côté web.
 */
const APP_URL = process.env.EXPO_PUBLIC_MEDOC_URL ?? 'https://medoc.app/patient'

type FromWeb =
  | { type: 'speak'; text: string; rate: number }
  | { type: 'stopSpeaking' }
  | { type: 'notify'; title: string; body: string }
  | { type: 'vibrate' }
  | { type: 'schedule'; reminders: Reminder[] }
  | { type: 'ready' }

export default function App() {
  const web = useRef<ComponentRef<typeof WebView>>(null)
  const ready = useRef(false)
  const canGoBack = useRef(false)
  const queue = useRef<FromNative[]>([])

  // Les réponses arrivées avant que la page écoute attendent dans `queue`.
  const deliver = (msg: FromNative) => {
    if (!ready.current || !web.current) {
      queue.current.push(msg)
      return
    }
    web.current.injectJavaScript(`window.medocNative && window.medocNative(${JSON.stringify(JSON.stringify(msg))}); true;`)
  }

  useEffect(() => {
    void prepareNotifications()
    const onResponse = (r: Notifications.NotificationResponse) =>
      void handleResponse(r).then((msg) => {
        if (msg) deliver(msg)
      })
    const sub = Notifications.addNotificationResponseReceivedListener(onResponse)
    // Appli lancée par un bouton de notification alors qu'elle était fermée.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) {
        onResponse(r)
        void Notifications.clearLastNotificationResponseAsync()
      }
    })
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false
      web.current?.goBack()
      return true
    })
    return () => {
      sub.remove()
      back.remove()
    }
  }, [])

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: FromWeb
    try {
      msg = JSON.parse(e.nativeEvent.data) as FromWeb
    } catch {
      return
    }
    switch (msg.type) {
      case 'speak':
        Speech.stop()
        Speech.speak(msg.text, { language: 'fr-FR', rate: msg.rate })
        break
      case 'stopSpeaking':
        Speech.stop()
        break
      case 'vibrate':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        break
      case 'notify':
        void notifyNow(msg.title, msg.body)
        break
      case 'schedule':
        void scheduleReminders(msg.reminders)
        break
      case 'ready':
        ready.current = true
        for (const m of queue.current.splice(0)) deliver(m)
        break
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          ref={web}
          source={{ uri: APP_URL }}
          onMessage={onMessage}
          onLoadStart={() => (ready.current = false)}
          onNavigationStateChange={(s) => (canGoBack.current = s.canGoBack)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          setSupportMultipleWindows={false}
          pullToRefreshEnabled={false}
          style={styles.root}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#000' } })
