import { clamp } from './pixels.js'

export async function resizeMask(source, sourceWidth, sourceHeight, width, height, rows) {
  const mask = new Uint8Array(width * height)
  const left = new Int32Array(width)
  const mixX = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const sx = clamp((x + 0.5) * sourceWidth / width - 0.5, 0, sourceWidth - 1)
    left[x] = Math.floor(sx)
    mixX[x] = sx - left[x]
  }

  await rows(height, (start, end) => {
    for (let y = start; y < end; y++) {
      const sy = clamp((y + 0.5) * sourceHeight / height - 0.5, 0, sourceHeight - 1)
      const top = Math.floor(sy) * sourceWidth
      const bottom = Math.min(sourceHeight - 1, Math.floor(sy) + 1) * sourceWidth
      const mixY = sy - Math.floor(sy)
      for (let x = 0; x < width; x++) {
        const a = left[x]
        const b = Math.min(a + 1, sourceWidth - 1)
        const t = source[top + a] + (source[top + b] - source[top + a]) * mixX[x]
        const u = source[bottom + a] + (source[bottom + b] - source[bottom + a]) * mixX[x]
        mask[y * width + x] = Math.round(t + (u - t) * mixY)
      }
    }
  })
  return mask
}

export async function refineMask(mask, width, height, shift, feather, rows) {
  if (!shift && !feather) return mask
  const buffer = new Uint8Array(mask.length)

  async function pass(radius, reducer, horizontal, source, target) {
    await rows(height, (start, end) => {
      for (let y = start; y < end; y++) {
        for (let x = 0; x < width; x++) {
          let value = source[y * width + x]
          let count = 1
          for (let d = 1; d <= radius; d++) {
            const a = horizontal ? y * width + Math.max(0, x - d) : Math.max(0, y - d) * width + x
            const b = horizontal ? y * width + Math.min(width - 1, x + d) : Math.min(height - 1, y + d) * width + x
            value = reducer ? reducer(value, source[a], source[b]) : value + source[a] + source[b]
            count += 2
          }
          target[y * width + x] = reducer ? value : Math.round(value / count)
        }
      }
    })
  }

  if (shift) {
    const reducer = shift < 0 ? Math.min : Math.max
    await pass(Math.abs(shift), reducer, true, mask, buffer)
    await pass(Math.abs(shift), reducer, false, buffer, mask)
  }
  if (feather) {
    await pass(feather, null, true, mask, buffer)
    await pass(feather, null, false, buffer, mask)
  }
  return mask
}

export function colorChannels(color) {
  const value = Number.parseInt(color.slice(1), 16)
  return [value >> 16 & 255, value >> 8 & 255, value & 255]
}

export function compositeRows(data, original, mask, width, height, start, end, color) {
  for (let y = start; y < end; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const index = p * 4
      const alpha = mask[p] / 255
      if (alpha === 1 && data[index + 3] === 255) continue

      let inner = p
      let cleanup = 0
      if (alpha > 0 && alpha < 1) {
        const dx = Math.sign(mask[y * width + Math.min(x + 1, width - 1)] - mask[y * width + Math.max(x - 1, 0)])
        const dy = Math.sign(mask[Math.min(y + 1, height - 1) * width + x] - mask[Math.max(y - 1, 0) * width + x])
        inner = clamp(y + 3 * dy, 0, height - 1) * width + clamp(x + 3 * dx, 0, width - 1)
        cleanup = Math.max(0, mask[inner] / 255 - alpha) * (1 - alpha) * 0.9
      }

      const opacity = alpha * data[index + 3] / 255
      for (let c = 0; c < 3; c++) {
        const edge = data[index + c] + (original[inner * 4 + c] - original[index + c]) * cleanup
        data[index + c] = edge * opacity + color[c] * (1 - opacity)
      }
      data[index + 3] = 255
    }
  }
}

export function maskMetrics(mask, rgba) {
  let count = 0
  let uncertain = 0
  let foreground = 0
  let background = 0
  const front = [0, 0, 0]
  const back = [0, 0, 0]
  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i]
    if (alpha >= 128) count++
    if (alpha > 80 && alpha < 175) uncertain++
    if (alpha >= 220) {
      foreground++
      for (let c = 0; c < 3; c++) front[c] += rgba[i * 4 + c]
    } else if (alpha <= 35) {
      background++
      for (let c = 0; c < 3; c++) back[c] += rgba[i * 4 + c]
    }
  }
  const coverage = count / mask.length
  const contrast = Math.hypot(...front.map((channel, index) => channel / Math.max(1, foreground) - back[index] / Math.max(1, background)))
  return {
    coverage,
    reliable: coverage >= 0.15 && coverage <= 0.98 && foreground > 0 && background > 0 &&
      contrast >= 12 && uncertain / mask.length <= 0.42,
  }
}
