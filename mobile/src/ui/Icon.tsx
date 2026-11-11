import Svg, { Path } from 'react-native-svg'
import { ICON_PATHS, type IconName } from '../core'
import { useU } from '../theme'

/** Les mêmes icônes au trait que l'appli web et le site. */
export function Icon({ name, size = 24, color, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const u = useU()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={ICON_PATHS[name]} stroke={color ?? u.fg} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
