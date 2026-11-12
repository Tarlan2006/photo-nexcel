export const HEAD_TOP_FACTOR = 1.25

/**
 * Rotates point (x, y) around pivot (cx, cy) by given radians
 */
function rotatePoint(x, y, cx, cy, rad) {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

/**
 * Checks if a point is within image bounds (with slight tolerance)
 */
function isInside(x, y, w, h) {
  const EPS = 0.5
  return x >= -EPS && x <= w + EPS && y >= -EPS && y <= h + EPS
}

/**
 * Crops and aligns face according to document preset directly onto a canvas
 *
 * @param {ImageBitmap|HTMLCanvasElement|HTMLImageElement} source
 * @param {Array} landmarks - 468/478 normalized landmarks from MediaPipe
 * @param {Object} preset - Document preset from presets.js
 * @param {Object} adjustments - { scaleOffset: number (-0.10 to 0.10), offsetY: number (-0.10 to 0.10) }
 * @returns {Object}
 */
export function cropFace(source, landmarks, preset, adjustments = {}) {
  const origW = source.width
  const origH = source.height
  const targetW = preset.width
  const targetH = preset.height

  // Safeguard: check landmarks
  if (!landmarks || landmarks.length < 264) {
    return {
      success: false,
      error: 'INVALID_LANDMARKS',
      headPct: 0,
      width: targetW,
      height: targetH,
    }
  }

  // 1. Landmark coordinates in source pixel space
  const p33 = { x: landmarks[33].x * origW, y: landmarks[33].y * origH }
  const p263 = { x: landmarks[263].x * origW, y: landmarks[263].y * origH }
  const p10 = { x: landmarks[10].x * origW, y: landmarks[10].y * origH }
  const p152 = { x: landmarks[152].x * origW, y: landmarks[152].y * origH }

  // 2. Eye alignment angle (p33 is right eye corner, p263 is left eye corner)
  const eyeDx = p263.x - p33.x
  const eyeDy = p263.y - p33.y
  const angle = Math.atan2(eyeDy, eyeDx)

  // Pivot point: midpoint of eyes
  const cx = (p33.x + p263.x) / 2
  const cy = (p33.y + p263.y) / 2

  // 3. Rotate forehead (10) and chin (152) into eye-leveled coordinate system
  const foreheadRot = rotatePoint(p10.x, p10.y, cx, cy, -angle)
  const chinRot = rotatePoint(p152.x, p152.y, cx, cy, -angle)

  const chinY = chinRot.y
  const foreheadY = foreheadRot.y
  const faceHeight = chinY - foreheadY

  // Safeguard: validate positive face height (prevent inverted faces / NaN)
  if (faceHeight < 10 || isNaN(faceHeight)) {
    return {
      success: false,
      error: 'INVALID_FACE_GEOMETRY',
      headPct: 0,
      width: targetW,
      height: targetH,
    }
  }

  // Head height estimation: chin - forehead * HEAD_TOP_FACTOR
  const headHeightInImage = faceHeight * HEAD_TOP_FACTOR
  const headTopY = chinY - headHeightInImage

  // Target head height: middle of preset range (kz: 75%, dv: 59.5%)
  const midHeadPct = (preset.headMinPct + preset.headMaxPct) / 2 / 100
  const scaleMultiplier = 1 + (adjustments.scaleOffset || 0)
  const targetHeadHeightCanvas = targetH * midHeadPct * scaleMultiplier
  const headPct = Math.round((targetHeadHeightCanvas / targetH) * 100)

  // Scale factor: image -> canvas
  const s = targetHeadHeightCanvas / headHeightInImage
  if (!isFinite(s) || s <= 0) {
    return {
      success: false,
      error: 'INVALID_SCALE',
      headPct: 0,
      width: targetW,
      height: targetH,
    }
  }

  // Vertical placement: 40% free space at top, 60% at bottom
  const freeSpace = targetH - targetHeadHeightCanvas
  const baseCanvasHeadTopY = 0.4 * freeSpace
  const shiftY = (adjustments.offsetY || 0) * targetH
  const canvasHeadTopY = baseCanvasHeadTopY + shiftY

  // Horizontal placement: face center
  const canvasFaceCenterX = targetW / 2

  // Eye midpoint location on canvas
  const dHeadTop = headTopY - cy
  const canvasEyeMidY = canvasHeadTopY - dHeadTop * s
  const canvasEyeMidX = canvasFaceCenterX

  // 5. Check if canvas corners lie inside original image
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)

  function canvasToImage(xc, yc) {
    const dx = (xc - canvasEyeMidX) / s
    const dy = (yc - canvasEyeMidY) / s
    return {
      x: cx + dx * cosA - dy * sinA,
      y: cy + dx * sinA + dy * cosA,
    }
  }

  const corners = [
    canvasToImage(0, 0),
    canvasToImage(targetW, 0),
    canvasToImage(targetW, targetH),
    canvasToImage(0, targetH),
  ]

  const outOfBounds = corners.some((pt) => !isInside(pt.x, pt.y, origW, origH))

  // Real position of point 152 (chin) in final canvas coordinates
  const chinCanvasY = canvasEyeMidY + (chinRot.y - cy) * s
  const chinPct = Math.round(((chinCanvasY / targetH) * 100) * 10) / 10

  if (outOfBounds) {
    return {
      success: false,
      error: 'OUT_OF_BOUNDS',
      headPct,
      chinY: chinCanvasY,
      chinPct,
      width: targetW,
      height: targetH,
    }
  }

  // 6. Draw on canvas
  const canvas = document.createElement('canvas')
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }
  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.clearRect(0, 0, targetW, targetH)

  ctx.save()
  ctx.translate(canvasEyeMidX, canvasEyeMidY)
  ctx.scale(s, s)
  ctx.rotate(-angle)
  ctx.translate(-cx, -cy)

  ctx.drawImage(source, 0, 0)
  ctx.restore()

  return {
    success: true,
    canvas,
    width: targetW,
    height: targetH,
    headPct,
    chinY: chinCanvasY,
    chinPct,
  }
}
