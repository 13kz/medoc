import Svg, { Path } from 'react-native-svg'
import { ICON_PATHS, type IconName } from '../core'

/** Les mêmes icônes au trait que l'appli web. */
export function Icon({ name, size = 24, color = '#fff', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={ICON_PATHS[name]} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
