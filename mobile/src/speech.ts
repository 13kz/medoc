import * as Speech from 'expo-speech'
import * as Haptics from 'expo-haptics'

/** Lecture à voix haute en français, une phrase à la fois. */
export function speak(text: string, rate = 0.9) {
  Speech.stop()
  Speech.speak(text, { language: 'fr-FR', rate })
}

export const stopSpeaking = () => Speech.stop()

export const buzz = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
export const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
