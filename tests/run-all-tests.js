import { cropFace, HEAD_TOP_FACTOR } from '../src/lib/crop.js'
import { runPhotoChecks, THRESHOLDS } from '../src/lib/checks.js'
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
console.log('🧪 TEST SUITE: Real Phone Selfie Validation & Geometry Tests')
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

// 6 Real Phone Selfie Test Profiles
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
      dvRes.headPct >= presets.dv.headMinPct && dvRes.headPct <= presets.dv.headMaxPct,
      `[${i + 1}] dv: headPct ${dvRes.headPct}% is within standard [${presets.dv.headMinPct}%, ${presets.dv.headMaxPct}%]`
    )

    const dvExport = await exportToJpegLimit(dvRes.canvas, presets.dv.maxKb)
    assert(dvExport.success === true, `[${i + 1}] dv: exported within limit (${dvExport.sizeKb} KB <= 240 KB)`)
    assert(dvExport.sizeKb <= 240, `[${i + 1}] dv: file size strictly <= 240 KB`)

    // Test C: Photo Checks
    const checks = runPhotoChecks(kzRes.canvas, landmarks, s.width, s.height, presets.kz_id, kzRes.headPct)
    assert(checks.length === 5, `[${i + 1}] runPhotoChecks returned all 5 checks`)
    assert(typeof checks[0].ok === 'boolean', `[${i + 1}] checks have valid boolean 'ok' field`)
    assert(typeof checks[0].message?.ru === 'string', `[${i + 1}] checks have valid 'message.ru' string`)
    console.log('')
  }

  // Test D: Invalid canvas guard in exportToJpegLimit
  console.log('--- Testing exportToJpegLimit safety guards ---')
  const guardRes = await exportToJpegLimit(null, 30)
  assert(guardRes.success === false && guardRes.error === 'INVALID_CANVAS', 'exportToJpegLimit handles null canvas safely')

  console.log('=================================================================')
  console.log(`📊 FINAL RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`)
  console.log('=================================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runSelfieTests()
