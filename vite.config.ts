import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode single` produit un unique index.html autonome (démo partageable).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    rollupOptions: {
      // Tesseract cherche « fra.traineddata.gz » dans un dossier : ce fichier garde son nom.
      output: { assetFileNames: (info) => (info.names?.[0]?.endsWith('.traineddata.gz') ? 'tessdata/[name][extname]' : 'assets/[name]-[hash][extname]') },
    },
  },
  // En développement, le serveur de synchronisation (npm run server) répond derrière /api.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
}))
