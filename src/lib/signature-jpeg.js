import { egovSignature } from '../presets.js'
import { signatureFrameRect, signatureFrameSize } from './signature-frame.js'
import { checkSignature, detectSignatureFrame, signatureInk, signatureSharpness } from './signature-checks.js'

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
    const black = image.data.slice()
    for (let p = 0; p < black.length; p += 4) black[p] = black[p + 1] = black[p + 2] = 0
    ink.getContext('2d').putImageData(new ImageData(black, image.width, image.height), 0, 0)
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

export function cropSignatureFrame(image, crop) {
  const data = new Uint8ClampedArray(crop.width * crop.height * 4)
  for (let y = 0; y < crop.height; y++) {
    const start = ((y + crop.y) * image.width + crop.x) * 4
    data.set(image.data.subarray(start, start + crop.width * 4), y * crop.width * 4)
  }
  return { data, width: crop.width, height: crop.height }
}

export async function exportFramedEgovSignature(image, raw, frame, removeFrame = false) {
  const { width, height, tooSmall } = signatureFrameSize(image, frame)
  const ink = new OffscreenCanvas(image.width, image.height)
  const canvas = new OffscreenCanvas(width, height)
  const rawCanvas = new OffscreenCanvas(raw.width, raw.height)
  const sharpCanvas = new OffscreenCanvas(550, 124)
  try {
    // Only opacity carries extracted ink into eGov: selected blue/original ink
    // never reaches this output. Antialiased rims remain neutral grey on white.
    const black = image.data.slice()
    for (let p = 0; p < black.length; p += 4) black[p] = black[p + 1] = black[p + 2] = 0
    ink.getContext('2d').putImageData(new ImageData(black, image.width, image.height), 0, 0)
    rawCanvas.getContext('2d').putImageData(new ImageData(raw.data, raw.width, raw.height), 0, 0)
    const rect = signatureFrameRect(image, frame)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(ink, rect.left * width, rect.top * height, rect.width * width, rect.height * height)
    const rawContext = sharpCanvas.getContext('2d', { alpha: false, willReadFrequently: true })
    rawContext.fillStyle = '#fff'; rawContext.fillRect(0, 0, 550, 124)
    rawContext.imageSmoothingQuality = 'high'
    rawContext.drawImage(rawCanvas, rect.left * 550, rect.top * 124, rect.width * 550, rect.height * 124)
    const sharpness = signatureSharpness(rawContext.getImageData(0, 0, 550, 124))
    let pixels = context.getImageData(0, 0, width, height)
    const detected = detectSignatureFrame(signatureInk(pixels), width, height)
    const frameRemoved = detected.edges >= 3 || (removeFrame && detected.edges > 0)
    if (frameRemoved) {
      const cropped = cropSignatureFrame(pixels, detected.crop)
      ink.width = cropped.width; ink.height = cropped.height
      ink.getContext('2d').putImageData(new ImageData(cropped.data, cropped.width, cropped.height), 0, 0)
      context.clearRect(0, 0, width, height)
      const scale = Math.min(width / cropped.width, height / cropped.height)
      context.drawImage(ink, (width - cropped.width * scale) / 2, (height - cropped.height * scale) / 2,
        cropped.width * scale, cropped.height * scale)
      pixels = context.getImageData(0, 0, width, height)
    }
    const checks = checkSignature(pixels, { sharpness, frameRemoved })
    // Composite explicitly, never allow transparency in a JPEG export.
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#fff'; context.fillRect(0, 0, width, height)
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: .96 })
    if (jpeg.type !== 'image/jpeg') throw new Error('PROCESSING_FAILED')
    return { jpeg, width, height, tooSmall, checks }
  } finally {
    ink.width = ink.height = canvas.width = canvas.height = rawCanvas.width = rawCanvas.height = sharpCanvas.width = sharpCanvas.height = 1
  }
}
