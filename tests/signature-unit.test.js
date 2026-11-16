import assert from 'node:assert/strict'
import { test } from 'node:test'
import { signatureCopy } from '../src/components/signature/copy.js'
import { photoFileError, identifyPhoto } from '../src/lib/photo.js'
import { scaledSize } from '../src/lib/editor/pixels.js'
import { prepareSignature, processSignature, signatureDefaults, signatureMask } from '../src/lib/signature.js'
import { fitSignaturePngs } from '../src/lib/signature-png.js'
import { fixturePng, synthSignature } from './helpers/synthSignature.js'

const testCases = new Map()
const fixture = variant => {
  if (!testCases.has(variant)) testCases.set(variant, synthSignature(variant))
  return testCases.get(variant)
}

function maskBounds(mask, width) {
  let left = width
  let top = mask.length / width
  let right = -1
  let bottom = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % width
    const y = Math.floor(i / width)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  return { left, top, right, bottom }
}

function inspect({ alpha, mask, width }) {
  const { left, top, right, bottom } = maskBounds(mask, width)
  let hit = 0
  let union = 0
  let pixels = 0
  let opaque = 0
  let background = 0
  let transparent = 0
  for (let i = 0; i < alpha.length; i++) {
    const found = alpha[i] > 0.5
    if (found && mask[i]) hit++
    if (found || mask[i]) union++
    if (mask[i]) {
      pixels++
      if (alpha[i] > 0.8) opaque++
    }
    const x = i % width
    const y = Math.floor(i / width)
    if (x < left - 5 || x > right + 5 || y < top - 5 || y > bottom + 5) {
      background++
      if (alpha[i] < 0.02) transparent++
    }
  }
  return { iou: hit / union, opaque: opaque / pixels, clear: transparent / background }
}

const compute = (variant, options = signatureDefaults) => {
  const image = fixture(variant)
  return { ...image, ...signatureMask(prepareSignature(image.data, image.width, image.height), options) }
}

test('white, shadow, noise with JPEG blocks, yellow paper, specks, blue, thin and faint ink', t => {
  const results = Object.fromEntries(['clean', 'shadow', 'noisy', 'yellow', 'dust', 'blue', 'thin', 'faint']
    .map(variant => [variant, inspect(compute(variant))]))
  for (const [variant, result] of Object.entries(results)) {
    t.diagnostic(variant + ': ' + JSON.stringify(result))
    if (!['thin', 'faint'].includes(variant)) assert.ok(result.clear >= 0.995, variant + ' background')
    if (['clean', 'shadow', 'noisy', 'blue'].includes(variant)) {
      assert.ok(result.iou >= 0.85, variant + ' intersection over union')
      assert.ok(result.opaque >= 0.95, variant + ' opaque ink')
    }
    if (['thin', 'faint'].includes(variant)) assert.ok(result.iou >= 0.70, variant + ' intersection over union')
  }
  assert.ok(Math.abs(results.shadow.iou - results.clean.iou) <= 0.05)
})

function components(mask, width, height) {
  const seen = new Uint8Array(mask.length)
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (seen[i] || !mask[i]) continue
    count++
    const pending = [i]
    seen[i] = 1
    for (let j = 0; j < pending.length; j++) {
      const x = pending[j] % width
      const y = Math.floor(pending[j] / width)
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
        for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
          const index = row * width + col
          if (!seen[index] && mask[index]) {
            seen[index] = 1
            pending.push(index)
          }
        }
      }
    }
  }
  return count
}

test('isolated dust disappears and the small dot above the stroke remains', () => {
  const { mask, alpha, width, height } = compute('dust')
  assert.equal(components(alpha.map(value => Number(value > 0.5)), width, height), components(mask, width, height))
  assert.ok(alpha[247 * width + 569] > 0.8)
  assert.ok(compute('dust', { ...signatureDefaults, cleanup: 0 }).alpha[99 * width + 44] > 0.5)
})

test('black, dark blue and original ink RGB, padded bounds and deterministic non-mutating processing', () => {
  const { data, mask, width, height } = fixture('blue')
  const before = data.slice()
  const normal = processSignature(data, width, height)
  assert.deepEqual(processSignature(data, width, height), normal)
  assert.deepEqual(data, before)
  const { left, right, top, bottom } = maskBounds(mask, width)
  const pad = Math.round(Math.max(right - left + 1, bottom - top + 1) * 0.04)
  const { bounds } = normal
  assert.ok(Math.abs(bounds.x - (left - pad)) <= 2)
  assert.ok(Math.abs(bounds.y - (top - pad)) <= 2)
  assert.ok(Math.abs(bounds.width - (right - left + 1 + pad * 2)) <= 4)
  assert.ok(Math.abs(bounds.height - (bottom - top + 1 + pad * 2)) <= 4)
  assert.equal(normal.data[3], 0)
  let red = 0
  let blue = 0
  let count = 0
  for (let p = 0; p < normal.data.length; p += 4) {
    if (normal.data[p + 3] <= 128) continue
    red += normal.data[p]
    blue += normal.data[p + 2]
    count++
  }
  assert.ok((blue - red) / count > 30)
  for (const [color, rgb] of [['black', [0, 0, 0]], ['blue', [31, 58, 147]]]) {
    const result = processSignature(data, width, height, { ...signatureDefaults, color })
    for (let p = 0; p < result.data.length; p += 4) {
      if (result.data[p + 3] <= 128) continue
      assert.deepEqual([...result.data.slice(p, p + 3)], rgb)
    }
  }
})

