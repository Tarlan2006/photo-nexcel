import assert from 'node:assert/strict'
import { test } from 'node:test'
import { signatureAspect, signatureFrameDefault, signatureGuideRect, signatureFrameRect, signatureFrameSize,
  signatureFrameSource, centerSignatureFrame, zoomSignatureFrame } from '../src/lib/signature-frame.js'
import { checkSignature, detectSignatureFrame, signatureInk, signatureMargins, signatureSharpness, signatureStrokeWidth } from '../src/lib/signature-checks.js'
import { cropSignatureFrame } from '../src/lib/signature-jpeg.js'
import { signatureTemplatePdf } from '../src/lib/signature-template.js'

function inkImage(width = 550, height = 124, thickness = 5, top = Math.floor((height - thickness) / 2)) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = top; y < top + thickness; y++) for (let x = Math.floor(width * .2); x < width * .8; x++) data[(y * width + x) * 4 + 3] = 255
  return { data, width, height }
}

test('guide keeps exactly 550:124 on landscape, portrait and narrow screens', () => {
  for (const image of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 800, height: 50 }]) {
    const rect = signatureGuideRect(image)
    assert.ok(Math.abs(rect.width / rect.height - signatureAspect) < 1e-12)
    assert.ok(rect.x >= 0 && rect.y >= 0)
    assert.ok(Math.abs(rect.x * 2 + rect.width - image.width) < 1e-10)
    assert.ok(Math.abs(rect.y * 2 + rect.height - image.height) < 1e-10)
  }
})

test('framed output meets both minima and the exact aspect at any source size and zoom', () => {
  for (const [width, height] of [[45, 20], [8000, 6000], [300, 2500], [8000, 80]]) {
    for (const zoom of [.25, 1, 4]) {
      const image = { width, height }, frame = { zoom, panX: .1, panY: -.1 }
      const result = signatureFrameSize(image, frame)
      assert.ok(result.width >= 550 && result.height >= 124)
      assert.equal(result.width / result.height, signatureAspect)
      const source = signatureFrameSource(image, frame)
      assert.ok(Math.abs(source.width / source.height - signatureAspect) < 1e-10)
      assert.equal(result.tooSmall, width < 550 || height < 124 || source.width < 550 || source.height < 124)
    }
  }
  assert.equal(signatureFrameSize({ width: 55, height: 12 }, signatureFrameDefault).tooSmall, true)
})

test('zoom respects bounds and preserves the source point under its anchor', () => {
  const frame = { zoom: 1, panX: .1, panY: -.2 }, anchor = [.3, .8]
  const next = zoomSignatureFrame(frame, 2, anchor)
  assert.equal((anchor[0] - .5 - frame.panX) / frame.zoom, (anchor[0] - .5 - next.panX) / next.zoom)
  assert.equal((anchor[1] - .5 - frame.panY) / frame.zoom, (anchor[1] - .5 - next.panY) / next.zoom)
  assert.equal(zoomSignatureFrame(frame, 100).zoom, 4)
  assert.equal(zoomSignatureFrame(frame, .01).zoom, .25)
})

test('automatic centring places an off-centre signature in the safe region', () => {
  const image = { width: 800, height: 600 }
  const region = { left: .55, top: .24, width: .3, height: .12 }
  const frame = centerSignatureFrame(image, region), rect = signatureFrameRect(image, frame)
  assert.ok(Math.abs(rect.left + rect.width * (region.left + region.width / 2) - .5) < 1e-12)
  assert.ok(Math.abs(rect.top + rect.height * (region.top + region.height / 2) - .5) < 1e-12)
  assert.ok(rect.height * region.height <= 1 - 2 * 5 / 27 + 1e-12)
  assert.deepEqual(centerSignatureFrame(image), signatureFrameDefault)
})

