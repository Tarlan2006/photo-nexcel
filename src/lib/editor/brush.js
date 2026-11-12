import { clamp } from './pixels.js'

export function brushRadius(width, height, size) {
  return Math.max(width, height) * size / 200
}

// Calculate the maximum coverage of each stroke before applying it. Segments
// from the same stroke can overlap without building up opacity at the joins.
export async function applyBrushStrokes(mask, width, height, strokes, rows) {
  const bandHeight = 16
  const coverage = new Uint8Array(width)

  for (const stroke of strokes) {
    if (!stroke.points.length) continue
    const radius = brushRadius(width, height, stroke.size)
    const outerSquared = radius ** 2
    const inner = radius * 0.62
    const innerSquared = inner ** 2
    const bands = Array.from({ length: Math.ceil(height / bandHeight) }, () => [])
    let firstRow = height
    let lastRow = 0
    let left = width
    let right = 0

    for (let i = 0; i < Math.max(1, stroke.points.length - 1); i++) {
      const [x0, y0] = stroke.points[i]
      const [x1, y1] = stroke.points[i + 1] ?? stroke.points[i]
      const x = x0 * width
      const y = y0 * height
      const dx = (x1 - x0) * width
      const dy = (y1 - y0) * height
      const segment = {
        x, y, dx, dy,
        lengthSquared: dx * dx + dy * dy,
        left: Math.max(0, Math.floor(Math.min(x, x + dx) - radius)),
        right: Math.min(width, Math.ceil(Math.max(x, x + dx) + radius)),
        top: Math.max(0, Math.floor(Math.min(y, y + dy) - radius)),
        bottom: Math.min(height, Math.ceil(Math.max(y, y + dy) + radius)),
      }
      firstRow = Math.min(firstRow, segment.top)
      lastRow = Math.max(lastRow, segment.bottom)
      left = Math.min(left, segment.left)
      right = Math.max(right, segment.right)
      for (let band = Math.floor(segment.top / bandHeight); band * bandHeight < segment.bottom; band++) {
        bands[band].push(segment)
      }
    }

    const target = stroke.mode === 'restore' ? 255 : 0
    await rows(lastRow - firstRow, (start, end) => {
      for (let row = firstRow + start; row < firstRow + end; row++) {
        coverage.fill(0, left, right)
        for (const segment of bands[Math.floor(row / bandHeight)]) {
          if (row < segment.top || row >= segment.bottom) continue
          const vy = row + 0.5 - segment.y
          for (let col = segment.left; col < segment.right; col++) {
            if (coverage[col] === 255) continue
            const vx = col + 0.5 - segment.x
            const along = segment.lengthSquared
              ? clamp((vx * segment.dx + vy * segment.dy) / segment.lengthSquared, 0, 1)
              : 0
            const distanceSquared = (vx - along * segment.dx) ** 2 + (vy - along * segment.dy) ** 2
            if (distanceSquared >= outerSquared) continue
            const t = distanceSquared <= innerSquared ? 1 : (radius - Math.sqrt(distanceSquared)) / (radius - inner)
            const alpha = Math.round(t * t * (3 - 2 * t) * 255)
            if (alpha > coverage[col]) coverage[col] = alpha
          }
        }
        for (let col = left; col < right; col++) {
          const index = row * width + col
          if (coverage[col]) mask[index] = Math.round(mask[index] + (target - mask[index]) * coverage[col] / 255)
        }
      }
    })
  }
  return mask
}
