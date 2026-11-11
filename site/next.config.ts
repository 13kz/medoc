import path from 'node:path'
import type { NextConfig } from 'next'

// Le site réutilise la logique métier de l'appli (src/lib) : la racine de Turbopack est donc celle du dépôt.
const root = path.join(__dirname, '..')

const config: NextConfig = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
}

export default config
