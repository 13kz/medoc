import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useU, type Universe } from '../theme'
import { Backdrop } from './Backdrop'
import { IconBtn, T } from './kit'

/** Feuille qui monte du bas de l'écran, dans l'univers du rôle (ou un autre, `u`). */
export function Sheet({ visible, title, onClose, children, u }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; u?: Universe['name'] }) {
  const current = useU()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Backdrop u={u ?? current.name}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SheetHead title={title} onClose={onClose} top={Platform.OS === 'android' ? insets.top + 12 : 18} />
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </Backdrop>
    </Modal>
  )
}

function SheetHead({ title, onClose, top }: { title: string; onClose: () => void; top: number }) {
  const u = useU()
  return (
    <View style={[s.head, { paddingTop: top, borderBottomColor: u.line }]}>
      <T size="xl" face="display" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={2}>
        {title}
      </T>
      <IconBtn icon="close" label="Fermer" onPress={onClose} />
    </View>
  )
}

const s = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1 } })
