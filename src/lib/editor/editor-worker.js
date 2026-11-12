import { createEditorEngine, makeCanvas } from './engine.js'
import { segmentPortrait } from './segmenter.js'

let engine
let segmentation

const operations = {
  init({ bitmap, landmarks }) {
    engine = createEditorEngine(bitmap, landmarks)
  },
  render: (args) => engine.render(args),
  exposure: () => engine.exposure(),
  setTemplate: (args) => engine.setTemplate(args),
  setSegmentation: (value) => engine.setSegmentation(value),
  segment: () => {
    segmentation ??= segmentPortrait(engine.segmentInput(), makeCanvas)
      .then((value) => engine.setSegmentation(value))
      .catch((error) => {
        segmentation = null
        throw error
      })
    return segmentation
  },
}

self.onmessage = async ({ data: { id, action, args } }) => {
  try {
    const value = await operations[action](args)
    const bitmap = value instanceof ImageBitmap ? value : value?.bitmap
    const transfer = bitmap ? [bitmap] : []
    if (value?.matte) transfer.push(value.matte.data.buffer)
    self.postMessage({ id, value }, transfer)
  } catch (error) {
    self.postMessage({ id, error: error.message })
  }
}
