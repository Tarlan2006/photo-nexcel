import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

let landmarkerInstance = null
let initPromise = null

export async function getFaceLandmarker() {
  if (landmarkerInstance) {
    return landmarkerInstance
  }
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    // FilesetResolver loads vision_wasm_internal.js & vision_wasm_internal.wasm
    // Both are placed in public/wasm/ and public/
    const vision = await FilesetResolver.forVisionTasks('/wasm')

    landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/face_landmarker.task',
      },
      runningMode: 'IMAGE',
      numFaces: 2,
    })

    return landmarkerInstance
  })()

  return initPromise
}

export async function detectFaceInBitmap(bitmap) {
  const landmarker = await getFaceLandmarker()

  const origW = bitmap.width
  const origH = bitmap.height
  const maxDim = Math.max(origW, origH)

  let inputSource = bitmap

  // Downsample to max 1600px for detection
  if (maxDim > 1600) {
    const scale = 1600 / maxDim
    const detectW = Math.round(origW * scale)
    const detectH = Math.round(origH * scale)

    const canvas = document.createElement('canvas')
    canvas.width = detectW
    canvas.height = detectH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, detectW, detectH)
    inputSource = canvas
  }

  const result = landmarker.detect(inputSource)

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return { success: false, error: 'NO_FACE' }
  }

  if (result.faceLandmarks.length > 1) {
    return { success: false, error: 'MULTIPLE_FACES', count: result.faceLandmarks.length }
  }

  return {
    success: true,
    landmarks: result.faceLandmarks[0],
    originalWidth: origW,
    originalHeight: origH,
  }
}
