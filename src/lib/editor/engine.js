import { hasClosedArea, hasPhotoEdits } from './edit-state.js'
import { applyBrushStrokes } from './brush.js'
import { colorChannels, compositeRows, refineMask, resizeMask } from './mask.js'
import { estimateExposure, scaledSize, sharpenRows, toneRows } from './pixels.js'
import { blendSuitRows, findSuitAnchors, suitPlacement } from './suits.js'

export const segmentInputLimit = 320

export function makeCanvas(width, height) {
  if (typeof document === 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function drawScaled(source, limit) {
  const { width, height } = scaledSize(source.width, source.height, limit)
  const canvas = makeCanvas(width, height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

export function suitTemplateId(suit) {
  return suit.enabled && ['male', 'female'].includes(suit.gender) &&
    ['dark', 'light'].includes(suit.styleId) ? suit.gender + '-' + suit.styleId : null
}

export function createEditorEngine(source, landmarks) {
  const originals = new Map()
  const templates = new Map()
  const refinedMasks = new Map()
  const correctedMasks = new Map()
  const clothingMasks = new Map()
  const fullSize = scaledSize(source.width, source.height, 2000)
  let segmentation
  let anchor
  let closed = false

  function original(limit) {
    if (!originals.has(limit)) {
      const canvas = drawScaled(source, limit)
      originals.set(limit, canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height))
    }
    return originals.get(limit)
  }

  async function rows(height, work) {
    if (typeof document === 'undefined') {
      work(0, height)
      return
    }
    let slice = performance.now()
    for (let start = 0; start < height; start += 16) {
      if (closed) throw new Error('EDITOR_CLOSED')
      work(start, Math.min(height, start + 16))
      if (performance.now() - slice >= 12) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        slice = performance.now()
      }
    }
  }

  async function manualMask(outline, width, height) {
    const canvas = makeCanvas(width, height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.beginPath()
    for (const [index, [x, y]] of outline.entries()) {
      context[index ? 'lineTo' : 'moveTo'](x * width, y * height)
    }
    context.closePath()
    context.fill('evenodd')
    const data = context.getImageData(0, 0, width, height).data
    const mask = new Uint8Array(width * height)
    await rows(height, (start, end) => {
      for (let i = start * width; i < end * width; i++) mask[i] = data[i * 4 + 3]
    })
    return mask
  }

  async function baseBackgroundMask(bg, width, height, dimensions) {
    const key = [bg.method, bg.shift, bg.feather, bg.method === 'manual' ? JSON.stringify(bg.outline) : ''].join('|')
    const cached = refinedMasks.get(dimensions)
    if (cached?.key === key) return cached.mask

    let mask
    if (bg.method === 'manual' && hasClosedArea(bg.outline)) {
      mask = await manualMask(bg.outline, width, height)
    } else if (bg.method === 'auto' && segmentation?.reliable) {
      mask = await resizeMask(segmentation.person, segmentation.width, segmentation.height, width, height, rows)
    }
    if (!mask) return null
    const scale = Math.max(width, height) / Math.max(fullSize.width, fullSize.height)
    const refined = await refineMask(mask, width, height, Math.round(bg.shift * scale), Math.round(bg.feather * scale), rows)
    refinedMasks.set(dimensions, { key, mask: refined })
    return refined
  }

  async function backgroundMask(bg, width, height) {
    const dimensions = width + 'x' + height
    const base = await baseBackgroundMask(bg, width, height, dimensions)
    if (!base || bg.method !== 'auto' || !bg.strokes?.length) return base

    const ids = bg.strokes.map(stroke => stroke.id)
    const cached = correctedMasks.get(dimensions)
    const reuse = cached?.base === base && cached.ids.length <= ids.length &&
      cached.ids.every((id, index) => ids[index] === id)
    if (reuse && ids.length === cached.ids.length) return cached.mask

    const mask = new Uint8Array(reuse ? cached.mask : base)
    await applyBrushStrokes(mask, width, height, bg.strokes.slice(reuse ? cached.ids.length : 0), rows)
    correctedMasks.set(dimensions, { base, ids, mask })
    return mask
  }

  function setSegmentation(value) {
    if (closed) throw new Error('EDITOR_CLOSED')
    segmentation = value
    refinedMasks.clear()
    correctedMasks.clear()
    clothingMasks.clear()
    anchor = value.reliable ? findSuitAnchors(landmarks, value.categories, value.width, value.height) : null
    return { reliable: value.reliable, coverage: value.coverage, suitSupported: Boolean(anchor) }
  }

  async function render({ edit, preview, showMask }) {
    if (closed) throw new Error('EDITOR_CLOSED')
    const base = original(preview ? 800 : 2000)
    const { width, height } = base
    const data = new Uint8ClampedArray(base.data)
    const mask = edit.bg.enabled ? await backgroundMask(edit.bg, width, height) : null

    if (showMask && mask) {
      await rows(height, (start, end) => {
        for (let i = start * width; i < end * width; i++) {
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = mask[i]
          data[i * 4 + 3] = 255
        }
      })
    } else if (hasPhotoEdits(edit)) {
      await rows(height, (start, end) => toneRows(data, width, start, end, edit))
      if (edit.filter === 'sharp') {
        const soft = new Uint8ClampedArray(data)
        await rows(height, (start, end) => sharpenRows(data, soft, width, height, start, end))
      }

      const template = templates.get(suitTemplateId(edit.suit))
      if (template && anchor) {
        const overlay = makeCanvas(width, height)
        const context = overlay.getContext('2d', { willReadFrequently: true })
        const position = suitPlacement(anchor, width, height, edit.suit.scale, edit.suit.offset)
        context.drawImage(template, position.x, position.y, position.width, position.height)
        const dimensions = width + 'x' + height
        if (!clothingMasks.has(dimensions)) {
          const clothing = await resizeMask(segmentation.clothes, segmentation.width, segmentation.height, width, height, rows)
          clothingMasks.set(dimensions, clothing)
        }
        const clothing = clothingMasks.get(dimensions)
        const outfit = context.getImageData(0, 0, width, height).data
        await rows(height, (start, end) => blendSuitRows(data, outfit, clothing, width, height, start, end, anchor.chin))
      }

      if (mask) {
        const color = colorChannels(edit.bg.color)
        await rows(height, (start, end) => compositeRows(data, base.data, mask, width, height, start, end, color))
      }
    }

    const output = makeCanvas(width, height)
    output.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0)
    let matte = null
    if (!preview && mask) {
      const size = scaledSize(width, height, 512)
      matte = {
        ...size,
        data: await resizeMask(mask, width, height, size.width, size.height, rows),
      }
    }
    const bitmap = typeof output.transferToImageBitmap === 'function'
      ? output.transferToImageBitmap()
      : await createImageBitmap(output)
    return preview ? bitmap : { bitmap, matte }
  }

  return {
    render,
    exposure: () => estimateExposure(original(800).data),
    segmentInput: () => drawScaled(source, segmentInputLimit),
    setSegmentation,
    setTemplate: ({ id, bitmap }) => {
      if (closed) {
        bitmap.close()
        throw new Error('EDITOR_CLOSED')
      }
      templates.get(id)?.close()
      templates.set(id, bitmap)
    },
    close() {
      closed = true
      for (const bitmap of templates.values()) bitmap.close()
      templates.clear()
      originals.clear()
      refinedMasks.clear()
      correctedMasks.clear()
      clothingMasks.clear()
      segmentation = null
      anchor = null
    },
  }
}
