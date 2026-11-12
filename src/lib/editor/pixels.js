export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
export const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b

export function scaledSize(width, height, limit) {
  const ratio = Math.min(1, limit / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

export function estimateExposure(data) {
  const histogram = new Uint32Array(256)
  let count = 0
  let total = 0
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 128) continue
    const value = Math.round(luminance(data[i], data[i + 1], data[i + 2]))
    histogram[value]++
    total += value
    count++
  }

  const mean = count ? total / count : 120
  if (mean >= 90 && mean <= 175) return { low: 0, high: 255, lift: 0, strength: 0 }

  function percentile(fraction) {
    const threshold = count * fraction
    let sum = 0
    for (let i = 0; i < histogram.length; i++) {
      sum += histogram[i]
      if (sum >= threshold) return i
    }
    return 255
  }

  const low = percentile(0.01)
  const high = Math.max(low + 32, percentile(0.99))
  return { low, high, lift: clamp(116 - mean, -65, 96), strength: 0.35 }
}

export function toneRows(data, width, start, end, edit) {
  const { brightness, contrast, temperature, saturation, filter, exposure } = edit
  if (!brightness && !contrast && !temperature && !saturation && !exposure?.strength &&
      filter !== 'soft' && filter !== 'mono') return

  const contrastFactor = 1 + contrast / 100
  const saturationFactor = filter === 'mono' ? 0 : 1 + saturation / 100
  const warmth = temperature * 0.55
  const lut = new Float32Array(256)
  for (let value = 0; value < lut.length; value++) {
    let corrected = value
    if (exposure?.strength) {
      const stretched = clamp((value - exposure.low) * 255 / (exposure.high - exposure.low), 0, 255)
      corrected += clamp(stretched - value, -36, 36) * exposure.strength + exposure.lift
    }
    lut[value] = (corrected - 128) * contrastFactor + 128 + brightness * 1.7
  }

  for (let i = start * width * 4; i < end * width * 4; i += 4) {
    const r = lut[data[i]] + warmth
    const g = lut[data[i + 1]]
    const b = lut[data[i + 2]] - warmth
    const y = luminance(r, g, b)
    const lift = filter === 'soft' ? 18 * (1 - clamp(y / 160, 0, 1)) ** 2 : 0
    data[i] = y + (r - y) * saturationFactor + lift
    data[i + 1] = y + (g - y) * saturationFactor + lift
    data[i + 2] = y + (b - y) * saturationFactor + lift
  }
}

export function sharpenRows(output, source, width, height, start, end) {
  const stride = width * 4
  for (let y = Math.max(start, 1); y < Math.min(end, height - 1); y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const i = index + c
        const mean = (source[i - 4] + source[i + 4] + source[i - stride] + source[i + stride]) / 4
        output[i] = source[i] + clamp((source[i] - mean) * 0.28, -16, 16)
      }
    }
  }
}
