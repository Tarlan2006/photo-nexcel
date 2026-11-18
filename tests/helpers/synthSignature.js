import { deflateSync } from 'node:zlib'

const curves = [
  [[132, 350], [180, 344], [235, 141], [275, 174], 4.8],
  [[275, 174], [312, 213], [182, 383], [161, 343], 5.4],
  [[161, 343], [146, 311], [242, 286], [301, 331], 5.1],
  [[301, 331], [340, 356], [320, 253], [366, 255], 3.7],
  [[366, 255], [415, 258], [309, 365], [384, 326], 4.4],
  [[384, 326], [434, 299], [405, 255], [458, 278], 5.5],
  [[458, 278], [491, 304], [416, 354], [474, 325], 5.6],
  [[474, 325], [520, 302], [571, 228], [565, 263], 4.5],
  [[565, 263], [542, 319], [532, 341], [554, 324], 4.0],
  [[554, 324], [591, 307], [651, 307], [669, 299], 3.6],
  [[224, 387], [357, 366], [506, 359], [611, 344], 4.1],
]

function drawSegment(mask, width, height, x, y, endX, endY, radius) {
  const dx = endX - x
  const dy = endY - y
  const extent = dx * dx + dy * dy
  for (let row = Math.max(0, Math.floor(Math.min(y, endY) - radius - 1)); row < Math.min(height, Math.ceil(Math.max(y, endY) + radius + 1)); row++) {
    for (let col = Math.max(0, Math.floor(Math.min(x, endX) - radius - 1)); col < Math.min(width, Math.ceil(Math.max(x, endX) + radius + 1)); col++) {
      const px = col + 0.5 - x
      const py = row + 0.5 - y
      const t = extent ? Math.max(0, Math.min(1, (px * dx + py * dy) / extent)) : 0
      const coverage = Math.min(1, radius + 0.5 - Math.hypot(px - dx * t, py - dy * t))
      const i = row * width + col
      if (coverage > mask[i]) mask[i] = coverage
    }
  }
}

function pointOnCurve(points, t) {
  const inv = 1 - t
  const weights = [inv ** 3, 3 * inv ** 2 * t, 3 * inv * t ** 2, t ** 3]
  return [0, 1].map(axis => weights.reduce((sum, weight, i) => sum + weight * points[i][axis], 0))
}

const basis = Array.from({ length: 8 }, (_, frequency) =>
  Array.from({ length: 8 }, (_, pixel) =>
    (frequency ? 0.5 : Math.SQRT1_2 / 2) * Math.cos((2 * pixel + 1) * frequency * Math.PI / 16)))

// Round 8×8 DCT coefficients and invert, producing quantization and block
// artifacts without using a personal photograph or a native JPEG dependency.
function jpegArtifacts(data, width, height) {
  const block = new Float64Array(64)
  const rows = new Float64Array(64)
  const frequency = new Float64Array(64)
  for (let top = 0; top + 7 < height; top += 8) {
    for (let left = 0; left + 7 < width; left += 8) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) block[y * 8 + x] = data[((top + y) * width + left + x) * 4] - 128
        for (let u = 0; u < 8; u++) {
          let sum = 0
          for (let x = 0; x < 8; x++) sum += block[y * 8 + x] * basis[u][x]
          rows[y * 8 + u] = sum
        }
      }
      for (let v = 0; v < 8; v++) {
        for (let u = 0; u < 8; u++) {
          let sum = 0
          for (let y = 0; y < 8; y++) sum += rows[y * 8 + u] * basis[v][y]
          const step = 4 + (u + v) * 1.5
          frequency[v * 8 + u] = Math.round(sum / step) * step
        }
      }
      for (let y = 0; y < 8; y++) {
        for (let u = 0; u < 8; u++) {
          let sum = 0
          for (let v = 0; v < 8; v++) sum += frequency[v * 8 + u] * basis[v][y]
          rows[y * 8 + u] = sum
        }
        for (let x = 0; x < 8; x++) {
          let sum = 128
          for (let u = 0; u < 8; u++) sum += rows[y * 8 + u] * basis[u][x]
          const p = ((top + y) * width + left + x) * 4
          data[p] = data[p + 1] = data[p + 2] = sum
        }
      }
    }
  }
}

