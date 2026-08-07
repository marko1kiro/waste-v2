export const MAX_PHOTO_BYTES = 500 * 1024

export interface CompressionStep { width: number; height: number; quality: number }

export function isWithinPhotoLimit(bytes: number) { return bytes <= MAX_PHOTO_BYTES }

export function compressionSteps(width: number, height: number): CompressionStep[] {
  const scale = Math.min(1, 1600 / Math.max(width, height))
  const initialWidth = Math.max(1, Math.round(width * scale))
  const initialHeight = Math.max(1, Math.round(height * scale))
  const steps: CompressionStep[] = []
  let currentWidth = initialWidth
  let currentHeight = initialHeight
  while (true) {
    for (let quality = 0.82; quality >= 0.4; quality = Math.round((quality - 0.07) * 100) / 100) steps.push({ width: currentWidth, height: currentHeight, quality })
    if (Math.max(currentWidth, currentHeight) <= 400) return steps
    const scale = Math.max(400, Math.round(Math.max(currentWidth, currentHeight) * 0.8)) / Math.max(currentWidth, currentHeight)
    currentWidth = Math.max(1, Math.round(currentWidth * scale))
    currentHeight = Math.max(1, Math.round(currentHeight * scale))
  }
}
