import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular'
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold'
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
  const [fonts] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold })
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
