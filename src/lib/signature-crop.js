import { clamp } from './editor/pixels.js'

// Round once so the preview dimensions and exported pixels describe the same frame.
export function signatureOutputBounds({ width, height }, crop) {
  const left = clamp(Math.round(crop.left * width), 0, width - 1)
  const top = clamp(Math.round(crop.top * height), 0, height - 1)
  const right = clamp(Math.round(crop.right * width), left + 1, width)
  const bottom = clamp(Math.round(crop.bottom * height), top + 1, height)
  return { left, top, width: right - left, height: bottom - top }
}

export function cropSignatureImage(image, crop) {
  const { left, top, width, height } = signatureOutputBounds(image, crop)
  const data = new Uint8ClampedArray(width * height * 4)
  let hasInk = false
  for (let y = 0; y < height; y++) {
    const offset = ((top + y) * image.width + left) * 4
    data.set(image.data.subarray(offset, offset + width * 4), y * width * 4)
  }
  for (let p = 3; p < data.length; p += 4) {
    if (data[p]) { hasInk = true; break }
  }
  if (!hasInk) throw new Error('NO_INK')
  return { data, width, height }
}

export function moveSignatureCrop(crop, dx, dy) {
  const x = clamp(dx, -crop.left, 1 - crop.right)
  const y = clamp(dy, -crop.top, 1 - crop.bottom)
  return { left: crop.left + x, right: crop.right + x, top: crop.top + y, bottom: crop.bottom + y }
}

export function squareSignatureCrop(crop, { width, height }) {
  const side = Math.min(width, height, Math.max((crop.right - crop.left) * width, (crop.bottom - crop.top) * height))
  const left = clamp((crop.left + crop.right - side / width) / 2, 0, 1 - side / width)
  const top = clamp((crop.top + crop.bottom - side / height) / 2, 0, 1 - side / height)
  return { left, right: left + side / width, top, bottom: top + side / height }
}

export function resizeSignatureCrop(crop, { width, height }, [horizontal, vertical], x, y, square) {
  const fromLeft = horizontal === 'left'
  const fromTop = vertical === 'top'
  const anchorX = crop[fromLeft ? 'right' : 'left']
  const anchorY = crop[fromTop ? 'bottom' : 'top']
  const minSide = Math.min(width, height) * 0.06
  if (!square) {
    const minX = minSide / width
    const minY = minSide / height
    return {
      ...crop,
      [horizontal]: fromLeft ? clamp(x, 0, anchorX - minX) : clamp(x, anchorX + minX, 1),
      [vertical]: fromTop ? clamp(y, 0, anchorY - minY) : clamp(y, anchorY + minY, 1),
    }
  }
  const dx = (fromLeft ? anchorX - x : x - anchorX) * width
  const dy = (fromTop ? anchorY - y : y - anchorY) * height
  const maxSide = Math.min((fromLeft ? anchorX : 1 - anchorX) * width, (fromTop ? anchorY : 1 - anchorY) * height)
  const side = clamp((dx + dy) / 2, minSide, maxSide)
  return {
    ...crop,
    [horizontal]: anchorX + (fromLeft ? -side : side) / width,
    [vertical]: anchorY + (fromTop ? -side : side) / height,
  }
}
