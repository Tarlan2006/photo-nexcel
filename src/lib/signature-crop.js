import { clamp } from './editor/pixels.js'

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
