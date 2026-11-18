import { HEAD_TOP_FACTOR } from '../../src/lib/crop.js'

export function projectPoint(transform, point) {
  const [a, b, c, d, e, f] = transform
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
}

const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
  point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1

export function measureCalibration({ landmarks, image, crop, preset, reference }) {
  const pixel = point => ({ x: point.x * image.width, y: point.y * image.height })
  const chin = pixel(landmarks[152]), forehead = pixel(landmarks[10])
  const empty = { headPct: null, inRange: null, centerOffsetPct: null, crownClipped: null,
    chinClipped: null, referenceFactor: null, measured: false, hair: reference?.hair ?? 'unknown' }
  if (!crop.transform) return { ...empty, error: crop.error ?? 'NO_CROP_TRANSFORM', success: false }
  const left = projectPoint(crop.transform, pixel(landmarks[234] ?? landmarks[33]))
  const right = projectPoint(crop.transform, pixel(landmarks[454] ?? landmarks[263]))
  const outputChin = projectPoint(crop.transform, chin)
  const clipped = point => point.x < 0 || point.x > preset.width || point.y < 0 || point.y > preset.height
  const centerOffsetPct = ((left.x + right.x) / 2 - preset.width / 2) / preset.width * 100
  const chinClipped = clipped(outputChin)
  const base = { ...empty, centerOffsetPct, chinClipped, success: crop.success, error: crop.error ?? null }
  // No HEAD_TOP_FACTOR-derived crown is used as a measurement reference.
  // Reusing it would guarantee the preset's midpoint for every input photo.
  if (reference?.reviewed !== true || reference.crownVisible !== true || !validPoint(reference.crown)) return base
  if (reference.chin && !validPoint(reference.chin)) return { ...base, error: 'INVALID_REFERENCE_CHIN' }
  const crown = projectPoint(crop.transform, pixel(reference.crown))
  const actualChin = reference.chin ? projectPoint(crop.transform, pixel(reference.chin)) : outputChin
  const headHeight = actualChin.y - crown.y
  const landmarkFaceHeight = outputChin.y - projectPoint(crop.transform, forehead).y
  if (headHeight <= 0 || landmarkFaceHeight <= 0) return { ...base, error: 'INVALID_REFERENCE_GEOMETRY' }
  const headPct = headHeight / preset.height * 100
  return { ...base, measured: true, headPct, inRange: headPct >= preset.headMinPct && headPct <= preset.headMaxPct,
    crownClipped: clipped(crown),
    chinClipped: clipped(actualChin),
    referenceFactor: headHeight / landmarkFaceHeight }
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function recommendCalibration(rows) {
  const measured = rows.filter(row => row.measured && row.success && Number.isFinite(row.referenceFactor))
  const outside = measured.filter(row => !row.inRange).length
  const files = [...new Map(measured.map(row => [row.file, row])).values()]
  const recommendation = { currentFactor: HEAD_TOP_FACTOR, reviewedFiles: files.length, measuredResults: measured.length,
    outsideResults: outside, majorityOutside: outside > measured.length / 2, proposedFactor: null,
    denseHairFactor: null, denseHairMultiplier: null, smallSample: files.length < 5 }
  if (!measured.length || !recommendation.majorityOutside) return recommendation
  const regular = files.filter(row => row.hair === 'regular'), dense = files.filter(row => row.hair === 'dense')
  if (regular.length) recommendation.proposedFactor = median(regular.map(row => row.referenceFactor))
  if (dense.length) recommendation.denseHairFactor = median(dense.map(row => row.referenceFactor))
  if (recommendation.proposedFactor && recommendation.denseHairFactor) {
    recommendation.denseHairMultiplier = recommendation.denseHairFactor / recommendation.proposedFactor
  }
  return recommendation
}
