import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

let initPromise

export function prepareFaceDetector() {
  initPromise ??= FilesetResolver.forVisionTasks(__MEDIAPIPE_WASM_PATH__)
    .then((vision) => FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/face_landmarker.task' },
      runningMode: 'IMAGE',
      numFaces: 2,
      outputFaceBlendshapes: true,
    }))
    .catch((error) => {
      initPromise = null
      throw error
    })
  return initPromise
}

export async function detectFaceInBitmap(bitmap, cancelled) {
  const landmarker = await prepareFaceDetector()
  if (cancelled()) return null

  let input = bitmap
  const maxSide = Math.max(bitmap.width, bitmap.height)
  if (maxSide > 1024) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * 1024 / maxSide))
    canvas.height = Math.max(1, Math.round(bitmap.height * 1024 / maxSide))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    input = canvas
  }

  let detection
  try {
    detection = landmarker.detect(input)
  } finally {
    if (input !== bitmap) input.width = input.height = 1
  }
  const { faceLandmarks, faceBlendshapes } = detection
  if (!faceLandmarks?.length) return { success: false, error: 'NO_FACE' }
  if (faceLandmarks.length > 1) return { success: false, error: 'MULTIPLE_FACES' }
  const landmarks = faceLandmarks[0]
  const forehead = landmarks[10]
  const chin = landmarks[152]
  const faceHeight = Math.hypot(
    (chin.x - forehead.x) * bitmap.width,
    (chin.y - forehead.y) * bitmap.height
  )
  if (faceHeight < Math.max(60, maxSide * 0.1)) return { success: false, error: 'SMALL_FACE' }
  return {
    success: true,
    landmarks,
    blendshapes: faceBlendshapes?.[0]?.categories || [],
  }
}
