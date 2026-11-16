import { clamp, luminance } from './editor/pixels.js'

export const signatureDefaults = Object.freeze({
  sensitivity: 50, cleanup: 50, thickness: 0, smoothing: 0, color: 'original', lines: false,
})

export const fullPaper = Object.freeze({ left: 0, top: 0, right: 1, bottom: 1 })

function extrema(input, width, height, radius, horizontal, maximum) {
  const output = new Float32Array(input.length)
  const length = horizontal ? width : height
  const lines = horizontal ? height : width
  const stride = horizontal ? 1 : width
  const queue = new Int32Array(length)
  for (let line = 0; line < lines; line++) {
    const offset = horizontal ? line * width : line
    let start = 0
    let end = 0
    let added = 0
    for (let position = 0; position < length; position++) {
      const right = Math.min(length - 1, position + radius)
      while (added <= right) {
        const value = input[offset + added * stride]
        while (end > start) {
          const previous = input[offset + queue[end - 1] * stride]
          if (maximum ? previous > value : previous < value) break
          end--
        }
        queue[end++] = added++
      }
      while (queue[start] < position - radius) start++
      output[offset + position * stride] = input[offset + queue[start] * stride]
    }
  }
  return output
}

function morphology(input, width, height, radius, maximum) {
  return extrema(extrema(input, width, height, radius, true, maximum), width, height, radius, false, maximum)
}

function box(input, width, height, radius, horizontal) {
  const output = new Float32Array(input.length)
  const length = horizontal ? width : height
  const lines = horizontal ? height : width
  const stride = horizontal ? 1 : width
  for (let line = 0; line < lines; line++) {
    const offset = horizontal ? line * width : line
    let left = 0
    let right = 0
    let sum = 0
    for (let position = 0; position < length; position++) {
      while (right < length && right <= position + radius) sum += input[offset + right++ * stride]
      while (left < position - radius) sum -= input[offset + left++ * stride]
      output[offset + position * stride] = sum / (right - left)
    }
  }
  return output
}

function percentile(histogram, count, fraction) {
  let sum = 0
  for (let i = 0; i < histogram.length; i++) {
    sum += histogram[i]
    if (sum >= count * fraction) return i
  }
  return histogram.length - 1
}

function otsu(histogram, count) {
  const occupied = [...histogram.keys()].filter(i => histogram[i])
  const total = occupied.reduce((sum, i) => sum + i * histogram[i], 0)
  let leftCount = 0
  let leftSum = 0
  let best = -1
  let threshold = 0
  for (let j = 0; j + 1 < occupied.length; j++) {
    const i = occupied[j]
    leftCount += histogram[i]
    leftSum += i * histogram[i]
    const rightCount = count - leftCount
    const meanDifference = leftSum / leftCount - (total - leftSum) / rightCount
    const variance = leftCount * rightCount * meanDifference ** 2
    if (variance > best) {
      best = variance
      threshold = (i + occupied[j + 1]) / 2
    }
  }
  return threshold / 255
}

export function prepareSignature(data, width, height) {
  const size = width * height
  if (size < 4 || data.length !== size * 4) throw new Error('NO_INK')
  const light = new Float32Array(size)
  const brightness = new Uint32Array(256)
  for (let i = 0, p = 0; i < size; i++, p += 4) {
    const opacity = data[p + 3] / 255
    const level = 255 + (luminance(data[p], data[p + 1], data[p + 2]) - 255) * opacity
    light[i] = level
    brightness[Math.round(level)]++
  }
  if (percentile(brightness, size, 0.92) < 58) throw new Error('TOO_DARK')
  const side = Math.min(width, height)
  const radius = Math.max(1, Math.round(side * 0.02))
  const closed = morphology(morphology(light, width, height, radius, true), width, height, radius, false)
  const blurRadius = Math.max(1, Math.round(side / 8))
  const background = box(box(closed, width, height, blurRadius, true), width, height, blurRadius, false)
  const darkness = new Float32Array(size)
  const histogram = new Uint32Array(256)
  for (let i = 0; i < size; i++) {
    const value = 1 - clamp(light[i] / Math.max(1, background[i]), 0, 1.2)
    darkness[i] = value
    histogram[Math.max(0, Math.round(value * 255))]++
  }

  // Most of the frame is paper. Its typical residual contrast is a noise floor
  // for Otsu and its chroma lets us unmix colored paper from the original ink.
  const median = percentile(histogram, size, 0.5)
  const spread = (percentile(histogram, size, 0.75) - percentile(histogram, size, 0.25)) / 1.35
  const floor = Math.max(0.018, (median + 3.1 * spread) / 255)
  const paper = [0, 0, 0]
  let paperLight = 0
  for (let i = 0; i < size; i += 7) {
    if (darkness[i] > floor || data[i * 4 + 3] < 250) continue
    for (let channel = 0; channel < 3; channel++) paper[channel] += data[i * 4 + channel]
    paperLight += light[i]
  }
  return {
    data, width, height, darkness, background, floor, threshold: otsu(histogram, size),
    paper: paperLight ? paper.map(channel => channel / paperLight) : [1, 1, 1],
  }
}

