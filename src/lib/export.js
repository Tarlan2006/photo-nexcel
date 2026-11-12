function getCanvasBlob(canvas, quality) {
  return new Promise((resolve) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      resolve(null)
      return
    }
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

/**
 * Binary search for JPEG quality between 0.35 and 0.95
 * to satisfy file size <= maxKb with maximum possible visual quality.
 *
 * @param {HTMLCanvasElement} canvas - Canvas with cropped image
 * @param {number} maxKb - Maximum allowable size in kilobytes
 * @returns {Promise<{ success: boolean, blob?: Blob, quality?: number, sizeKb?: number, bytes?: number, error?: string }>}
 */
export async function exportToJpegLimit(canvas, maxKb) {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    return {
      success: false,
      error: 'INVALID_CANVAS',
      sizeKb: 0,
      bytes: 0,
    }
  }

  const maxBytes = maxKb * 1024

  // Check highest quality (0.95) first
  const blob95 = await getCanvasBlob(canvas, 0.95)
  if (blob95 && blob95.size <= maxBytes) {
    return {
      success: true,
      blob: blob95,
      quality: 0.95,
      sizeKb: Math.round(blob95.size / 1024),
      bytes: blob95.size,
    }
  }

  // Check lowest acceptable quality (0.35)
  const blob35 = await getCanvasBlob(canvas, 0.35)
  if (!blob35 || blob35.size > maxBytes) {
    return {
      success: false,
      error: 'FILE_TOO_LARGE',
      minSizeKb: blob35 ? Math.round(blob35.size / 1024) : 0,
      blob: blob35,
    }
  }

  // Binary search for optimal quality between 0.35 and 0.95
  let low = 0.35
  let high = 0.95
  let bestBlob = blob35
  let bestQuality = 0.35

  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2
    const blob = await getCanvasBlob(canvas, mid)
    if (blob && blob.size <= maxBytes) {
      bestBlob = blob
      bestQuality = mid
      low = mid // try higher quality
    } else {
      high = mid // exceeds limit, step down
    }
  }

  return {
    success: true,
    blob: bestBlob,
    quality: Number(bestQuality.toFixed(2)),
    sizeKb: Math.round(bestBlob.size / 1024),
    bytes: bestBlob.size,
  }
}
