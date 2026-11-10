import { useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useU } from '../theme'
import { Icon } from '../ui/Icon'
import { T } from '../ui/kit'

const HOLD_MS = 900

/**
 * « J'ai pris », à appui long comme sur le site : la jauge se remplit sous le doigt, puis la prise
 * est notée. Un simple toucher ne valide rien (pas de prise cochée par erreur dans la poche) ;
 * avec VoiceOver ou TalkBack, le double toucher valide directement.
 */
export function TakeButton({ label = 'J’ai pris', onTake, onHint, screenReader, big = true, grow = false }: { label?: string; onTake: () => void; onHint: () => void; screenReader: boolean; big?: boolean; /** Prend toute la hauteur disponible (mode voix). */ grow?: boolean }) {
  const u = useU()
  const fill = useRef(new Animated.Value(0)).current
  const [holding, setHolding] = useState(false)
  const start = () => {
    setHolding(true)
    void Haptics.selectionAsync().catch(() => {})
    Animated.timing(fill, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start()
  }
  const stop = () => {
    setHolding(false)
    Animated.timing(fill, { toValue: 0, duration: 180, useNativeDriver: false }).start()
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={screenReader ? undefined : 'Appuyez longtemps pour confirmer'}
      onPressIn={screenReader ? undefined : start}
      onPressOut={screenReader ? undefined : stop}
      delayLongPress={HOLD_MS}
      onLongPress={
        screenReader
          ? undefined
          : () => {
              stop()
              onTake()
            }
      }
      onPress={() => (screenReader ? onTake() : holding ? undefined : onHint())}
      style={[s.btn, { minHeight: big ? 120 : 84, backgroundColor: u.accent }, grow && { flex: 1 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.22)', width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="check" size={big ? 40 : 30} color={u.onAccent} stroke={3} />
        <T size={big ? 'xxl' : 'xl'} face="black" color={u.onAccent}>
          {label}
        </T>
      </View>
      {!screenReader && (
        <T size="sm" bold color={u.onAccent} style={{ opacity: 0.75 }}>
          Appuyez longtemps
        </T>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({ btn: { borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingVertical: 14 } })
