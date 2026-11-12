import { createContext, useContext, useReducer, useRef, useEffect } from 'react'
import { presets, presetList } from '../presets'
import { cropFace } from '../lib/crop'
import { useLang } from './LangContext'

export const WizardContext = createContext(null)

// Lazy load detector module so MediaPipe is split into an independent bundle chunk
let detectorModulePromise = null
function loadDetector() {
  if (!detectorModulePromise) {
    detectorModulePromise = import('../lib/detector')
  }
  return detectorModulePromise
}

const initialState = {
  step: 1, // 1: Photo, 2: Document, 3: Check, 4: Done
  originalImage: null, // { bitmap, objectUrl, landmarks }
  selectedPresetId: 'kz_id',
  cropStates: {}, // { kz_id: cropRes, dv: cropRes }
  adjustments: { scaleOffset: 0, offsetY: 0 },
  isProcessing: false,
  statusMessage: '',
  errorKey: null,
}

function wizardReducer(state, action) {
  switch (action.type) {
    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
        statusMessage: action.payload,
        errorKey: null,
      }

    case 'SET_ERROR':
      return {
        ...state,
        isProcessing: false,
        statusMessage: '',
        errorKey: action.payload,
      }

    case 'SET_IMAGE_SUCCESS':
      return {
        ...state,
        isProcessing: false,
        statusMessage: '',
        errorKey: null,
        originalImage: action.payload.originalImage,
        cropStates: action.payload.cropStates,
        adjustments: { scaleOffset: 0, offsetY: 0 },
        step: 2,
      }

    case 'SET_STEP': {
      const nextStep = action.payload
      if (nextStep > 1 && !state.originalImage) {
        return { ...state, step: 1 }
      }
      return { ...state, step: nextStep }
    }

    case 'POPSTATE_NAVIGATE': {
      const targetStep = action.payload
      if (targetStep > 1 && !state.originalImage) {
        return { ...state, step: 1 }
      }
      return { ...state, step: targetStep }
    }

    case 'SELECT_PRESET': {
      const { presetId, cropRes } = action.payload
      return {
        ...state,
        selectedPresetId: presetId,
        cropStates: cropRes
          ? { ...state.cropStates, [presetId]: cropRes }
          : state.cropStates,
      }
    }

    case 'UPDATE_ADJUSTMENTS': {
      const { adjustments, cropRes } = action.payload
      return {
        ...state,
        adjustments,
        cropStates: {
          ...state.cropStates,
          [state.selectedPresetId]: cropRes,
        },
      }
    }

    case 'RESET_ADJUSTMENTS': {
      const { cropRes } = action.payload
      return {
        ...state,
        adjustments: { scaleOffset: 0, offsetY: 0 },
        cropStates: {
          ...state.cropStates,
          [state.selectedPresetId]: cropRes,
        },
      }
    }

    case 'RETAKE':
      return {
        ...initialState,
        step: 1,
      }

    case 'RESET_ALL':
      return {
        ...initialState,
        step: 1,
      }

    default:
      return state
  }
}

