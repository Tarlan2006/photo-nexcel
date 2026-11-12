const signatures = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
}
export const photoMimeTypes = [...Object.keys(signatures), 'image/webp']

export async function identifyPhoto(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  for (const [type, signature] of Object.entries(signatures)) {
    if (signature.every((value, index) => bytes[index] === value)) return type
  }
  const header = String.fromCharCode(...bytes)
  return header.startsWith('RIFF') && header.endsWith('WEBP') ? 'image/webp' : null
}

export async function decodePhoto(file, mimeType) {
  const bitmap = await createImageBitmap(file.slice(0, file.size, mimeType))
  const maxSide = Math.max(bitmap.width, bitmap.height)
  if (maxSide <= 2500) return bitmap

  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * 2500 / maxSide))
    canvas.height = Math.max(1, Math.round(bitmap.height * 2500 / maxSide))
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await createImageBitmap(canvas)
  } finally {
    bitmap.close()
  }
}
