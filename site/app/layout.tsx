import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import '@fontsource/atkinson-hyperlegible-next/800.css'
import './globals.css'

const title = 'Medoc · Le pilulier qui parle à toute la famille'
const description =
  'Medoc rappelle ses médicaments à la personne qui les prend, rassure ses proches et donne au médecin ce qui compte. Un pilulier, trois regards. Prototype interactif.'

// Adresse publique du site, pour que les liens de l'image de partage soient absolus.
// Sur Vercel, l'adresse de production est fournie d'office ; NEXT_PUBLIC_SITE_URL permet de la forcer.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

// Les images de partage sont app/opengraph-image.png et app/twitter-image.png (convention Next.js).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: { icon: '/icon.svg' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: 'Medoc',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
}

export const viewport: Viewport = { themeColor: '#0b100e', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
