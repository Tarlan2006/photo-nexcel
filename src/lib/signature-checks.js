import { signatureSafeY } from './signature-frame.js'

function median(values) {
  if (!values.length) return 0
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)]
}

export function signatureInk(image) {
  const mask = new Uint8Array(image.width * image.height)
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4
    mask[i] = Number(image.data[p + 3] >= 80 &&
      (image.data[p] + image.data[p + 1] + image.data[p + 2]) / 3 < 190)
  }
  return mask
}

export function signatureMargins(mask, width, height) {
  let left = width, right = -1, top = height, bottom = -1, count = 0
  for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i++) {
    if (!mask[i]) continue
    count++
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (!count) return { count: 0, left: 0, right: 0, top: 0, bottom: 0, adequate: false }
  const margins = { count, left, right: width - right - 1, top, bottom: height - bottom - 1 }
  return { ...margins, adequate: Math.min(margins.left, margins.right, margins.top, margins.bottom) / height >= signatureSafeY }
}

export function signatureStrokeWidth(mask, width, height) {
  // Chamfer distance to the background, sampled on local medial ridges. Border
  // padding is treated as background. This is an estimate, not a physical ruler.
  const distance = new Float32Array(mask.length)
  const diagonal = Math.SQRT2
  const at = (x, y) => x < 0 || y < 0 || x >= width || y >= height ? 0 : distance[y * width + x]
  for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i++) {
    if (mask[i]) distance[i] = 1 + Math.min(at(x - 1, y), at(x, y - 1),
      at(x - 1, y - 1) + diagonal - 1, at(x + 1, y - 1) + diagonal - 1)
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x
    if (mask[i]) distance[i] = Math.min(distance[i], 1 + at(x + 1, y), 1 + at(x, y + 1),
      diagonal + at(x + 1, y + 1), diagonal + at(x - 1, y + 1))
  }
  const ridges = []
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const value = distance[y * width + x]
    if (!value) continue
    let peak = true
    for (let dy = -1; dy <= 1 && peak; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (at(x + dx, y + dy) > value + .01) { peak = false; break }
    }
    if (peak) ridges.push(Math.max(1, 2 * value - 1))
  }
  const pixels = median(ridges)
  const mm = pixels / height * 27
  return { pixels, mm, status: mm < .6 ? 'thin' : mm > 1.5 ? 'thick' : 'pass' }
}

export function signatureSharpness(image) {
  const { data, width, height } = image
  const gray = (x, y) => {
    const p = (y * width + x) * 4
    return 255 + ((data[p] * .2126 + data[p + 1] * .7152 + data[p + 2] * .0722) - 255) * data[p + 3] / 255
  }
  let sum = 0, squared = 0, count = 0
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const center = gray(x, y)
    // Ignore blank paper so the score does not merely measure ink density.
    if (center > 250 && gray(x - 1, y) > 250 && gray(x + 1, y) > 250 && gray(x, y - 1) > 250 && gray(x, y + 1) > 250) continue
    const value = gray(x - 1, y) + gray(x + 1, y) + gray(x, y - 1) + gray(x, y + 1) - 4 * center
    sum += value; squared += value * value; count++
  }
  return count ? squared / count - (sum / count) ** 2 : 0
}

export function signatureComponents(mask, width, height) {
  const seen = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  let components = 0, outside = 0
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    let size = 1, sx = 0, sy = 0
    queue[0] = i; seen[i] = 1
    for (let j = 0; j < size; j++) {
      const p = queue[j], x = p % width, y = Math.floor(p / width)
      sx += x; sy += y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, n = ny * width + nx
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[n] || seen[n]) continue
        seen[n] = 1; queue[size++] = n
      }
    }
    if (size < 3) continue
    components++
    if (sx / size < width * .15 || sx / size > width * .85 || sy / size < height * .2 || sy / size > height * .8) outside++
  }
  return { components, outside, scattered: outside > 2 && outside / components > .4 }
}

export function detectSignatureFrame(mask, width, height) {
  const bandX = Math.max(2, Math.ceil(width * .06)), bandY = Math.max(2, Math.ceil(height * .12))
  function find(horizontal, start, end, reverse = false) {
    const length = horizontal ? width : height
    let best = null
    for (let n = start; n < end; n++) {
      const line = reverse ? end - 1 - n + start : n
      let run = 0, longest = 0
      for (let p = 0; p < length; p++) {
        const ink = mask[horizontal ? line * width + p : p * width + line]
        run = ink ? run + 1 : 0; longest = Math.max(longest, run)
      }
      if (longest >= length * .7) best = line
    }
    return best
  }
  const top = find(true, 0, bandY), bottom = find(true, height - bandY, height, true)
  const left = find(false, 0, bandX), right = find(false, width - bandX, width, true)
  const edges = [top, bottom, left, right].filter(value => value !== null).length
  // Keep a small inset beyond the whole detected line, including JPEG fringes.
  const inset = Math.max(2, Math.ceil(height * .025))
  const crop = { x: left === null ? 0 : left + inset, y: top === null ? 0 : top + inset,
    right: right === null ? width : right - inset, bottom: bottom === null ? height : bottom - inset }
  return { edges, crop: { x: crop.x, y: crop.y, width: Math.max(1, crop.right - crop.x), height: Math.max(1, crop.bottom - crop.y) } }
}

export function checkSignature(image, { sharpness = signatureSharpness(image), format = 'image/jpeg', frameRemoved = false } = {}) {
  const mask = signatureInk(image)
  const margins = signatureMargins(mask, image.width, image.height)
  const stroke = signatureStrokeWidth(mask, image.width, image.height)
  const components = signatureComponents(mask, image.width, image.height)
  const frame = detectSignatureFrame(mask, image.width, image.height)
  return {
    size: image.width >= 550 && image.height >= 124 ? 'pass' : 'fail',
    format: format === 'image/jpeg' ? 'pass' : 'warn',
    margins: !margins.count ? 'fail' : margins.adequate ? 'pass' : 'warn',
    stroke: !margins.count ? 'warn' : stroke.status === 'pass' ? 'pass' : 'warn',
    content: !margins.count ? 'fail' : margins.count < image.width * image.height * .001 || components.scattered ? 'warn' : 'pass',
    sharpness: sharpness < 100 ? 'warn' : 'pass',
    frame: frame.edges ? 'warn' : 'pass',
    measurements: { margins, stroke, sharpness, components }, frameDetected: frame.edges, frameRemoved,
  }
}