export function synthSignature(variant = 'clean', width = 800, height = 600) {
  const coverage = new Float32Array(width * height)
  const dust = new Float32Array(width * height)
  const mask = new Uint8Array(width * height)
  const lines = new Uint8Array(width * height)
  const data = new Uint8ClampedArray(width * height * 4)
  const sx = width / 800
  const sy = height / 600
  const scale = Math.min(sx, sy)
  if (!['blank', 'dark', 'noisyBlank'].includes(variant)) {
    for (const [...curve] of curves) {
      const diameter = curve.pop() * scale * (variant === 'thin' ? 0.36 : 1)
      let [x, y] = curve[0]
      for (let i = 1; i <= 42; i++) {
        const [endX, endY] = pointOnCurve(curve, i / 42)
        drawSegment(coverage, width, height, x * sx, y * sy, endX * sx, endY * sy, diameter / 2)
        x = endX
        y = endY
      }
    }
    drawSegment(coverage, width, height, 569.5 * sx, 247.5 * sy, 569.5 * sx, 247.5 * sy, 1.08 * scale)
  }
  if (variant === 'dust') {
    for (const [x, y, radius] of [[44, 99, 1], [180, 460, 0.85], [618, 119, 1.18], [729, 410, 0.92], [314, 490, 1.01], [667, 530, 0.97]]) {
      drawSegment(dust, width, height, x * sx, y * sy, x * sx, y * sy, radius * scale)
    }
  }
  let seed = 48271
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const paper = variant === 'yellow' ? [249, 237, 203] : variant === 'dark' ? [10, 10, 10] : [248, 248, 248]
  const ink = (variant === 'blue' || variant === 'textured') ? [21, 45, 133] : variant === 'faint' ? [207, 207, 207] : [29, 29, 29]
  const noisy = variant === 'noisy' || variant === 'noisyBlank'
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      const grid = variant === 'grid' && (y % 29 === 7 || x % 31 === 11)
      const ruled = variant === 'ruled' && y % 32 === 11
      const line = grid || ruled
      const mark = Math.max(coverage[i], dust[i])
      const shade = variant === 'shadow' ? 1 - 0.30 * x / (width - 1) : 1
      const noise = noisy ? (random() + random() + random() + random() + random() + random() - 3) * Math.SQRT2 * 6 : 0
      lines[i] = Number(line)
      mask[i] = Number(coverage[i] >= 0.5)
      for (let c = 0; c < 3; c++) {
        const bg = line ? [155, 169, 193][c] : paper[c]
        const pigment = variant === 'textured' && mark ? ink[c] + (random() - 0.5) * 59 : ink[c]
        data[i * 4 + c] = (bg + (pigment - bg) * mark) * shade + noise
      }
      data[i * 4 + 3] = 255
    }
  }
  if (noisy) jpegArtifacts(data, width, height)
  return { data, mask, lines, width, height }
}

function pngChunk(type, data) {
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length)
  output.write(type, 4)
  output.set(data, 8)
  let crc = 0xffffffff
  for (let i = 4; i < output.length - 4; i++) {
    crc ^= output[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4)
  return output
}

export function fixturePng({ data, width, height }) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const scanlines = Buffer.alloc((width * 4 + 1) * height)
  for (let row = 0; row < height; row++) scanlines.set(data.subarray(row * width * 4, (row + 1) * width * 4), row * (width * 4 + 1) + 1)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scanlines, { level: 3 })), pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// A reproducible local camera source for Chromium. A single I420 frame loops
// through --use-file-for-fake-video-capture, without a physical camera or GPU.
export function fixtureY4m({ data, width, height }) {
  if (width % 2 || height % 2) throw new Error('Y4M needs even dimensions')
  const size = width * height
  const yuv = Buffer.alloc(size * 3 / 2)
  const value = number => Math.max(0, Math.min(255, Math.round(number)))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4
    yuv[y * width + x] = value(16 + .257 * data[p] + .504 * data[p + 1] + .098 * data[p + 2])
    if (x % 2 || y % 2) continue
    let r = 0, g = 0, b = 0
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const sample = ((y + dy) * width + x + dx) * 4
      r += data[sample] / 4; g += data[sample + 1] / 4; b += data[sample + 2] / 4
    }
    const chroma = y / 2 * width / 2 + x / 2
    yuv[size + chroma] = value(128 - .148 * r - .291 * g + .439 * b)
    yuv[size * 5 / 4 + chroma] = value(128 + .439 * r - .368 * g - .071 * b)
  }
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\nFRAME\n`), yuv])
}
