// Le lecteur et le modèle français sont servis par l'appli elle-même : pas d'appel à un CDN,
// et le service worker les garde pour lire une ordonnance hors ligne.
import corePath from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import fraPath from '@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz?url'

const abs = (u: string) => new URL(u, location.href).href

export const ocrPaths = () => ({
  corePath: abs(corePath),
  workerPath: abs(workerPath),
  langPath: abs(fraPath).replace(/\/[^/]+$/, ''),
})
