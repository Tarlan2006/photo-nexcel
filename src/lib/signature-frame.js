import { clamp } from './editor/pixels.js'

export const signatureAspect = 550 / 124
// These millimetres describe our printable aid, not a prescribed official blank.
export const signatureTemplate = Object.freeze({ widthMm: 120, heightMm: 27, marginMm: 5 })
export const signatureSafeY = signatureTemplate.marginMm / signatureTemplate.heightMm
export const signatureSafeX = signatureTemplate.marginMm / signatureTemplate.widthMm
export const signatureFrameDefault = Object.freeze({ zoom: 1, panX: 0, panY: 0 })

export function signatureGuideRect({ width, height }, percent = 88) {
  const frameWidth = Math.min(width * percent / 100, height * .8 * signatureAspect)
  const frameHeight = frameWidth / signatureAspect
  return { x: (width - frameWidth) / 2, y: (height - frameHeight) / 2, width: frameWidth, height: frameHeight }
}

export function signatureFrameRect(image, frame = signatureFrameDefault) {
  const scale = Math.min(1 / image.width, 1 / (signatureAspect * image.height)) * clamp(frame.zoom, .25, 4)
  const width = image.width * scale
  const height = image.height * scale * signatureAspect
  return { left: .5 + frame.panX - width / 2, top: .5 + frame.panY - height / 2, width, height }
}

export function zoomSignatureFrame(frame, zoom, anchor = [.5, .5]) {
  const next = clamp(zoom, .25, 4)
  const ratio = next / frame.zoom
  return { zoom: next, panX: anchor[0] - .5 - (anchor[0] - .5 - frame.panX) * ratio,
    panY: anchor[1] - .5 - (anchor[1] - .5 - frame.panY) * ratio }
}

export function centerSignatureFrame(image, region) {
  if (!region) return signatureFrameDefault
  const base = signatureFrameRect(image)
  const zoom = clamp(Math.min((1 - 2 * signatureSafeX) / (region.width * base.width),
    (1 - 2 * signatureSafeY) / (region.height * base.height)), .25, 4)
  return { zoom, panX: (.5 - region.left - region.width / 2) * base.width * zoom,
    panY: (.5 - region.top - region.height / 2) * base.height * zoom }
}

export function signatureFrameSource(image, frame) {
  const rect = signatureFrameRect(image, frame)
  return { x: -rect.left / rect.width * image.width, y: -rect.top / rect.height * image.height,
    width: image.width / rect.width, height: image.height / rect.height }
}

export function signatureFrameSize(image, frame) {
  const source = signatureFrameSource(image, frame)
  const multiple = clamp(Math.floor(source.width / 550), 1, 4)
  return { width: 550 * multiple, height: 124 * multiple,
    tooSmall: image.width < 550 || image.height < 124 || source.width < 550 || source.height < 124 }
}
