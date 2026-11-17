import { presets } from '../presets.js'
import { cropFace } from './crop.js'
import { runPhotoChecks } from './checks.js'
import { exportToJpegLimit } from './export.js'
import { hasPhotoEdits } from './editor/edit-state.js'
import { toPhotoParameters } from './photo-flow.js'

const faceErrors = { NO_FACE: 'errNoFace', MULTIPLE_FACES: 'errMultipleFaces', SMALL_FACE: 'errSmallFace' }

function ensureCurrent(source, cancelled) {
  if (source.closed || cancelled()) throw new Error('CANCELLED')
}

async function detect(source) {
  source.detection ??= (async () => {
    const { detectFaceInBitmap } = await import('./detector.js')
    ensureCurrent(source, () => false)
    const timing = 'photo:face-detection'
    performance.mark(timing)
    try {
      return await detectFaceInBitmap(source.bitmap, () => source.closed)
    } finally {
      performance.clearMarks(timing)
    }
  })().catch(error => {
    source.detection = null
    throw error
  })
  return source.detection
}

async function editorSession(source, landmarks) {
  source.session ??= import('./editor/session.js').then(({ createEditorSession }) => {
    ensureCurrent(source, () => false)
    return createEditorSession(source.bitmap, landmarks)
  })
  return source.session
}

function matteCanvas(matte) {
  if (!matte) return null
  const canvas = document.createElement('canvas')
  canvas.width = matte.width
  canvas.height = matte.height
  const context = canvas.getContext('2d')
  const image = context.createImageData(matte.width, matte.height)
  for (let i = 0; i < matte.data.length; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = matte.data[i]
    image.data[i * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function releaseCanvas(canvas) {
  if (canvas) canvas.width = canvas.height = 1
}

async function renderPhoto(source, edit, session, cancelled) {
  if (!hasPhotoEdits(edit)) return { bitmap: source.bitmap, matte: null }
  const key = JSON.stringify(edit)
  if (source.rendered?.key === key) return source.rendered
  const rendered = await session.render({ edit, preview: false, showMask: false })
  if (source.closed || cancelled()) {
    rendered.bitmap.close()
    throw new Error('CANCELLED')
  }
  source.rendered?.bitmap.close()
  source.rendered = { ...rendered, key }
  return source.rendered
}

async function preparePhoto(source, settings, progress, cancelled) {
  ensureCurrent(source, cancelled)
  progress('processingFace')
  const face = await detect(source)
  ensureCurrent(source, cancelled)
  if (!face?.success) throw new Error(faceErrors[face?.error] ?? 'processingError')
  const { landmarks } = face
  const preset = presets[settings.presetId]
  const { edit, adjustments, autoExposure } = toPhotoParameters(settings)
  const session = autoExposure || hasPhotoEdits(edit) ? await editorSession(source, landmarks) : null
  ensureCurrent(source, cancelled)

  if (edit.bg.enabled || edit.suit.enabled) {
    progress('processingBackground')
    const segmentation = await session.segment().catch(() => { throw new Error('modelError') })
    ensureCurrent(source, cancelled)
    if (edit.bg.enabled && !segmentation.reliable) throw new Error('unreliableMask')
    if (edit.suit.enabled && !segmentation.suitSupported) throw new Error('suitUnavailable')
  }
  if (autoExposure) {
    progress('processingLight')
    source.exposure ??= await session.exposure()
    ensureCurrent(source, cancelled)
    edit.exposure = source.exposure
  }

  return { face, preset, edit, adjustments, session }
}

export async function previewPhotoSettings(source, settings, cancelled) {
  const { face, preset, edit, adjustments, session } = await preparePhoto(source, settings, () => {}, cancelled)
  let rendered
  let crop
  let preview
  try {
    // Preview uses the same edits and framing as export, at a smaller working size.
    if (hasPhotoEdits(edit)) rendered = await session.render({ edit, preview: true, showMask: false })
    ensureCurrent(source, cancelled)
    crop = cropFace(rendered ?? source.bitmap, face.landmarks, preset, adjustments)
    if (!crop.success) throw new Error('errOutOfBounds')
    preview = await createImageBitmap(crop.canvas)
    ensureCurrent(source, cancelled)
    return preview
  } catch (error) {
    preview?.close()
    throw error
  } finally {
    rendered?.close()
    releaseCanvas(crop?.canvas)
  }
}

export async function runPhotoPipeline(source, settings, progress, cancelled) {
  const { face: { landmarks, blendshapes }, preset, edit, adjustments, session } =
    await preparePhoto(source, settings, progress, cancelled)

  const { bitmap, matte } = await renderPhoto(source, edit, session, cancelled)
  ensureCurrent(source, cancelled)
  progress('processingCrop')
  const mask = matteCanvas(matte)
  let crop
  try {
    crop = cropFace(bitmap, landmarks, preset, adjustments, mask)
    if (!crop.success) throw new Error('errOutOfBounds')
    progress('checkingPhoto')
    const checks = runPhotoChecks(crop.canvas, landmarks, bitmap.width, bitmap.height, preset,
      crop.headPct, blendshapes, crop.backgroundMatte, { rotation: crop.rotation })
    progress('exportPreparing')
    const jpeg = await exportToJpegLimit(crop.canvas, preset.maxKb)
    ensureCurrent(source, cancelled)
    if (!jpeg.success) throw new Error(jpeg.error === 'FILE_TOO_LARGE' ? 'errFileTooLarge' : 'exportFailedTitle')
    return {
      sourceId: source.id, settings, checks, blob: jpeg.blob, sizeKb: jpeg.sizeKb,
      tiltCorrected: Math.abs(crop.rotation) >= 0.2,
      lightCorrected: Boolean(edit.exposure?.strength),
      backgroundChanged: edit.bg.enabled,
    }
  } finally {
    releaseCanvas(mask)
    releaseCanvas(crop?.canvas)
    releaseCanvas(crop?.backgroundMatte)
  }
}

export async function previewPhotoBackground(source, settings) {
  const face = await detect(source)
  const session = await editorSession(source, face.landmarks)
  const { edit, autoExposure } = toPhotoParameters(settings)
  if (autoExposure) edit.exposure = source.exposure
  return session.render({ edit, preview: true, showMask: false })
}
