import { translations } from '../i18n.js'

export const THRESHOLDS = {
  MAX_TILT_DEG: 8, // Наклон головы больше 8°
  MAX_YAW_RATIO: 0.12, // Поворот головы в сторону
  MIN_BRIGHTNESS: 70, // Слишком темное лицо
  MAX_BRIGHTNESS: 210, // Пересвеченное лицо
  MIN_LAPLACIAN_VAR: 50, // Порог нерезкости/размытия
  MIN_BG_BRIGHTNESS: 170, // Порог яркости фона
  MAX_BG_STDDEV: 28, // Порог разброса однотонности фона
}

function rotatePoint(x, y, cx, cy, rad) {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

function formatMessage(key, params = {}) {
  const ruTpl = translations.ru[key] || key
  const kzTpl = translations.kz[key] || key

  let ru = ruTpl
  let kz = kzTpl

  Object.entries(params).forEach(([k, v]) => {
    ru = ru.replace(`{${k}}`, v)
    kz = kz.replace(`{${k}}`, v)
  })

  return { ru, kz }
}

/**
 * Run automatic photo checks
 *
 * @param {HTMLCanvasElement} canvas - The cropped canvas
 * @param {Array} landmarks - 468/478 face landmarks from MediaPipe
 * @param {number} origW - Original image width
 * @param {number} origH - Original image height
 * @param {Object} preset - Selected document preset
 * @param {number} headPct - Actual percentage of head in canvas
 * @param {Array} blendshapes - Face blendshapes categories from MediaPipe
 * @returns {Array<Object>} List of checks with { id, ok: boolean, status: 'ok'|'warn', key, message: { ru, kz } }
 */
export function runPhotoChecks(canvas, landmarks, origW, origH, preset, headPct, blendshapes = []) {
  const checks = []

  // Safeguard: validate landmarks
  if (!landmarks || landmarks.length < 264) {
    return checks
  }

  // 1. Tilt check (before leveling)
  const p33 = { x: landmarks[33].x * origW, y: landmarks[33].y * origH }
  const p263 = { x: landmarks[263].x * origW, y: landmarks[263].y * origH }
  const eyeDx = p263.x - p33.x
  const eyeDy = p263.y - p33.y
  const angleRad = Math.atan2(eyeDy, eyeDx)
  const angleDeg = Math.round(Math.abs((angleRad * 180) / Math.PI) * 10) / 10
  const isTiltOk = angleDeg <= THRESHOLDS.MAX_TILT_DEG
  const tiltKey = isTiltOk ? 'checkTiltOk' : 'checkTiltWarn'

  checks.push({
    id: 'tilt',
    ok: isTiltOk,
    status: isTiltOk ? 'ok' : 'warn',
    key: tiltKey,
    params: { deg: angleDeg },
    message: formatMessage(tiltKey, { deg: angleDeg }),
  })

  // 2. Yaw (sideways turn) check
  const cx = (p33.x + p263.x) / 2
  const cy = (p33.y + p263.y) / 2
  const eyeDist = Math.hypot(eyeDx, eyeDy)

  const p1 = { x: landmarks[1].x * origW, y: landmarks[1].y * origH }
  const noseRot = rotatePoint(p1.x, p1.y, cx, cy, -angleRad)
  const noseOffset = Math.abs(noseRot.x - cx)
  const yawRatio = eyeDist > 0 ? noseOffset / eyeDist : 0
  const isYawOk = yawRatio <= THRESHOLDS.MAX_YAW_RATIO
  const yawKey = isYawOk ? 'checkYawOk' : 'checkYawWarn'

  checks.push({
    id: 'yaw',
    ok: isYawOk,
    status: isYawOk ? 'ok' : 'warn',
    key: yawKey,
    message: formatMessage(yawKey),
  })

  // 3. Eyes blink & Mouth open checks from Blendshapes
  let eyesOk = true
  let eyesKey = 'checkEyesOk'
  let mouthOk = true
  let mouthKey = 'checkMouthOk'

  if (Array.isArray(blendshapes) && blendshapes.length > 0) {
    const eyeBlinkLeft = blendshapes.find((b) => b.categoryName === 'eyeBlinkLeft')?.score || 0
    const eyeBlinkRight = blendshapes.find((b) => b.categoryName === 'eyeBlinkRight')?.score || 0
    const jawOpen = blendshapes.find((b) => b.categoryName === 'jawOpen')?.score || 0

    if (eyeBlinkLeft > 0.5 || eyeBlinkRight > 0.5) {
      eyesOk = false
      eyesKey = 'checkEyesWarn'
    }

    if (jawOpen > 0.2) {
      mouthOk = false
      mouthKey = 'checkMouthWarn'
    }
  }

  checks.push({
    id: 'eyes',
    ok: eyesOk,
    status: eyesOk ? 'ok' : 'warn',
    key: eyesKey,
    message: formatMessage(eyesKey),
  })

  checks.push({
    id: 'mouth',
    ok: mouthOk,
    status: mouthOk ? 'ok' : 'warn',
    key: mouthKey,
    message: formatMessage(mouthKey),
  })

  // 4. Brightness & Sharpness checks from face region on canvas
  let brightnessOk = true
  let brightnessKey = 'checkBrightnessOk'
  let sharpnessOk = true
  let sharpnessKey = 'checkSharpnessOk'
  let bgOk = true
  let bgKey = 'checkBgOk'

  try {
    if (canvas && canvas.width >= 10 && canvas.height >= 10) {
      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height

      // A. Face region checks (center 50%)
      const boxX = Math.round(w * 0.25)
      const boxY = Math.round(h * 0.2)
      const boxW = Math.max(10, Math.min(Math.round(w * 0.5), w - boxX))
      const boxH = Math.max(10, Math.min(Math.round(h * 0.5), h - boxY))

      const imgData = ctx.getImageData(boxX, boxY, boxW, boxH)
      const data = imgData.data
      const totalPixels = boxW * boxH

      if (totalPixels > 0) {
        const gray = new Float32Array(totalPixels)
        let sumLuminance = 0

        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          gray[j] = lum
          sumLuminance += lum
        }

        const meanLuminance = sumLuminance / totalPixels

        if (meanLuminance < THRESHOLDS.MIN_BRIGHTNESS) {
          brightnessOk = false
          brightnessKey = 'checkBrightnessDark'
        } else if (meanLuminance > THRESHOLDS.MAX_BRIGHTNESS) {
          brightnessOk = false
          brightnessKey = 'checkBrightnessBright'
        }

        // Sharpness via discrete Laplacian variance
        let lapSum = 0
        let lapSumSq = 0
        let lapCount = 0

        for (let y = 1; y < boxH - 1; y++) {
          for (let x = 1; x < boxW - 1; x++) {
            const idx = y * boxW + x
            const lap =
              gray[idx - boxW] +
              gray[idx + boxW] +
              gray[idx - 1] +
              gray[idx + 1] -
              4 * gray[idx]

            lapSum += lap
            lapSumSq += lap * lap
            lapCount++
          }
        }

        const lapMean = lapCount > 0 ? lapSum / lapCount : 0
        const lapVariance = lapCount > 0 ? lapSumSq / lapCount - lapMean * lapMean : 0

        if (lapVariance < THRESHOLDS.MIN_LAPLACIAN_VAR) {
          sharpnessOk = false
          sharpnessKey = 'checkSharpnessWarn'
        }
      }

      // B. Background check: 8% top strip (full width) + 8% side strips (upper 55% of height)
      const leftW = Math.max(1, Math.round(w * 0.08))
      const rightX = w - leftW
      const topH = Math.max(1, Math.round(h * 0.08))
      const sideH = Math.round(h * 0.55)

      const fullImgData = ctx.getImageData(0, 0, w, h)
      const fullData = fullImgData.data

      let bgLumaSum = 0
      let bgLumaSqSum = 0
      let bgPixelCount = 0

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const isTopStrip = y < topH
          const isSideStrip = y < sideH && (x < leftW || x >= rightX)
          if (isTopStrip || isSideStrip) {
            const idx = (y * w + x) * 4
            const lum = 0.299 * fullData[idx] + 0.587 * fullData[idx + 1] + 0.114 * fullData[idx + 2]
            bgLumaSum += lum
            bgLumaSqSum += lum * lum
            bgPixelCount++
          }
        }
      }

      if (bgPixelCount > 0) {
        const bgMean = bgLumaSum / bgPixelCount
        const bgVariance = Math.max(0, bgLumaSqSum / bgPixelCount - bgMean * bgMean)
        const bgStdDev = Math.sqrt(bgVariance)

        if (bgMean < THRESHOLDS.MIN_BG_BRIGHTNESS || bgStdDev > THRESHOLDS.MAX_BG_STDDEV) {
          bgOk = false
          bgKey = 'checkBgWarn'
        }
      }
    }
  } catch {
    brightnessOk = sharpnessOk = bgOk = false
    brightnessKey = sharpnessKey = bgKey = 'checkUnavailable'
  }

  checks.push({
    id: 'brightness',
    ok: brightnessOk,
    status: brightnessOk ? 'ok' : 'warn',
    key: brightnessKey,
    message: formatMessage(brightnessKey),
  })

  checks.push({
    id: 'sharpness',
    ok: sharpnessOk,
    status: sharpnessOk ? 'ok' : 'warn',
    key: sharpnessKey,
    message: formatMessage(sharpnessKey),
  })

  checks.push({
    id: 'background',
    ok: bgOk,
    status: bgOk ? 'ok' : 'warn',
    key: bgKey,
    message: formatMessage(bgKey),
  })

  // 5. Head proportion in final frame (neutral guideline check)
  const headKey = 'checkHeadNeutral'
  const headParams = {
    pct: headPct,
  }

  checks.push({
    id: 'headProportion',
    ok: true,
    status: 'neutral',
    key: headKey,
    params: headParams,
    message: formatMessage(headKey, headParams),
  })

  return checks
}
