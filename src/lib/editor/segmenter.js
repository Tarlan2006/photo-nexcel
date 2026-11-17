import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { maskMetrics } from './mask.js'

const modelPath = '/models/selfie-multiclass-v1.tflite'

export async function segmentPortrait(input, createCanvas) {
  const webglCanvas = createCanvas(1, 1)
  const gl = webglCanvas.getContext('webgl2')
  if (!gl) throw new Error('NO_WEBGL')

  let task
  let result
  try {
    const vision = await FilesetResolver.forVisionTasks(__MEDIAPIPE_WASM_PATH__)
    task = await ImageSegmenter.createFromOptions(vision, {
      canvas: webglCanvas,
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
    const start = performance.now()
    result = task.segment(input)
    const [background] = result.confidenceMasks ?? []
    if (!background) throw new Error('NO_MASK')

    const { width, height } = background
    const backgroundScores = background.getAsFloat32Array()
    const person = new Uint8Array(width * height)
    for (let i = 0; i < person.length; i++) {
      const alpha = Math.min(1, Math.max(0, (1 - backgroundScores[i] - 0.08) / 0.84))
      person[i] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255)
    }

    const analysis = createCanvas(width, height)
    const context = analysis.getContext('2d', { willReadFrequently: true })
    context.drawImage(input, 0, 0, width, height)
    const metrics = maskMetrics(person, context.getImageData(0, 0, width, height).data)
    performance.clearMeasures('photo-editor-segmentation')
    performance.measure('photo-editor-segmentation', { start })
    return { width, height, person, ...metrics }
  } finally {
    result?.close()
    task?.close()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
