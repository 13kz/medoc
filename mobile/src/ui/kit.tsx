import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { IconName } from '../core'
import { C, F, TOUCH } from '../theme'
import { Icon } from './Icon'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'giant'
const SIZES: Record<Size, number> = { xs: 15, sm: 18, md: 21, lg: 26, xl: 34, xxl: 46, giant: 64 }

/** Texte de l'appli : toujours Atkinson Hyperlegible, et agrandi avec le réglage du système. */
export function T({ size = 'md', bold, color = C.text, style, ...rest }: TextProps & { size?: Size; bold?: boolean; color?: string; style?: StyleProp<TextStyle> }) {
  const fs = SIZES[size]
  return <Text {...rest} style={[{ fontFamily: bold ? F.bold : F.regular, fontSize: fs, lineHeight: Math.round(fs * 1.25), color }, style]} />
}

export const tap = () => void Haptics.selectionAsync().catch(() => {})

type BtnProps = {
  label: string
  onPress: () => void
  icon?: IconName
  tone?: string
  ink?: string
  variant?: 'solid' | 'ghost'
  size?: 'md' | 'lg' | 'xl'
  hint?: string
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}

export function Btn({ label, onPress, icon, tone = C.paper, ink = C.ink, variant = 'solid', size = 'md', hint, style, disabled }: BtnProps) {
  const h = size === 'xl' ? 96 : size === 'lg' ? 72 : TOUCH
  const solid = variant === 'solid'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap()
        onPress()
      }}
      style={({ pressed }) => [
        s.btn,
        { minHeight: h, backgroundColor: solid ? tone : 'transparent', borderColor: solid ? tone : C.line, opacity: disabled ? 0.4 : 1 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={size === 'xl' ? 38 : size === 'lg' ? 30 : 24} color={solid ? ink : C.text} stroke={2.4} />}
      <T size={size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'} bold color={solid ? ink : C.text}>
        {label}
      </T>
    </Pressable>
  )
}

/** Petit bouton rond à icône seule, toujours avec un libellé pour les lecteurs d'écran. */
export function IconBtn({ icon, label, onPress, color = C.text, bg = C.night3 }: { icon: IconName; label: string; onPress: () => void; color?: string; bg?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap()
        onPress()
      }}
      hitSlop={8}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: bg }, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} color={color} size={24} />
    </Pressable>
  )
}

/** Étiquette de section, écrite à la main, comme sur un pilulier. */
export function Label({ children, color = C.muted }: { children: ReactNode; color?: string }) {
  return (
    <T size="sm" bold color={color} style={{ marginTop: 20, marginBottom: 8 }} accessibilityRole="header">
      {children}
    </T>
  )
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  return <View style={[s.card, tone ? { borderLeftColor: tone, borderLeftWidth: 6 } : null, style]}>{children}</View>
}

export function Field({ label, value, onChange, placeholder, multiline, keyboard, autoCap = 'sentences' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  keyboard?: 'default' | 'numeric' | 'number-pad'
  autoCap?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <T size="sm" bold color={C.muted} style={{ marginBottom: 6 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6f7a74"
        multiline={multiline}
        keyboardType={keyboard}
        autoCapitalize={autoCap}
        style={[s.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]}
      />
    </View>
  )
}

export function Toggle({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={desc}
      onPress={() => {
        tap()
        onChange(!value)
      }}
      style={s.toggle}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T size="md">{label}</T>
        {desc && (
          <T size="xs" color={C.muted}>
            {desc}
          </T>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.taken, false: C.line }} thumbColor={C.paper} importantForAccessibility="no" />
    </Pressable>
  )
}

/** Choix parmi quelques valeurs, en pastilles. */
export function Choice<V extends string | number>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.choices}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              tap()
              onChange(o.value)
            }}
            style={[s.choice, on && { backgroundColor: C.paper, borderColor: C.paper }]}
          >
            <T size="sm" bold color={on ? C.ink : C.text}>
              {o.label}
            </T>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Stepper « − 30 min + » pour les délais. */
export function Stepper({ label, value, onChange, step, min, max, unit }: { label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit: string }) {
  return (
    <View style={s.toggle} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
    >
      <T size="md" style={{ flex: 1 }}>
        {label}
      </T>
      <IconBtn icon="minus" label={`Moins ${step}`} onPress={() => onChange(Math.max(min, value - step))} />
      <T size="md" bold style={{ minWidth: 86, textAlign: 'center' }}>
        {value} {unit}
      </T>
      <IconBtn icon="plus" label={`Plus ${step}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  )
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 22, paddingHorizontal: 22, borderWidth: 2 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.night2, borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  input: { backgroundColor: C.night3, color: C.text, fontFamily: F.regular, fontSize: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, minHeight: TOUCH, borderWidth: 1, borderColor: C.line },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TOUCH, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  choice: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: C.line, justifyContent: 'center' },
})
