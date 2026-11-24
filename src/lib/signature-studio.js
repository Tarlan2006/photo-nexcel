// Signature studio: local canvas pipeline for the eGov signature sample (550 x 124 px, black on white).
// Nothing here touches the network; every function works on pixels in the browser.

export const STUDIO_WIDTH = 550
export const STUDIO_HEIGHT = 124

export const studioDefaults = Object.freeze({
  mode: 'bw', thickness: 1, zoom: 1, angle: 0, offsetX: 0, offsetY: 0,
})

const MAX_WORK_SIDE = 1600

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

// Whitening threshold taken from the brightest common luminance (paper) of the photo.
export function detectThreshold(source) {
  try {
    const scale = Math.min(1, 320 / Math.max(source.width, source.height))
    const canvas = makeCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const histogram = new Uint32Array(256)
    for (let i = 0; i < data.length; i += 4) histogram[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++
    let peak = 210
    let most = 0
    for (let value = 110; value < 256; value++) if (histogram[value] > most) { most = histogram[value]; peak = value }
    return Math.max(95, Math.min(235, Math.round(peak * 0.78)))
  } catch {
    return 165
  }
}

// Paper to pure white, ink to black (or soft gray), optional thickening of the stroke.
export function buildProcessed(source, { threshold, mode, thickness }) {
  const ratio = Math.min(1, MAX_WORK_SIDE / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * ratio))
  const height = Math.max(1, Math.round(source.height * ratio))
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  const gray = new Uint8ClampedArray(width * height)
  const soft = mode === 'bw' ? 28 : 55
  const low = Math.max(0, threshold - soft)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luminance >= threshold) gray[p] = 255
    else if (luminance <= low) gray[p] = mode === 'bw' ? 0 : Math.max(0, Math.round(luminance * 0.65))
    else {
      const t = (luminance - low) / (threshold - low)
      gray[p] = mode === 'bw' ? Math.round(t * t * 255) : Math.round(luminance * (0.65 + 0.35 * t))
    }
  }
  let finished = gray
  for (let step = 0; step < thickness; step++) {
    const next = new Uint8ClampedArray(finished)
    for (let y = 1; y < height - 1; y++) {
      const row = y * width
      for (let x = 1; x < width - 1; x++) {
        const index = row + x
        let minimum = finished[index]
        if (finished[index - 1] < minimum) minimum = finished[index - 1]
        if (finished[index + 1] < minimum) minimum = finished[index + 1]
        if (finished[index - width] < minimum) minimum = finished[index - width]
        if (finished[index + width] < minimum) minimum = finished[index + width]
        next[index] = minimum
      }
    }
    finished = next
  }
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    data[i] = data[i + 1] = data[i + 2] = finished[p]
    data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

// Draws the 550:124 frame at any resolution. `view` is expressed in 550 x 124 space.
export function renderStudio(target, width, height, { source, processed, view, strokes = [], showOriginal = false }) {
  target.width = width
  target.height = height
  const ctx = target.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const image = showOriginal ? source : processed
  if (!image) return
  const scale = width / STUDIO_WIDTH
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(width / 2 + view.offsetX * scale, height / 2 + view.offsetY * scale)
  ctx.rotate((view.angle * Math.PI) / 180)
  const fit = (STUDIO_WIDTH / image.width) * view.zoom * scale
  ctx.drawImage(image, -(image.width * fit) / 2, -(image.height * fit) / 2, image.width * fit, image.height * fit)
  ctx.restore()
  if (showOriginal || !strokes.length) return
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 14 * scale
  for (const stroke of strokes) {
    if (!stroke.length) continue
    ctx.beginPath()
    ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale)
    if (stroke.length === 1) {
      ctx.arc(stroke[0].x * scale, stroke[0].y * scale, 7 * scale, 0, Math.PI * 2)
      ctx.fill()
    } else {
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x * scale, stroke[i].y * scale)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// Finds the ink and returns the zoom/offset that puts it in the middle with safe margins.
export function autoCenter(processed, angle = 0) {
  const { width, height } = processed
  const data = processed.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data
  const marginX = Math.floor(width * 0.03)
  const marginY = Math.floor(height * 0.03)
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false
  for (let y = marginY; y < height - marginY; y++) {
    for (let x = marginX; x < width - marginX; x++) {
      if (data[(y * width + x) * 4] < 200) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        found = true
      }
    }
  }
  if (!found) return { zoom: 1, offsetX: 0, offsetY: 0, found }
  const fit = STUDIO_WIDTH / width
  const inkWidth = Math.max(10, maxX - minX) * fit
  const inkHeight = Math.max(10, maxY - minY) * fit
  const zoom = Math.max(0.25, Math.min(2.8, Math.min((STUDIO_WIDTH * 0.86) / inkWidth, (STUDIO_HEIGHT * 0.58) / inkHeight)))
  const scale = fit * zoom
  const dx = (width / 2 - (minX + maxX) / 2) * scale
  const dy = (height / 2 - (minY + maxY) / 2) * scale
  const radians = (angle * Math.PI) / 180
  return {
    zoom, found,
    offsetX: dx * Math.cos(radians) - dy * Math.sin(radians),
    offsetY: dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

// Checks the final 550 x 124 RGBA buffer against the sample requirements.
export function evaluateCompliance(data, width = STUDIO_WIDTH, height = STUDIO_HEIGHT) {
  const safeLeft = Math.round(width * 0.042)
  const safeRight = width - safeLeft
  const safeTop = Math.round(height * 0.175)
  const safeBottom = height - safeTop
  const rim = 3
  let dark = 0, white = 0, onBorder = 0, outside = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = data[(y * width + x) * 4]
      if (value >= 250) white++
      if (value < 190) {
        dark++
        if (x < rim || x >= width - rim || y < rim || y >= height - rim) onBorder++
        else if (x < safeLeft || x > safeRight || y < safeTop || y > safeBottom) outside++
      }
    }
  }
  const hasSignature = dark > 45
  return {
    hasSignature,
    cleanBackground: (white + dark) / (width * height) > 0.96,
    noBorder: onBorder === 0,
    margins: hasSignature && outside < 18,
  }
}

export const quarterTurn = angle => ((angle + 90 + 180) % 360) - 180
