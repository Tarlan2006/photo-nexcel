import { egovSignature } from '../presets.js'

export function prepareEgovSignature(image) {
  const width = Math.max(egovSignature.width, image.width)
  const height = Math.max(egovSignature.height, image.height)
  const left = Math.floor((width - image.width) / 2)
  const top = Math.floor((height - image.height) / 2)
  const data = new Uint8ClampedArray(width * height * 4).fill(255)

  for (let y = 0; y < image.height; y++) {
    let pixel = (y * image.width) * 4
    let output = ((y + top) * width + left) * 4
    for (let x = 0; x < image.width; x++, pixel += 4, output += 4) {
      const alpha = image.data[pixel + 3] / 255
      for (let channel = 0; channel < 3; channel++) {
        data[output + channel] = 255 + alpha * (image.data[pixel + channel] - 255)
      }
    }
  }

  return { data, width, height, tooSmall: width !== image.width || height !== image.height }
}

export async function exportEgovSignature(image) {
  const { data, width, height, tooSmall } = prepareEgovSignature(image)
  const canvas = new OffscreenCanvas(width, height)
  try {
    canvas.getContext('2d', { alpha: false }).putImageData(new ImageData(data, width, height), 0, 0)
    const jpeg = await canvas.convertToBlob({ type: egovSignature.mimeType, quality: 0.94 })
    if (jpeg.type !== egovSignature.mimeType) throw new Error('PROCESSING_FAILED')
    return { jpeg, width, height, tooSmall }
  } finally {
    canvas.width = canvas.height = 1
  }
}