test('ruled paper and grid lines are removed without losing the crossing strokes', t => {
  for (const variant of ['ruled', 'grid']) {
    const { alpha, mask, lines } = compute(variant, { ...signatureDefaults, lines: true })
    let remaining = 0
    let linePixels = 0
    let crossings = 0
    let protectedCrossings = 0
    for (let i = 0; i < alpha.length; i++) {
      if (!lines[i]) continue
      if (mask[i]) {
        crossings++
        if (alpha[i] > 0.5) protectedCrossings++
      } else {
        linePixels++
        if (alpha[i] > 0.05) remaining++
      }
    }
    t.diagnostic(variant + ': ' + remaining / linePixels + ' remaining, ' + protectedCrossings / crossings + ' retained crossings')
    assert.ok(remaining / linePixels < 0.02)
    assert.ok(protectedCrossings / crossings >= 0.9)
  }
})

test('stroke width increases at every thickness setting and smoothing changes the alpha edge', () => {
  const { data, width, height } = fixture('clean')
  const source = prepareSignature(data, width, height)
  const mass = [-2, -1, 0, 1, 2].map(thickness =>
    signatureMask(source, { ...signatureDefaults, thickness }).alpha.reduce((sum, value) => sum + value, 0))
  assert.ok(mass.every((value, i) => !i || value > mass[i - 1]))
  assert.notDeepEqual(signatureMask(source, { ...signatureDefaults, smoothing: 100 }).alpha, signatureMask(source).alpha)
})

test('processing stays within the final and live-preview time budgets', t => {
  for (const [width, height, limit] of [[1600, 1200, 1500], [800, 600, 150]]) {
    const image = synthSignature('shadow', width, height)
    const start = performance.now()
    processSignature(image.data, width, height)
    const ms = performance.now() - start
    t.diagnostic(width + '×' + height + ': ' + ms.toFixed(1) + ' ms')
    assert.ok(ms <= limit, ms + ' ms')
  }
})

test('PNG palette fits both backgrounds into 50,000 bytes or warns at 300 px', async () => {
  const image = synthSignature('textured', 1600, 1200)
  const rgba = processSignature(image.data, image.width, image.height)
  async function rasterize(width) {
    const height = Math.round(rgba.height * width / rgba.width)
    const pixels = { data: new Uint8ClampedArray(width * height * 4), width, height }
    const white = { data: new Uint8ClampedArray(width * height * 4), width, height }
    for (let y = 0, p = 0; y < height; y++) {
      for (let x = 0; x < width; x++, p += 4) {
        const from = (Math.floor(y * rgba.height / height) * rgba.width + Math.floor(x * rgba.width / width)) * 4
        pixels.data.set(rgba.data.subarray(from, from + 4), p)
        for (let c = 0; c < 3; c++) white.data[p + c] = 255 + (rgba.data[from + c] - 255) * rgba.data[from + 3] / 255
        white.data[p + 3] = 255
      }
    }
    return { height, pixels, transparent: new Blob([fixturePng(pixels)]), white: new Blob([fixturePng(white)]) }
  }
  const raw = await rasterize(rgba.width)
  assert.ok(raw.transparent.size > 50000)
  const fitted = await fitSignaturePngs(rgba.width, 50000, rasterize)
  assert.ok(fitted.width >= 300)
  assert.equal(fitted.exceedsLimit, false)
  assert.ok(fitted.transparent.size <= 50000 && fitted.white.size <= 50000)
  const png = new Uint8Array(await fitted.transparent.arrayBuffer())
  assert.equal(png[25], 3, 'indexed PNG')
  const tooSmall = await fitSignaturePngs(rgba.width, 80, rasterize)
  assert.equal(tooSmall.width, 300)
  assert.equal(tooSmall.exceedsLimit, true)
})

test('blank and noisy blank, dark frame, one pixel, resizing and invalid data', async () => {
  for (const [variant, error] of [['blank', /NO_INK/], ['noisyBlank', /NO_INK/], ['dark', /TOO_DARK/]]) {
    const { data, width, height } = fixture(variant)
    assert.throws(() => processSignature(data, width, height), error)
  }
  assert.throws(() => processSignature(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1), /NO_INK/)
  assert.deepEqual(scaledSize(8000, 6000, 1600), { width: 1600, height: 1200 })
  assert.equal(photoFileError(new File(['text'], 'wrong.txt', { type: 'text/plain' })), 'errUnsupportedFormat')
  assert.equal(photoFileError({ size: 50 * 1024 * 1024 + 1 }), 'errUploadTooLarge')
  assert.equal(await identifyPhoto(new File(['text'], 'wrong.jpg', { type: 'image/jpeg' })), null)
})

test('both locales include every signature label and corresponding placeholders', () => {
  function shape(value) {
    if (Array.isArray(value)) return value.map(shape)
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)]))
    return [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
  }
  assert.deepEqual(shape(signatureCopy.ru), shape(signatureCopy.kz))
})
