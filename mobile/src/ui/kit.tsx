import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { IconName } from '../core'
import { F, TOUCH, useU } from '../theme'
import { Icon } from './Icon'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'giant'
const SIZES: Record<Size, number> = { xs: 14, sm: 17, md: 20, lg: 25, xl: 33, xxl: 46, giant: 68 }
type Face = 'text' | 'bold' | 'black' | 'display' | 'displayBold' | 'italic'

/**
 * Texte de l'appli : Atkinson Hyperlegible Next pour lire, Fraunces pour les titres (`face`),
 * agrandi avec le réglage du système.
 */
export function T({ size = 'md', bold, face, color, style, ...rest }: TextProps & { size?: Size; bold?: boolean; face?: Face; color?: string; style?: StyleProp<TextStyle> }) {
  const u = useU()
  const fs = SIZES[size]
  const family = F[face ?? (bold ? 'bold' : 'text')]
  const display = face === 'display' || face === 'displayBold' || face === 'italic'
  return <Text {...rest} style={[{ fontFamily: family, fontSize: fs, lineHeight: Math.round(fs * (display ? 1.12 : 1.28)), color: color ?? u.fg, letterSpacing: display && fs > 30 ? -0.5 : 0 }, style]} />
}

/** Petite étiquette en capitales espacées, comme sur le site (« C'EST L'HEURE »). */
export function Kicker({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const u = useU()
  return (
    <T size="sm" face="black" color={color ?? u.muted} style={[{ letterSpacing: 1.4, textTransform: 'uppercase' }, style]} accessibilityRole="header">
      {children}
    </T>
  )
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

export function Btn({ label, onPress, icon, tone, ink, variant = 'solid', size = 'md', hint, style, disabled }: BtnProps) {
  const u = useU()
  const h = size === 'xl' ? 96 : size === 'lg' ? 68 : TOUCH
  const solid = variant === 'solid'
  const bg = tone ?? u.accent
  const fg = solid ? ink ?? u.onAccent : u.fg
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
        { minHeight: h, borderRadius: size === 'md' ? 999 : 28, backgroundColor: solid ? bg : 'transparent', borderColor: solid ? bg : u.cardLine, opacity: disabled ? 0.4 : 1 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={size === 'xl' ? 36 : size === 'lg' ? 28 : 22} color={fg} stroke={2.4} />}
      <T size={size === 'xl' ? 'xl' : size === 'lg' ? 'lg' : 'md'} face="bold" color={fg}>
        {label}
      </T>
    </Pressable>
  )
}

/** Bouton rond à icône seule, toujours avec un libellé pour les lecteurs d'écran. */
export function IconBtn({ icon, label, onPress, color, bg }: { icon: IconName; label: string; onPress: () => void; color?: string; bg?: string }) {
  const u = useU()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap()
        onPress()
      }}
      hitSlop={8}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: bg ?? u.card, borderColor: u.cardLine }, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} color={color ?? u.fg} size={22} />
    </Pressable>
  )
}

/** Titre de section en Fraunces, comme les intertitres du site. */
export function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <T size="lg" face="display" color={color} style={{ marginTop: 26, marginBottom: 10 }} accessibilityRole="header">
      {children}
    </T>
  )
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  const u = useU()
  return <View style={[s.card, { backgroundColor: u.card, borderColor: u.cardLine }, tone ? { borderLeftColor: tone, borderLeftWidth: 5 } : null, style]}>{children}</View>
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
  const u = useU()
  return (
    <View style={{ marginBottom: 14 }}>
      <T size="sm" bold color={u.muted} style={{ marginBottom: 6 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={u.dark ? 'rgba(244,241,234,0.4)' : 'rgba(20,32,26,0.4)'}
        multiline={multiline}
        keyboardType={keyboard}
        autoCapitalize={autoCap}
        style={[s.input, { backgroundColor: u.field, color: u.fg, borderColor: u.cardLine }, multiline && { minHeight: 96, textAlignVertical: 'top' }]}
      />
    </View>
  )
}

export function Toggle({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) {
  const u = useU()
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
      style={[s.row, { borderBottomColor: u.line }]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <T size="md">{label}</T>
        {desc && (
          <T size="xs" color={u.muted}>
            {desc}
          </T>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#3fd09b', false: u.dark ? '#33403b' : '#cfc9bb' }} thumbColor="#ffffff" importantForAccessibility="no" />
    </Pressable>
  )
}

/** Choix parmi quelques valeurs, en pastilles arrondies (comme « Gros caractères / Voix d'abord / Standard » du site). */
export function Choice<V extends string | number>({ options, value, onChange, label }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  const u = useU()
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
            style={[s.choice, { borderColor: on ? u.accent : u.cardLine }, on && { backgroundColor: u.accent }]}
          >
            <T size="sm" bold color={on ? u.onAccent : u.fg}>
              {o.label}
            </T>
          </Pressable>
        )
      })}
    </View>
  )
}

/** « − 30 min + » pour les délais. */
export function Stepper({ label, value, onChange, step, min, max, unit }: { label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit: string }) {
  const u = useU()
  return (
    <View
      style={[s.row, { borderBottomColor: u.line }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(max, Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
    >
      <T size="md" style={{ flex: 1 }}>
        {label}
      </T>
      <IconBtn icon="minus" label={`Moins ${step}`} onPress={() => onChange(Math.max(min, value - step))} />
      <T size="md" bold style={{ minWidth: 80, textAlign: 'center' }}>
        {value} {unit}
      </T>
      <IconBtn icon="plus" label={`Plus ${step}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  )
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22, borderWidth: 2 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { borderRadius: 22, padding: 18, marginBottom: 12, borderWidth: 1 },
  input: { fontFamily: F.text, fontSize: 19, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, minHeight: TOUCH, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TOUCH, paddingVertical: 10, borderBottomWidth: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  choice: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, justifyContent: 'center' },
})
