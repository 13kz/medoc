import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular'
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold'
import { AtkinsonHyperlegibleNext_800ExtraBold } from '@expo-google-fonts/atkinson-hyperlegible-next/800ExtraBold'
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium'
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold'
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic'
import { Engine } from './src/engine'
import { Onboarding } from './src/Onboarding'
import { SessionProvider, useSession } from './src/session'
import { DossierProvider } from './src/store'
import { C } from './src/theme'
import { PatientApp } from './src/patient/PatientApp'
import { CaregiverApp } from './src/aidant/CaregiverApp'
import { DoctorApp } from './src/medecin/DoctorApp'

void SplashScreen.preventAutoHideAsync().catch(() => {})

/**
 * Medoc natif : trois applis dans une, selon qui utilise le téléphone.
 * La logique (prises, alertes, rappels, synchronisation) est celle de `src/lib`, partagée avec le web.
 */
export default function App() {
  const [fonts] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleNext_800ExtraBold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
  })
  useEffect(() => {
    if (fonts) void SplashScreen.hideAsync().catch(() => {})
  }, [fonts])
  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.night }} />
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  )
}

function Root() {
  const { session, link, detach } = useSession()
  if (!session) return <Onboarding />
  if (session.role === 'medecin') return <DoctorApp />
  return (
    <DossierProvider key={`${session.role}:${link?.dossier ?? 'local'}`} link={link} onRefused={detach}>
      <Engine role={session.role} />
      {session.role === 'patient' ? <PatientApp /> : <CaregiverApp />}
    </DossierProvider>
  )
}