function removePaperLines(alpha, width, height) {
  const horizontal = Math.ceil(width / 8)
  const vertical = Math.ceil(height / 8)
  const rows = extrema(extrema(alpha, width, height, horizontal, true, false), width, height, horizontal, true, true)
  const cols = extrema(extrema(alpha, width, height, vertical, false, false), width, height, vertical, false, true)
  const output = alpha.slice()
  const reach = Math.max(3, Math.round(Math.min(width, height) * 0.013))
  const stride = width + 1
  const support = new Uint32Array(stride * (height + 1))

  // Count nearby non-line ink with a summed-area table. Checking the
  // bounding rectangle first keeps long blank portions of lines cheap.
  for (let y = 0, i = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x < width; x++, i++) {
      if (alpha[i] > 0.55 && rows[i] < 0.08 && cols[i] < 0.08) sum++
      support[(y + 1) * stride + x + 1] = sum + support[y * stride + x + 1]
    }
  }

  function containsInk(left, top, right, bottom) {
    const a = Math.max(0, left)
    const b = Math.min(width, right)
    const c = Math.max(0, top) * stride
    const d = Math.min(height, bottom) * stride
    return a < b && c < d && support[d + b] - support[d + a] > support[c + b] - support[c + a]
  }

  function supportedSide(x, y, verticalWalk, direction) {
    const from = direction < 0 ? -reach : 1
    const to = direction < 0 ? 0 : reach + 1
    const nearby = verticalWalk
      ? containsInk(x - reach, y + from, x + reach + 1, y + to)
      : containsInk(x + from, y - reach, x + to, y + reach + 1)
    if (!nearby) return false
    for (let distance = 1; distance <= reach; distance++) {
      const offset = direction * distance
      const found = verticalWalk
        ? containsInk(x - distance, y + offset, x + distance + 1, y + offset + 1)
        : containsInk(x + offset, y - distance, x + offset + 1, y + distance + 1)
      if (found) return true
    }
    return false
  }

  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      const line = Math.max(rows[i], cols[i])
      if (line < 0.02) continue
      if ((rows[i] >= 0.02 && supportedSide(x, y, true, -1) && supportedSide(x, y, true, 1)) ||
          (cols[i] >= 0.02 && supportedSide(x, y, false, -1) && supportedSide(x, y, false, 1))) continue
      output[i] = Math.max(0, alpha[i] - line)
    }
  }
  return output
}

function cleanAlpha(alpha, width, height, cleanup) {
  const labels = new Int32Array(alpha.length)
  const queue = new Int32Array(alpha.length)
  const components = [null]
  let largest = 0
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] <= 0.5 || labels[i]) continue
    const label = components.length
    let count = 1
    queue[0] = i
    labels[i] = label
    let left = width
    let right = 0
    let top = height
    let bottom = 0
    for (let j = 0; j < count; j++) {
      const pixel = queue[j]
      const x = pixel % width
      const y = (pixel - x) / width
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
        for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
          const index = row * width + col
          if (alpha[index] <= 0.5 || labels[index]) continue
          labels[index] = label
          queue[count++] = index
        }
      }
    }
    largest = Math.max(largest, count)
    components.push({ count, left, right, top, bottom })
  }
  if (largest < Math.max(3, Math.round(alpha.length * 0.000015))) throw new Error('NO_INK')

  const threshold = cleanup ? Math.max(6, largest * 0.0015) * (cleanup / 50) ** 2 : 0
  const reach = Math.max(3, Math.round(Math.min(width, height) * 0.025))
  const keep = new Uint8Array(components.length)
  for (let label = 1; label < components.length; label++) {
    const { count, left, right, top, bottom } = components[label]
    keep[label] = Number(count >= threshold ||
      nearMainStroke(left, right, top, bottom, label))
  }

  function nearMainStroke(left, right, top, bottom, label) {
    for (let y = Math.max(0, top - reach); y <= Math.min(height - 1, bottom + reach); y++) {
      for (let x = Math.max(0, left - reach); x <= Math.min(width - 1, right + reach); x++) {
        const neighbor = labels[y * width + x]
        if (neighbor && neighbor !== label && components[neighbor].count >= threshold) return true
      }
    }
    return false
  }

  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      if (!alpha[i] || keep[labels[i]]) continue
      if (labels[i]) {
        alpha[i] = 0
        continue
      }
      // Keep the soft rim of a retained stroke, not the rim of distant noise.
      let edge = false
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1) && !edge; row++) {
        for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
          if (keep[labels[row * width + col]]) {
            edge = true
            break
          }
        }
      }
      if (!edge) alpha[i] = 0
    }
  }
  return alpha
}

