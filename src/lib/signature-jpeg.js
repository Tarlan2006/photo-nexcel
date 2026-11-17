import { egovSignature } from '../presets.js'

export function egovSignatureSize(image) {
  const scale = Math.max(1, egovSignature.width / image.width, egovSignature.height / image.height)
  return {
    width: Math.max(egovSignature.width, Math.round(image.width * scale)),
    height: Math.max(egovSignature.height, Math.round(image.height * scale)),
    tooSmall: scale > 1,
  }
}

export async function exportEgovSignature(image) {
  const { width, height, tooSmall } = egovSignatureSize(image)
  const ink = new OffscreenCanvas(image.width, image.height)
  const canvas = new OffscreenCanvas(width, height)
  try {
    ink.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(ink, 0, 0, width, height)
    const jpeg = await canvas.convertToBlob({ type: egovSignature.mimeType, quality: 0.94 })
    if (jpeg.type !== egovSignature.mimeType) throw new Error('PROCESSING_FAILED')
    return { jpeg, width, height, tooSmall }
  } finally {
    ink.width = ink.height = canvas.width = canvas.height = 1
  }
}
