import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '../theme'
import { IconBtn, T } from './kit'

/** Feuille qui monte du bas de l'écran, pour un formulaire ou un détail. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.night }}>
        <View style={[s.head, { paddingTop: Platform.OS === 'android' ? insets.top + 12 : 18 }]}>
          <T size="lg" bold style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </T>
          <IconBtn icon="close" label="Fermer" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line } })
