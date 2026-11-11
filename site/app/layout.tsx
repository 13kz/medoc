import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import '@fontsource/atkinson-hyperlegible-next/800.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Medoc · Le pilulier qui parle à toute la famille',
  description:
    'Medoc rappelle ses médicaments à la personne qui les prend, rassure ses proches et donne au médecin ce qui compte. Un pilulier, trois regards. Prototype interactif.',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = { themeColor: '#0b100e', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
