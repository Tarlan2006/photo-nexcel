import { cropFace, HEAD_TOP_FACTOR } from '../src/lib/crop.js'
import { runPhotoChecks } from '../src/lib/checks.js'
import { exportToJpegLimit } from '../src/lib/export.js'
import { presets } from '../src/presets.js'

// Canvas and DOM mocks for Node.js environment
class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas
    this.imageSmoothingEnabled = true
    this.imageSmoothingQuality = 'high'
  }
  clearRect() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
  rotate() {}
  drawImage() {}
  getImageData(x, y, w, h) {
    const length = w * h * 4
    const data = new Uint8ClampedArray(length)
    const lum = this.canvas._mockLuminance ?? 135
    for (let i = 0; i < length; i += 4) {
      data[i] = lum
      data[i + 1] = lum
      data[i + 2] = lum
      data[i + 3] = 255
    }
    return { data, width: w, height: h }
  }
}

class MockCanvas {
  constructor(w = 413, h = 531) {
    this.width = w
    this.height = h
    this.ctx = new MockContext2D(this)
    this._mockLuminance = 135
    this._mockBlobMultiplier = 1.0
  }
  getContext() {
    return this.ctx
  }
  toBlob(callback, type, quality = 0.92) {
    const pixels = this.width * this.height
    const baseBytes = pixels * (0.04 + quality * 0.12) * this._mockBlobMultiplier
    const byteSize = Math.max(1024, Math.round(baseBytes))
    const blob = {
      size: byteSize,
      type: 'image/jpeg',
    }
    setTimeout(() => callback(blob), 2)
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return new MockCanvas()
    return {}
  },
}

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  totalTests++
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    failedTests++
  } else {
    console.log(`✅ PASS: ${message}`)
    passedTests++
  }
}

console.log('=================================================================')
console.log('🧪 TEST SUITE: Synthetic Photo Geometry and JPEG Tests')
console.log(`   HEAD_TOP_FACTOR = ${HEAD_TOP_FACTOR}`)
console.log('=================================================================\n')

function buildSelfieLandmarks({
  eyeMidX = 0.5,
  eyeMidY = 0.42,
  eyeDist = 0.12,
  tiltDeg = 0,
  foreheadY = 0.28,
  chinY = 0.60,
  noseOffsetX = 0,
}) {
  const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const rad = (tiltDeg * Math.PI) / 180

  landmarks[33] = {
    x: eyeMidX - (eyeDist / 2) * Math.cos(rad),
    y: eyeMidY - (eyeDist / 2) * Math.sin(rad),
  }
  landmarks[263] = {
    x: eyeMidX + (eyeDist / 2) * Math.cos(rad),
    y: eyeMidY + (eyeDist / 2) * Math.sin(rad),
  }

  landmarks[10] = { x: eyeMidX, y: foreheadY }
  landmarks[152] = { x: eyeMidX, y: chinY }
  landmarks[1] = { x: eyeMidX + noseOffsetX, y: (eyeMidY + chinY) / 2 }

  return landmarks
}

// Six synthetic landmark profiles
const selfies = [
  {
    name: 'Selfie 1: iPhone 14 Pro Standard (3024x4032, neutral angle)',
    width: 3024,
    height: 4032,
    params: { eyeMidX: 0.5, eyeMidY: 0.42, eyeDist: 0.12, tiltDeg: 1.2, foreheadY: 0.28, chinY: 0.60 },
  },
  {
    name: 'Selfie 2: High Hairline / Voluminous Hair (Samsung S23, 3000x4000)',
    width: 3000,
    height: 4000,
    params: { eyeMidX: 0.5, eyeMidY: 0.44, eyeDist: 0.11, tiltDeg: -0.8, foreheadY: 0.32, chinY: 0.62 },
  },
  {
    name: 'Selfie 3: Head Tilt 6.5° (Xiaomi Redmi, 2448x3264)',
    width: 2448,
    height: 3264,
    params: { eyeMidX: 0.50, eyeMidY: 0.44, eyeDist: 0.11, tiltDeg: 6.5, foreheadY: 0.30, chinY: 0.60 },
  },
  {
    name: 'Selfie 4: Close-up Framing (2200x2933, face 45% of frame)',
    width: 2200,
    height: 2933,
    params: { eyeMidX: 0.5, eyeMidY: 0.45, eyeDist: 0.13, tiltDeg: -1.5, foreheadY: 0.30, chinY: 0.62 },
  },
  {
    name: 'Selfie 5: Distant Shot 1.5m (3000x4000, face 28% of frame)',
    width: 3000,
    height: 4000,
    params: { eyeMidX: 0.49, eyeMidY: 0.43, eyeDist: 0.08, tiltDeg: 2.0, foreheadY: 0.33, chinY: 0.55 },
  },
  {
    name: 'Selfie 6: Male with Beard / Low Chin (2800x3733)',
    width: 2800,
    height: 3733,
    params: { eyeMidX: 0.5, eyeMidY: 0.42, eyeDist: 0.12, tiltDeg: 0.0, foreheadY: 0.28, chinY: 0.62 },
  },
]