test('margins use 5/27 of output height and detect ink near each border or empty ink', () => {
  const normal = inkImage(), mask = signatureInk(normal)
  const margins = signatureMargins(mask, normal.width, normal.height)
  assert.equal(margins.adequate, true)
  assert.equal(margins.top, 59)
  assert.equal(margins.bottom, 60)
  assert.equal(margins.left, 110)
  const close = inkImage(550, 124, 5, 5)
  assert.equal(signatureMargins(signatureInk(close), 550, 124).adequate, false)
  mask[61 * 550] = 1
  assert.equal(signatureMargins(mask, 550, 124).adequate, false)
  assert.equal(checkSignature({ ...normal, data: new Uint8ClampedArray(normal.data.length) }).content, 'fail')
})

test('median medial stroke thickness distinguishes thin, normal, thick and scaled ink', () => {
  for (const [thickness, expected] of [[1, 'thin'], [5, 'pass'], [11, 'thick']]) {
    const image = inkImage(550, 124, thickness)
    const stroke = signatureStrokeWidth(signatureInk(image), image.width, image.height)
    assert.equal(stroke.status, expected)
    assert.equal(stroke.mm, thickness / 124 * 27)
  }
  const scaled = inkImage(1100, 248, 9)
  assert.equal(signatureStrokeWidth(signatureInk(scaled), 1100, 248).status, 'pass')
})

test('Laplacian variance flags blurred raw pixels, without threshold sharpening', () => {
  const sharp = inkImage(), blurred = inkImage()
  for (let y = 0; y < blurred.height; y++) for (let x = 110; x < 440; x++) {
    const distance = Math.abs(y - 61)
    blurred.data[(y * blurred.width + x) * 4 + 3] = Math.round(100 * Math.exp(-distance * distance / 100))
  }
  assert.ok(signatureSharpness(sharp) > 100)
  assert.ok(signatureSharpness(blurred) < 100)
  assert.equal(checkSignature(sharp, { sharpness: signatureSharpness(blurred) }).sharpness, 'warn')
})

test('long edge lines trigger auto-crop only at 3+ borders; the crop removes all four lines', () => {
  const image = inkImage(), mask = signatureInk(image)
  for (let x = 0; x < image.width; x++) mask[x] = mask[(image.height - 1) * image.width + x] = 1
  assert.equal(detectSignatureFrame(mask, 550, 124).edges, 2)
  for (let y = 0; y < image.height; y++) mask[y * image.width] = 1
  assert.equal(detectSignatureFrame(mask, 550, 124).edges, 3)
  for (let y = 0; y < image.height; y++) mask[y * image.width + image.width - 1] = 1
  const frame = detectSignatureFrame(mask, 550, 124)
  assert.equal(frame.edges, 4)
  for (let i = 0; i < mask.length; i++) image.data[i * 4 + 3] = mask[i] * 255
  const cropped = cropSignatureFrame(image, frame.crop)
  assert.equal(detectSignatureFrame(signatureInk(cropped), cropped.width, cropped.height).edges, 0)
  assert.ok(signatureMargins(signatureInk(cropped), cropped.width, cropped.height).count > 0)
  assert.equal(image.data[3], 255, 'original remains intact')
})

test('PDF has A4 media box, physical 120 x 27 mm frame and valid byte offsets', async () => {
  const pdf = signatureTemplatePdf(Uint8Array.of(255, 216, 255, 217), 1260, 1782)
  assert.equal(pdf.type, 'application/pdf')
  const bytes = new Uint8Array(await pdf.arrayBuffer())
  const text = new TextDecoder().decode(bytes)
  assert.match(text, /^%PDF-1.4/)
  assert.match(text, /\/MediaBox \[0 0 595\.2755905511812 841\.8897637795277\]/)
  assert.ok(text.includes(`${120 * 72 / 25.4}`.slice(0, 14)))
  const xref = Number(text.match(/startxref\n(\d+)/)[1])
  assert.equal(new TextDecoder().decode(bytes.subarray(xref, xref + 4)), 'xref')
  const offsets = text.slice(text.indexOf('xref\n')).match(/\d{10} 00000 n/g)
  for (let i = 0; i < 5; i++) assert.equal(new TextDecoder().decode(bytes.subarray(Number(offsets[i].slice(0, 10)), Number(offsets[i].slice(0, 10)) + 7)), `${i + 1} 0 obj`)
})