export function WizardProvider({ children }) {
  const { t } = useLang()
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  const requestIdRef = useRef(0)
  const urlsRef = useRef([])
  const bitmapRef = useRef(null)

  const registerUrl = (url) => {
    if (url) {
      urlsRef.current.push(url)
    }
    return url
  }

  const revokeAllUrls = () => {
    urlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    })
    urlsRef.current = []
  }

  const closeBitmap = () => {
    if (bitmapRef.current) {
      try {
        bitmapRef.current.close()
      } catch {
        // ignore
      }
      bitmapRef.current = null
    }
  }

  // Preload detector only when user interacts (triggered by click or drag)
  const preloadDetector = () => {
    loadDetector()
      .then((mod) => mod.getFaceLandmarker())
      .catch((err) => {
        console.warn('Lazy detector load error:', err)
      })
  }

  // Handle browser back button (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!window.history.state || typeof window.history.state.step !== 'number') {
      window.history.replaceState({ step: 1 }, '')
    }

    const onPopState = (e) => {
      const targetStep = e.state?.step || 1
      dispatch({ type: 'POPSTATE_NAVIGATE', payload: targetStep })
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeAllUrls()
      closeBitmap()
    }
  }, [])

  const goToStep = (newStep) => {
    if (newStep === state.step) return
    if (typeof window !== 'undefined') {
      window.history.pushState({ step: newStep }, '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    dispatch({ type: 'SET_STEP', payload: newStep })
  }

  const goBack = () => {
    if (state.step > 1) {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back()
      } else {
        goToStep(state.step - 1)
      }
    }
  }

  // Handle uploaded file
  const handleFile = async (file) => {
    if (!file) return

    // Security & sanity checks on uploaded file
    if (file.size === 0) {
      dispatch({ type: 'SET_ERROR', payload: 'errRead' })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      dispatch({ type: 'SET_ERROR', payload: 'errFileTooLarge' })
      return
    }

    if (file.type && (file.type === 'image/svg+xml' || !file.type.startsWith('image/'))) {
      dispatch({ type: 'SET_ERROR', payload: 'errUnsupportedFormat' })
      return
    }

    const reqId = ++requestIdRef.current
    dispatch({ type: 'START_PROCESSING', payload: t.processingModel })

    revokeAllUrls()
    closeBitmap()

    // 1. Read raw image bitmap
    let rawBitmap = null
    try {
      rawBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        rawBitmap = await createImageBitmap(file)
      } catch {
        if (reqId !== requestIdRef.current) return
        dispatch({ type: 'SET_ERROR', payload: 'errUnsupportedFormat' })
        return
      }
    }

    if (reqId !== requestIdRef.current) {
      try {
        rawBitmap.close()
      } catch {
        // ignore
      }
      return
    }

    // 2. Downscale to 2500 px max dimension immediately, close original rawBitmap
    const maxDim = Math.max(rawBitmap.width, rawBitmap.height)
    let bitmap = rawBitmap

    if (maxDim > 2500) {
      const scale = 2500 / maxDim
      const targetW = Math.round(rawBitmap.width * scale)
      const targetH = Math.round(rawBitmap.height * scale)

      try {
        bitmap = await createImageBitmap(rawBitmap, {
          resizeWidth: targetW,
          resizeHeight: targetH,
          resizeQuality: 'high',
        })
      } catch {
        // Fallback for environments where createImageBitmap resize options throw
        const offCanvas = document.createElement('canvas')
        offCanvas.width = targetW
        offCanvas.height = targetH
        const ctx = offCanvas.getContext('2d')
        ctx.drawImage(rawBitmap, 0, 0, targetW, targetH)
        bitmap = await createImageBitmap(offCanvas)
      }

      // Close the original raw image immediately
      try {
        rawBitmap.close()
      } catch {
        // ignore
      }
    }

    if (reqId !== requestIdRef.current) {
      try {
        bitmap.close()
      } catch {
        // ignore
      }
      return
    }

    bitmapRef.current = bitmap
    const objectUrl = registerUrl(URL.createObjectURL(file))

    try {
      dispatch({ type: 'START_PROCESSING', payload: t.processingFace })

      // Load detector chunk dynamically
      const { detectFaceInBitmap } = await loadDetector()
      const det = await detectFaceInBitmap(bitmap)

      if (reqId !== requestIdRef.current) return

      if (!det.success) {
        if (det.error === 'NO_FACE') {
          dispatch({ type: 'SET_ERROR', payload: 'errNoFace' })
        } else if (det.error === 'MULTIPLE_FACES') {
          dispatch({ type: 'SET_ERROR', payload: 'errMultipleFaces' })
        } else {
          dispatch({ type: 'SET_ERROR', payload: 'errRead' })
        }
        return
      }

      // Pre-calculate crop for both presets
      const cropKz = cropFace(bitmap, det.landmarks, presets.kz_id, { scaleOffset: 0, offsetY: 0 })
      const cropDv = cropFace(bitmap, det.landmarks, presets.dv, { scaleOffset: 0, offsetY: 0 })

      if (reqId !== requestIdRef.current) return

      if (typeof window !== 'undefined') {
        window.history.pushState({ step: 2 }, '')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      dispatch({
        type: 'SET_IMAGE_SUCCESS',
        payload: {
          originalImage: {
            bitmap,
            objectUrl,
            landmarks: det.landmarks,
            blendshapes: det.blendshapes || [],
          },
          cropStates: {
            kz_id: cropKz,
            dv: cropDv,
          },
        },
      })
    } catch (err) {
      console.error(err)
      if (reqId !== requestIdRef.current) return
      dispatch({ type: 'SET_ERROR', payload: 'errRead' })
    }
  }

  // Select a preset (kz_id or dv)
  const selectPreset = (presetId) => {
    if (!presets[presetId]) return

    let cropRes = state.cropStates[presetId]
    if (state.originalImage?.bitmap && state.originalImage?.landmarks) {
      cropRes = cropFace(
        state.originalImage.bitmap,
        state.originalImage.landmarks,
        presets[presetId],
        state.adjustments
      )
    }

    dispatch({
      type: 'SELECT_PRESET',
      payload: { presetId, cropRes },
    })
  }

  // Update scale or vertical offset
  const updateAdjustments = (newValues) => {
    const merged = { ...state.adjustments, ...newValues }
    let cropRes = null

    if (state.originalImage?.bitmap && state.originalImage?.landmarks) {
      cropRes = cropFace(
        state.originalImage.bitmap,
        state.originalImage.landmarks,
        presets[state.selectedPresetId],
        merged
      )
    }

    dispatch({
      type: 'UPDATE_ADJUSTMENTS',
      payload: { adjustments: merged, cropRes },
    })
  }

  // Reset adjustments to 0
  const resetAdjustments = () => {
    let cropRes = null
    if (state.originalImage?.bitmap && state.originalImage?.landmarks) {
      cropRes = cropFace(
        state.originalImage.bitmap,
        state.originalImage.landmarks,
        presets[state.selectedPresetId],
        { scaleOffset: 0, offsetY: 0 }
      )
    }

    dispatch({
      type: 'RESET_ADJUSTMENTS',
      payload: { cropRes },
    })
  }

  // Retake / New photo
  const retake = () => {
    requestIdRef.current++
    revokeAllUrls()
    closeBitmap()
    if (typeof window !== 'undefined') {
      window.history.pushState({ step: 1 }, '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    dispatch({ type: 'RETAKE' })
  }

  const resetAll = () => {
    retake()
  }

  const selectedPreset = presets[state.selectedPresetId] || presets.kz_id
  const activeCropState = state.cropStates[state.selectedPresetId] || null

  return (
    <WizardContext.Provider
      value={{
        ...state,
        selectedPreset,
        activeCropState,
        handleFile,
        preloadDetector,
        goToStep,
        goBack,
        selectPreset,
        updateAdjustments,
        resetAdjustments,
        retake,
        resetAll,
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const context = useContext(WizardContext)
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
