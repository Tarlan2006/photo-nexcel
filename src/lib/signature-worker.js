import { applyBrushStrokes } from './editor/brush.js'
import { scaledSize } from './editor/pixels.js'
import { prepareSignature, renderSignature, signatureBounds, signatureMask } from './signature.js'
import { exportSignature } from './signature-png.js'
import { exportEgovSignature } from './signature-jpeg.js'

let photo
let cache
let finalImage

function getPixels(bitmap, left, top, width, height, limit) {
  const size = scaledSize(width, height, limit)
  const canvas = new OffscreenCanvas(size.width, size.height)
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  try {
    context.fillStyle = 'white'
    context.fillRect(0, 0, size.width, size.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, left, top, width, height, 0, 0, size.width, size.height)
    return context.getImageData(0, 0, size.width, size.height)
  } finally {
    canvas.width = canvas.height = 1
  }
}

async function load(file, mimeType) {
  const bitmap = await createImageBitmap(file.slice(0, file.size, mimeType), { imageOrientation: 'from-image' })
  try {
    const full = getPixels(bitmap, 0, 0, bitmap.width, bitmap.height, 1600)
    photo?.close()
    photo = await createImageBitmap(full)
    cache = null
    finalImage = null
    return getPixels(photo, 0, 0, photo.width, photo.height, 800)
  } finally {
    bitmap.close()
  }
}

async function extract({ crop, options, strokes }, preview) {
  const key = JSON.stringify([crop, preview])
  const x = Math.floor(photo.width * crop.left)
  const y = Math.floor(photo.height * crop.top)
  const width = Math.max(1, Math.round(photo.width * crop.right) - x)
  const height = Math.max(1, Math.round(photo.height * crop.bottom) - y)
  if (cache?.key !== key) {
    const pixels = getPixels(photo, x, y, width, height, preview ? 800 : 1600)
    cache = { key, source: prepareSignature(pixels.data, pixels.width, pixels.height) }
  }
  const source = cache.source
  const mask = signatureMask(source, options)
  const widthInPaper = width / photo.width
  const heightInPaper = height / photo.height
  const left = x / photo.width
  const top = y / photo.height
  let brush
  if (strokes.length) {
    brush = new Uint8ClampedArray(source.width * source.height).fill(255)
    const brushScale = Math.max(photo.width, photo.height) / Math.max(width, height)
    const localStrokes = strokes.map(({ points, size, mode }) => ({
      size: size * brushScale, mode,
      points: points.map(([px, py]) => [(px - left) / widthInPaper, (py - top) / heightInPaper]),
    }))
    await applyBrushStrokes(brush, source.width, source.height, localStrokes, (rows, run) => run(0, rows))
  }
  const bounds = signatureBounds(mask.alpha, source.width, source.height, preview ? null : brush)
  const result = renderSignature(source, mask, bounds, options.color, brush)
  return {
    ...result,
    region: {
      left: left + bounds.x / source.width * widthInPaper,
      top: top + bounds.y / source.height * heightInPaper,
      width: bounds.width / source.width * widthInPaper,
      height: bounds.height / source.height * heightInPaper,
      relativeSize: Math.max(bounds.width * width / source.width, bounds.height * height / source.height) /
        Math.max(photo.width, photo.height),
    },
  }
}

self.onmessage = async ({ data: { id, action, ...payload } }) => {
  try {
    let result
    if (action === 'load') {
      const { data, width, height } = await load(payload.file, payload.mimeType)
      result = { data, width, height }
    } else if (action === 'preview') {
      result = await extract(payload, true)
    } else {
      const key = JSON.stringify([payload.crop, payload.options, payload.strokes])
      if (finalImage?.key !== key) finalImage = { key, image: await extract(payload, false) }
      result = payload.output.format === 'egov'
        ? await exportEgovSignature(finalImage.image)
        : await exportSignature(finalImage.image, payload.output)
    }
    self.postMessage({ id, result }, result.data ? [result.data.buffer] : [])
  } catch (error) {
    const code = ['NO_INK', 'TOO_DARK'].includes(error.message) ? error.message : 'PROCESSING_FAILED'
    self.postMessage({ id, error: code })
  }
}
