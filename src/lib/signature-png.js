const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  return value
})

function chunk(type, bytes) {
  const result = new Uint8Array(bytes.length + 12)
  const view = new DataView(result.buffer)
  view.setUint32(0, bytes.length)
  result.set([...type].map(letter => letter.charCodeAt(0)), 4)
  result.set(bytes, 8)
  let crc = 0xffffffff
  for (let i = 4; i < result.length - 4; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ result[i]) & 255]
  view.setUint32(result.length - 4, crc ^ 0xffffffff)
  return result
}

// Use fewer RGB bins for the largely single-color ink than for opacity.
// Each occupied bin gets the average color of its pixels.
function quantize({ data, width, height }, colorBins, alphaLevels) {
  const groups = []
  const lookup = new Int16Array(colorBins ** 3 * alphaLevels).fill(-1)
  const scanlines = new Uint8Array((width + 1) * height)
  const palette = [[0, 0, 0, 0]]
  const ranges = [255, 255, 255, 0, 0, 0]
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 12) continue
    for (let c = 0; c < 3; c++) {
      ranges[c] = Math.min(ranges[c], data[p + c])
      ranges[c + 3] = Math.max(ranges[c + 3], data[p + c])
    }
  }
  const scales = ranges.slice(0, 3).map((min, c) => (colorBins - 1) / Math.max(1, ranges[c + 3] - min))
  for (let y = 0, p = 0; y < height; y++) {
    for (let x = 0; x < width; x++, p += 4) {
      const alpha = Math.round(data[p + 3] * alphaLevels / 255)
      if (!alpha) continue
      const r = Math.round((data[p] - ranges[0]) * scales[0])
      const g = Math.round((data[p + 1] - ranges[1]) * scales[1])
      const b = Math.round((data[p + 2] - ranges[2]) * scales[2])
      const key = ((r * colorBins + g) * colorBins + b) * alphaLevels + alpha - 1
      if (lookup[key] === -1) {
        lookup[key] = groups.length
        groups.push({ rgb: [0, 0, 0], count: 0, alpha })
      }
      const index = lookup[key]
      const group = groups[index]
      for (let c = 0; c < 3; c++) group.rgb[c] += data[p + c]
      group.count++
      scanlines[y * (width + 1) + x + 1] = index + 1
    }
  }
  for (const { rgb, count, alpha } of groups) {
    palette.push([...rgb.map(sum => Math.round(sum / count)), Math.round(alpha * 255 / alphaLevels)])
  }
  return { palette, scanlines }
}

async function palettePngs(image, colorBins, alphaLevels) {
  const { palette, scanlines } = quantize(image, colorBins, alphaLevels)
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, image.width)
  view.setUint32(4, image.height)
  header[8] = 8
  header[9] = 3
  const compressed = new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'))
  const imageChunk = chunk('IDAT', new Uint8Array(await new Response(compressed).arrayBuffer()))
  const start = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', header)]
  const end = [imageChunk, chunk('IEND', new Uint8Array())]
  const rgb = palette.flatMap(([r, g, b]) => [r, g, b])
  const onWhite = palette.flatMap(([r, g, b, a]) =>
    [r, g, b].map(channel => Math.round(255 + (channel - 255) * a / 255)))
  const alpha = Uint8Array.from(palette, rgba => rgba[3])
  return [
    new Blob([...start, chunk('PLTE', Uint8Array.from(rgb)), chunk('tRNS', alpha), ...end], { type: 'image/png' }),
    new Blob([...start, chunk('PLTE', Uint8Array.from(onWhite)), ...end], { type: 'image/png' }),
  ]
}

export async function fitSignaturePngs(width, limit, rasterize) {
  for (;;) {
    const { transparent, white, pixels, height } = await rasterize(width)
    let blobs = [transparent, white]
    let bytes = Math.max(transparent.size, white.size)
    if (bytes > limit && pixels && typeof CompressionStream !== 'undefined') {
      for (const [colors, levels] of [[3, 8], [2, 5], [1, 4]]) {
        const indexed = await palettePngs(pixels, colors, levels)
        const indexedBytes = Math.max(...indexed.map(blob => blob.size))
        if (indexedBytes < bytes) {
          blobs = indexed
          bytes = indexedBytes
        }
        if (bytes <= limit) break
      }
    }
    if (bytes <= limit || width <= 300) {
      return { transparent: blobs[0], white: blobs[1], width, height, exceedsLimit: bytes > limit }
    }
    // Use the byte ratio to pick the next size, then verify the actual encoding.
    width = Math.max(300, Math.floor(width * Math.min(0.88, Math.sqrt(limit / bytes))))
  }
}

export async function exportSignature(image, { width: fixedWidth, maxKb }) {
  const limit = maxKb ? Math.floor(maxKb * 1000) : Infinity
  const original = new OffscreenCanvas(image.width, image.height)
  const canvas = new OffscreenCanvas(1, 1)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  original.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  const startingWidth = Math.max(maxKb ? 300 : 1, fixedWidth || image.width)
  try {
    return await fitSignaturePngs(startingWidth, limit, async width => {
      canvas.width = width
      canvas.height = Math.max(1, Math.round(image.height * width / image.width))
      context.imageSmoothingQuality = 'high'
      context.drawImage(original, 0, 0, width, canvas.height)
      const pixels = Number.isFinite(limit) && typeof CompressionStream !== 'undefined'
        ? context.getImageData(0, 0, width, canvas.height)
        : null
      const transparent = await canvas.convertToBlob({ type: 'image/png' })
      context.globalCompositeOperation = 'destination-over'
      context.fillStyle = '#fff'
      context.fillRect(0, 0, width, canvas.height)
      const white = await canvas.convertToBlob({ type: 'image/png' })
      return { transparent, white, pixels, height: canvas.height }
    })
  } finally {
    original.width = original.height = canvas.width = canvas.height = 1
  }
}
