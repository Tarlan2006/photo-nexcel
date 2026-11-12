import { clamp } from './pixels.js'

export const suitStyles = ['dark', 'light']

export function findSuitAnchors(landmarks, categories, width, height) {
  const chin = landmarks[152]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  const leftFace = landmarks[234]
  const rightFace = landmarks[454]
  if (!chin || !leftEye || !rightEye || !leftFace || !rightFace) return null

  const roll = Math.atan2((rightEye.y - leftEye.y) * height, (rightEye.x - leftEye.x) * width)
  if (Math.abs(roll) > Math.PI / 12 || chin.y > 0.83) return null

  const center = (leftFace.x + rightFace.x) / 2
  const faceWidth = Math.abs(rightFace.x - leftFace.x)
  if (faceWidth < 0.04) return null

  const scanTop = Math.ceil((chin.y + 0.035) * height)
  const scanBottom = Math.min(height, Math.ceil((chin.y + 0.17) * height))
  const rowWidths = []
  let exposedSkin = 0
  let clothCount = 0

  for (let y = scanTop; y < scanBottom; y++) {
    let left = width
    let right = -1
    let rowClothes = 0
    for (let x = 0; x < width; x++) {
      const category = categories[y * width + x]
      if (category === 4) {
        left = Math.min(left, x)
        right = x
        rowClothes++
      }
      if (category === 2 && Math.abs(x / width - center) > faceWidth * 0.6) exposedSkin++
    }
    clothCount += rowClothes
    if (left > 1 && right < width - 2 && rowClothes >= (right - left + 1) * 0.6) {
      const span = (right - left + 1) / width
      if (span >= faceWidth * 1.25 && Math.abs((left + right) / (2 * width) - center) < span * 0.2) {
        rowWidths.push(span)
      }
    }
  }

  if (rowWidths.length < 3 || clothCount === 0 || exposedSkin / clothCount > 0.18) return null
  rowWidths.sort((a, b) => a - b)
  return { center, chin: chin.y, shoulderWidth: rowWidths[Math.floor(rowWidths.length * 0.75)] }
}

export function suitPlacement(anchor, width, height, scale, offset) {
  const collar = Math.max(anchor.chin + 0.012, anchor.chin + 0.045 + offset / 100)
  const size = anchor.shoulderWidth * width * 1.2 * (1 + scale / 100)
  return {
    x: anchor.center * width - size / 2,
    y: collar * height,
    width: size,
    height: size * 0.72,
  }
}

export function blendSuitRows(data, overlay, cloth, width, height, start, end, chin) {
  const top = Math.ceil(chin * height)
  for (let y = Math.max(start, top); y < end; y++) {
    for (let x = 0; x < width; x++) {
      const position = y * width + x
      const i = position * 4
      const strength = clamp((cloth[position] - 128) / 90, 0, 1) * overlay[i + 3] / 255
      for (let c = 0; c < 3; c++) data[i + c] += (overlay[i + c] - data[i + c]) * strength
    }
  }
}
