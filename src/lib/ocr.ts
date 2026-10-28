/**
 * Reconnaissance du texte d'une photo, dans le navigateur (Tesseract, modèle français) : la photo
 * ne quitte pas le téléphone. Le lecteur n'est chargé qu'au premier scan.
 */
export async function recognizeText(image: Blob, onProgress: (ratio: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  // La page autonome (un seul fichier) ne peut pas embarquer 4 Mo de lecteur : elle passe par le CDN de Tesseract.
  const paths = import.meta.env.MODE === 'single' ? {} : (await import('./ocrAssets')).ocrPaths()
  const worker = await createWorker('fra', 1, {
    ...paths,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}
