// Minimal browser-only PDF: rasterised local-font text, a vector frame in real
// PDF points, and a byte-accurate cross-reference table. No network or PDF SDK.
export function signatureTemplatePdf(jpeg, imageWidth, imageHeight) {
  const mm = 72 / 25.4, width = 210 * mm, height = 297 * mm
  const encoder = new TextEncoder()
  const parts = [], offsets = [0]
  let length = 0
  function append(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value
    parts.push(bytes); length += bytes.length
  }
  function object(number, text) { offsets[number] = length; append(`${number} 0 obj\n${text}\nendobj\n`) }
  append('%PDF-1.4\n%Nexcel signature template\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /PageText 4 0 R >> >> /Contents 5 0 R >>`)
  offsets[4] = length
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  append(jpeg); append('\nendstream\nendobj\n')
  const content = `q ${width} 0 0 ${height} 0 0 cm /PageText Do Q\n0 G 0.4 w ${(210 - 120) / 2 * mm} ${(297 - 27) / 2 * mm} ${120 * mm} ${27 * mm} re S\n`
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`)
  const xref = length
  append('xref\n0 6\n0000000000 65535 f \n')
  for (let i = 1; i <= 5; i++) append(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

export async function createSignatureTemplate(copy) {
  await document.fonts.load('400 24px Inter', copy.templateInstruction)
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1260; canvas.height = 1782
  try {
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#181a1e'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    function text(value, y, size = 24, maxWidth = 1020) {
      ctx.font = `400 ${size}px Inter, sans-serif`
      const words = value.split(' ')
      let line = ''
      for (const word of words) {
        const candidate = line ? line + ' ' + word : word
        if (line && ctx.measureText(candidate).width > maxWidth) {
          ctx.fillText(line, canvas.width / 2, y); y += size * 1.6; line = word
        } else line = candidate
      }
      if (line) { ctx.fillText(line, canvas.width / 2, y); y += size * 1.6 }
      return y
    }
    text(copy.templateTitle, 160, 34)
    text(copy.templateInstruction, 290, 26)
    // The 120 x 27 mm vector frame is added separately, at the centre of A4.
    let y = text(copy.templatePrint, 1060, 23)
    y = text(copy.templateNote, y + 45, 23)
    text(copy.templateSource, y + 55, 21)
    text('zan.gov.kz/client/#!/doc/140840/rus/158', 1510, 20)
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96))
    if (!jpeg) throw new Error('PDF_FAILED')
    return signatureTemplatePdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height)
  } finally { canvas.width = canvas.height = 1 }
}
