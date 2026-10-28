/** Côté le plus long d'une photo de boîte, en pixels : assez pour la reconnaître, assez petit pour le stockage local. */
export const PHOTO_MAX = 360
export const PHOTO_QUALITY = 0.72

/** Dimensions réduites pour tenir dans un carré de `max`, sans agrandir. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

/** Taille approximative en octets d'une image encodée en data URL (base64). */
export const dataUrlBytes = (url: string) => Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4)

export const isPhoto = (v: unknown): v is string => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v)

/** Lit une photo choisie ou prise avec l'appareil, la réduit et la compresse en JPEG. */
export async function compressPhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
}
