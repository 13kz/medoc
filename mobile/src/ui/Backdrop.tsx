import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { C, U, UniverseContext, type Universe } from '../theme'

/**
 * Le fond d'un univers, repris du site : le crépuscule violet et pêche du proche,
 * le bureau beige du médecin, la nuit (avec un halo de porcelaine) partout ailleurs.
 */
export function Backdrop({ u, children }: { u: Universe['name']; children: ReactNode }) {
  const universe = U[u]
  return (
    <UniverseContext.Provider value={universe}>
      <View style={{ flex: 1, backgroundColor: universe.bg }}>
        {u === 'crepuscule' && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="p" cx="15%" cy="12%" rx="85%" ry="60%">
                <Stop offset="0" stopColor={C.plum} />
                <Stop offset="1" stopColor={C.plum} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="o" cx="95%" cy="22%" rx="70%" ry="40%">
                <Stop offset="0" stopColor={C.peach} stopOpacity="0.55" />
                <Stop offset="1" stopColor={C.peach} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="r" cx="70%" cy="100%" rx="80%" ry="45%">
                <Stop offset="0" stopColor={C.rose} stopOpacity="0.6" />
                <Stop offset="1" stopColor={C.rose} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="#140f26" />
            <Rect width="100%" height="100%" fill="url(#p)" />
            <Rect width="100%" height="100%" fill="url(#o)" />
            <Rect width="100%" height="100%" fill="url(#r)" />
          </Svg>
        )}
        {u === 'bureau' && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="d" x1="0" y1="0" x2="0.4" y2="1">
                <Stop offset="0" stopColor={C.desk} />
                <Stop offset="1" stopColor={C.desk2} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#d)" />
          </Svg>
        )}
        {u === 'nuit' && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="h" cx="50%" cy="30%" rx="70%" ry="50%">
                <Stop offset="0" stopColor={C.porcelain} stopOpacity="0.07" />
                <Stop offset="1" stopColor={C.porcelain} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#h)" />
          </Svg>
        )}
        {children}
      </View>
    </UniverseContext.Provider>
  )
}
