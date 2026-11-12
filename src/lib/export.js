function getJpeg(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob?.type === 'image/jpeg' ? blob : null), 'image/jpeg', quality)
  })
}

export async function exportToJpegLimit(canvas, maxKb) {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    return { success: false, error: 'INVALID_CANVAS', sizeKb: 0, bytes: 0 }
  }

  const maxBytes = maxKb * 1000 - 1000
  const result = (blob, quality) => ({
    success: true,
    blob,
    quality,
    sizeKb: Math.ceil(blob.size / 1000),
    bytes: blob.size,
  })

  const highest = await getJpeg(canvas, 0.95)
  if (!highest) return { success: false, error: 'ENCODE_FAILED' }
  if (highest.size <= maxBytes) return result(highest, 0.95)

  let low = 0.35
  let high = 0.95
  let best = await getJpeg(canvas, low)
  if (!best) return { success: false, error: 'ENCODE_FAILED' }
  if (best.size > maxBytes) {
    high = low
    low = 0
    best = await getJpeg(canvas, low)
    if (!best) return { success: false, error: 'ENCODE_FAILED' }
    if (best.size > maxBytes) return { success: false, error: 'FILE_TOO_LARGE' }
  }

  for (let i = 0; i < 6; i++) {
    const quality = (low + high) / 2
    const blob = await getJpeg(canvas, quality)
    if (!blob) return { success: false, error: 'ENCODE_FAILED' }
    if (blob.size <= maxBytes) {
      best = blob
      low = quality
    } else {
      high = quality
    }
  }

  return result(best, Number(low.toFixed(2)))
}
