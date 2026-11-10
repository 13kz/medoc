import { Image, View } from 'react-native'
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg'
import type { Medication } from '../core'

const INK = '#1b2420'

/** Le médicament dessiné dans sa forme et sa couleur réelles (ou la photo de sa boîte). */
export function Pill({ med, size = 48, photo = false, bg = '#ffffff' }: { med: Medication; size?: number; photo?: boolean; bg?: string }) {
  const box = { width: size, height: size, borderRadius: size / 3, backgroundColor: bg, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const }
  if (photo && med.photo) {
    return (
      <View style={box} accessible={false}>
        <Image source={{ uri: med.photo }} style={{ width: size, height: size }} />
      </View>
    )
  }
  const c = med.color
  let shape
  switch (med.form) {
    case 'comprime':
      shape = (
        <>
          <Path d="M9 22v5c0 4.4 6.7 8 15 8s15-3.6 15-8v-5" fill={c} stroke={INK} strokeWidth={2.5} />
          <Ellipse cx={24} cy={22} rx={15} ry={8} fill={c} stroke={INK} strokeWidth={2.5} />
          <Path d="M18 22h12" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
        </>
      )
      break
    case 'gelule':
      shape = (
        <G rotation={-35} origin="24, 24">
          <Path d="M24 15h-6a9 9 0 000 18h6z" fill={c} stroke={INK} strokeWidth={2.5} />
          <Path d="M24 15h6a9 9 0 010 18h-6z" fill="#fbfbf7" stroke={INK} strokeWidth={2.5} />
        </G>
      )
      break
    case 'sachet':
      shape = (
        <>
          <Path d="M13 14l2.75-2 2.75 2 2.75-2 2.75 2 2.75-2 2.75 2 2.75-2 2.75 2V36H13z" fill={c} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <Path d="M18 24h12 M18 29h8" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
        </>
      )
      break
    case 'injection':
      shape = (
        <G rotation={-40} origin="24, 24">
          <Rect x={11} y={19} width={20} height={10} rx={3} fill={c} stroke={INK} strokeWidth={2.5} />
          <Rect x={31} y={21} width={5} height={6} rx={1} fill="#fbfbf7" stroke={INK} strokeWidth={2.5} />
          <Path d="M36 24h5 M6 24h5" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M17 22v4 M21 22v4" stroke={INK} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        </G>
      )
      break
    case 'gouttes':
      shape = <Path d="M24 9s-11 12-11 19.5a11 11 0 0022 0C35 21 24 9 24 9z" fill={c} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      break
    default:
      shape = (
        <>
          <Rect x={12} y={12} width={24} height={24} rx={6} fill={c} stroke={INK} strokeWidth={2.5} />
          <Path d="M24 18v12 M18 24h12" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        </>
      )
  }
  return (
    <View style={box} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg viewBox="0 0 48 48" width={size * 0.92} height={size * 0.92}>
        {shape}
      </Svg>
    </View>
  )
}