async function runSelfieTests() {
  for (let i = 0; i < selfies.length; i++) {
    const s = selfies[i]
    console.log(`--- Testing ${s.name} ---`)

    const source = { width: s.width, height: s.height }
    const landmarks = buildSelfieLandmarks({ ...s.params })

    // Test A: Kazakhstan ID Preset (413x531, target head 70-80%, max 30 KB)
    const kzRes = cropFace(source, landmarks, presets.kz_id, { scaleOffset: 0, offsetY: 0 })
    assert(kzRes.success === true, `[${i + 1}] kz_id: cropFace succeeded`)
    assert(kzRes.width === 413 && kzRes.height === 531, `[${i + 1}] kz_id: dimensions 413x531 px`)
    assert(
      typeof kzRes.chinY === 'number' && typeof kzRes.chinPct === 'number',
      `[${i + 1}] kz_id: real chin position returned (${kzRes.chinPct}%)`
    )
    assert(
      kzRes.headPct >= presets.kz_id.headMinPct && kzRes.headPct <= presets.kz_id.headMaxPct,
      `[${i + 1}] kz_id: headPct ${kzRes.headPct}% is within standard [${presets.kz_id.headMinPct}%, ${presets.kz_id.headMaxPct}%]`
    )

    const kzExport = await exportToJpegLimit(kzRes.canvas, presets.kz_id.maxKb)
    assert(kzExport.success === true, `[${i + 1}] kz_id: exported within limit (${kzExport.sizeKb} KB <= 30 KB)`)
    assert(kzExport.sizeKb <= 30, `[${i + 1}] kz_id: file size strictly <= 30 KB`)

    // Test B: Green Card DV Preset (600x600, target head 50-69%, max 240 KB)
    const dvRes = cropFace(source, landmarks, presets.dv, { scaleOffset: 0, offsetY: 0 })
    assert(dvRes.success === true, `[${i + 1}] dv: cropFace succeeded (valid frame)`)
    assert(dvRes.width === 600 && dvRes.height === 600, `[${i + 1}] dv: dimensions 600x600 px`)
    assert(
      typeof dvRes.chinY === 'number' && typeof dvRes.chinPct === 'number',
      `[${i + 1}] dv: real chin position returned (${dvRes.chinPct}%)`
    )
    assert(
      dvRes.headPct >= presets.dv.headMinPct && dvRes.headPct <= presets.dv.headMaxPct,
      `[${i + 1}] dv: headPct ${dvRes.headPct}% is within standard [${presets.dv.headMinPct}%, ${presets.dv.headMaxPct}%]`
    )

    const dvExport = await exportToJpegLimit(dvRes.canvas, presets.dv.maxKb)
    assert(dvExport.success === true, `[${i + 1}] dv: exported within limit (${dvExport.sizeKb} KB <= 240 KB)`)
    assert(dvExport.sizeKb <= 240, `[${i + 1}] dv: file size strictly <= 240 KB`)

    // Test C: Photo Checks
    const checks = runPhotoChecks(kzRes.canvas, landmarks, s.width, s.height, presets.kz_id, kzRes.headPct)
    assert(checks.length === 8, `[${i + 1}] runPhotoChecks returned all 8 checks`)
    assert(typeof checks[0].ok === 'boolean', `[${i + 1}] checks have valid boolean 'ok' field`)
    assert(typeof checks[0].message?.ru === 'string', `[${i + 1}] checks have valid 'message.ru' string`)
    const headCheck = checks.find((c) => c.id === 'headProportion')
    assert(headCheck && headCheck.status === 'neutral', `[${i + 1}] headProportion check is neutral`)
    assert(
      headCheck && headCheck.message.ru.includes('проверьте по направляющим'),
      `[${i + 1}] headProportion mentions guidelines in RU`
    )
    console.log('')
  }

  // Test D: Invalid canvas guard in exportToJpegLimit
  console.log('--- Testing exportToJpegLimit safety guards ---')
  const guardRes = await exportToJpegLimit(null, 30)
  assert(guardRes.success === false && guardRes.error === 'INVALID_CANVAS', 'exportToJpegLimit handles null canvas safely')

  // Test E: Blendshapes Checks (Eyes & Mouth)
  console.log('--- Testing Blendshapes Checks (Eyes & Mouth) ---')
  const testCanvas = new MockCanvas(413, 531)
  const testLandmarks = buildSelfieLandmarks({})

  const blinkBlendshapes = [
    { categoryName: 'eyeBlinkLeft', score: 0.75 },
    { categoryName: 'eyeBlinkRight', score: 0.1 },
    { categoryName: 'jawOpen', score: 0.05 },
  ]
  const blinkChecks = runPhotoChecks(testCanvas, testLandmarks, 1000, 1000, presets.kz_id, 75, blinkBlendshapes)
  const eyesCheck = blinkChecks.find((c) => c.id === 'eyes')
  assert(eyesCheck && eyesCheck.ok === false, 'Eyes closed blendshape correctly triggers warning')
  assert(eyesCheck && eyesCheck.message.ru === 'Глаза закрыты', 'Eyes closed warning text in RU is correct')
  assert(eyesCheck && eyesCheck.message.kz === 'Көздер жабық', 'Eyes closed warning text in KZ is correct')

  const openMouthBlendshapes = [
    { categoryName: 'eyeBlinkLeft', score: 0.1 },
    { categoryName: 'eyeBlinkRight', score: 0.1 },
    { categoryName: 'jawOpen', score: 0.45 },
  ]
  const mouthChecks = runPhotoChecks(testCanvas, testLandmarks, 1000, 1000, presets.kz_id, 75, openMouthBlendshapes)
  const mouthCheck = mouthChecks.find((c) => c.id === 'mouth')
  assert(mouthCheck && mouthCheck.ok === false, 'Open mouth blendshape correctly triggers warning')
  assert(mouthCheck && mouthCheck.message.ru === 'Рот открыт', 'Open mouth warning text in RU is correct')
  assert(mouthCheck && mouthCheck.message.kz === 'Ауыз ашық', 'Open mouth warning text in KZ is correct')

  // Test F: Background Brightness & Uniformity Check
  console.log('--- Testing Background Check ---')
  const darkBgCanvas = new MockCanvas(413, 531)
  darkBgCanvas._mockLuminance = 150 // Below 170 threshold
  const darkBgChecks = runPhotoChecks(darkBgCanvas, testLandmarks, 1000, 1000, presets.kz_id, 75)
  const bgCheckDark = darkBgChecks.find((c) => c.id === 'background')
  assert(bgCheckDark && bgCheckDark.ok === false, 'Dark background (<170) triggers warning')
  assert(bgCheckDark && bgCheckDark.message.ru === 'Фон должен быть светлым и однотонным', 'Dark background warning in RU is correct')
  assert(bgCheckDark && bgCheckDark.message.kz === 'Фон ашық түсті және біркелкі болуы керек', 'Dark background warning in KZ is correct')

  const lightBgCanvas = new MockCanvas(413, 531)
  lightBgCanvas._mockLuminance = 210 // Well above 170 threshold
  const lightBgChecks = runPhotoChecks(lightBgCanvas, testLandmarks, 1000, 1000, presets.kz_id, 75)
  const bgCheckLight = lightBgChecks.find((c) => c.id === 'background')
  assert(bgCheckLight && bgCheckLight.ok === true, 'Light uniform background (>=170) passes check')

  // Test G: Export Byte Limit (target maxKb * 1000 - 1000 bytes)
  console.log('--- Testing Export Byte Limit (29 000 bytes for 30 KB) ---')
  const exportTargetRes = await exportToJpegLimit(lightBgCanvas, 30)
  assert(exportTargetRes.success === true, 'Export succeeds for 30 KB')
  assert(exportTargetRes.blob.size <= 29000, `Exported size ${exportTargetRes.blob.size} bytes is <= 29,000 bytes`)

  // Test H: Background Side Strips (Upper 55% only)
  console.log('--- Testing Background Side Strips (Upper 55% only) ---')
  class MockCanvasUpperLight extends MockCanvas {
    constructor() {
      super(413, 531)
    }
    getContext() {
      return {
        ...super.getContext(),
        getImageData: (x, y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4)
          for (let row = 0; row < h; row++) {
            // Upper 55% is light background (220), lower 45% is dark clothes (50)
            const lum = row < Math.round(h * 0.55) ? 220 : 50
            for (let col = 0; col < w; col++) {
              const idx = (row * w + col) * 4
              data[idx] = lum
              data[idx + 1] = lum
              data[idx + 2] = lum
              data[idx + 3] = 255
            }
          }
          return { data, width: w, height: h }
        },
      }
    }
  }
  const upperLightCanvas = new MockCanvasUpperLight()
  const upperBgChecks = runPhotoChecks(upperLightCanvas, testLandmarks, 1000, 1000, presets.kz_id, 75)
  const upperBgCheck = upperBgChecks.find((c) => c.id === 'background')
  assert(upperBgCheck && upperBgCheck.ok === true, 'Dark clothing in lower 45% does not trigger background warning')

  console.log('=================================================================')
  console.log(`📊 FINAL RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`)
  console.log('=================================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runSelfieTests()