function gaussian(alpha, width, height, smoothing) {
  const edge = Math.exp(-0.5 / (0.6 ** 2))
  const weight = edge / (1 + 2 * edge) * smoothing / 100
  const horizontal = new Float32Array(alpha.length)
  const output = new Float32Array(alpha.length)
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      horizontal[i] = alpha[i] * (1 - 2 * weight) +
        (alpha[x ? i - 1 : i] + alpha[x + 1 < width ? i + 1 : i]) * weight
    }
  }
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      output[i] = horizontal[i] * (1 - 2 * weight) +
        (horizontal[y ? i - width : i] + horizontal[y + 1 < height ? i + width : i]) * weight
    }
  }
  return output
}

export function signatureMask(source, options = signatureDefaults) {
  const { width, height, darkness, floor, threshold } = source
  const factor = 2 ** ((50 - options.sensitivity) / 40)
  const lower = Math.max(floor, 0.6 * threshold) * factor
  const upper = Math.max(lower + 0.013, 1.2 * threshold * factor)
  let original = new Float32Array(darkness.length)
  for (let i = 0; i < darkness.length; i++) {
    const t = clamp((darkness[i] - lower) / (upper - lower), 0, 1)
    original[i] = t * t * (3 - 2 * t)
  }
  if (options.lines) original = removePaperLines(original, width, height)
  cleanAlpha(original, width, height, options.cleanup)
  let alpha = original
  if (options.thickness) alpha = morphology(alpha, width, height, Math.abs(options.thickness), options.thickness > 0)
  if (options.smoothing) alpha = gaussian(alpha, width, height, options.smoothing)
  return { alpha, original }
}

export function signatureBounds(alpha, width, height, brush) {
  let left = width
  let right = -1
  let top = height
  let bottom = -1
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      if (alpha[i] * (brush ? brush[i] / 255 : 1) <= 0.05) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < 0) throw new Error('NO_INK')
  const pad = Math.max(2, Math.round(Math.max(right - left + 1, bottom - top + 1) * 0.04))
  return { x: left - pad, y: top - pad, width: right - left + 1 + pad * 2, height: bottom - top + 1 + pad * 2 }
}

const black = [0, 0, 0]
const blue = [31, 58, 147]

export function renderSignature(source, mask, bounds, color, brush) {
  const { width, height, data, background, paper } = source
  const ink = color === 'black' ? black : color === 'blue' ? blue : null
  const output = new Uint8ClampedArray(bounds.width * bounds.height * 4)
  const rgb = [0, 0, 0]
  for (let y = Math.max(0, -bounds.y); y < Math.min(bounds.height, height - bounds.y); y++) {
    for (let x = Math.max(0, -bounds.x); x < Math.min(bounds.width, width - bounds.x); x++) {
      const i = (y + bounds.y) * width + x + bounds.x
      const alpha = mask.alpha[i] * (brush ? brush[i] / 255 : 1)
      if (alpha <= 0.004) continue
      const p = (y * bounds.width + x) * 4
      if (ink) {
        output[p] = ink[0]
        output[p + 1] = ink[1]
        output[p + 2] = ink[2]
      } else {
        let sample = i
        if (mask.original[i] < 0.5) {
          for (let row = Math.max(0, y + bounds.y - 2); row <= Math.min(height - 1, y + bounds.y + 2); row++) {
            for (let col = Math.max(0, x + bounds.x - 2); col <= Math.min(width - 1, x + bounds.x + 2); col++) {
              const index = row * width + col
              if (mask.original[index] > mask.original[sample]) sample = index
            }
          }
        }
        const opacity = Math.max(0.02, mask.original[sample])
        for (let c = 0; c < 3; c++) {
          const bg = Math.min(255, background[sample] * paper[c])
          const pixel = bg + (data[sample * 4 + c] - bg) * data[sample * 4 + 3] / 255
          rgb[c] = clamp((pixel - (1 - opacity) * bg) / opacity, 0, 255)
        }
        const gray = luminance(...rgb)
        for (let c = 0; c < 3; c++) output[p + c] = gray + (rgb[c] - gray) * 1.08
      }
      output[p + 3] = alpha * 255
    }
  }
  return { data: output, width: bounds.width, height: bounds.height, bounds }
}

export function processSignature(data, width, height, options = signatureDefaults) {
  const source = prepareSignature(data, width, height)
  const mask = signatureMask(source, options)
  const bounds = signatureBounds(mask.alpha, width, height)
  return renderSignature(source, mask, bounds, options.color)
}
