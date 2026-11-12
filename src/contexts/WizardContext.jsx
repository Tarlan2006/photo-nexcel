import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { presets, presetList } from '../presets'
import { cropFace } from '../lib/crop'
import { decodePhoto, photoMimeTypes, identifyPhoto } from '../lib/photo'

const WizardContext = createContext(null)
const defaultAdjustments = { scaleOffset: 0, offsetY: 0 }
const emptyWizard = {
  step: 1,
  originalImage: null,
  selectedPresetId: 'kz_id',
  cropStates: {},
  adjustments: defaultAdjustments,
  statusKey: null,
  errorKey: null,
}

const faceErrors = { NO_FACE: 'errNoFace', MULTIPLE_FACES: 'errMultipleFaces', SMALL_FACE: 'errSmallFace' }

function writeStep(method, step, photoId, previousStep) {
  window.history[method]({
    ...window.history.state,
    photoWizard: { step, photoId, previousStep },
  }, '')
}

export function WizardProvider({ children }) {
  const [state, setState] = useState(emptyWizard)
  const request = useRef(0)
  const photo = useRef(null)

  useEffect(() => {
    const oldRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    writeStep('replaceState', 1)

    const onPopState = (event) => {
      request.current++
      const entry = event.state?.photoWizard
      const step = photo.current && entry?.photoId === photo.current.id ? entry.step : 1
      if (step === 1 && entry?.step !== 1) writeStep('replaceState', 1)
      setState((current) => ({
        ...current,
        step: step === 4 && !current.cropStates[current.selectedPresetId]?.success ? 3 : step,
        statusKey: null,
        errorKey: null,
      }))
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.history.scrollRestoration = oldRestoration
      request.current++
      photo.current?.bitmap.close()
      photo.current = null
    }
  }, [])

  const goToStep = (step) => {
    if (step === state.step || (step > 1 && !photo.current)) return
    request.current++
    writeStep('pushState', step, photo.current?.id, state.step)
    setState((current) => ({ ...current, step, statusKey: null, errorKey: null }))
  }

  const goBack = () => {
    const previousStep = state.step - 1
    if (window.history.state?.photoWizard?.previousStep === previousStep) {
      window.history.back()
    } else {
      goToStep(previousStep)
    }
  }

  const handleFile = async (file) => {
    if (!file) return
    const id = ++request.current
    const fail = (errorKey) => {
      if (id === request.current) {
        setState((current) => ({ ...current, statusKey: null, errorKey }))
      }
    }

    if (!file.size) return fail('errRead')
    if (file.size > 50 * 1024 * 1024) return fail('errUploadTooLarge')
    if (file.type && !photoMimeTypes.includes(file.type)) return fail('errUnsupportedFormat')

    setState((current) => ({ ...current, statusKey: 'processingModel', errorKey: null }))
    let bitmap
    try {
      const mimeType = await identifyPhoto(file)
      if (id !== request.current) return
      if (!mimeType) return fail(file.type ? 'errRead' : 'errUnsupportedFormat')

      bitmap = await decodePhoto(file, mimeType)
      if (id !== request.current) return

      setState((current) => ({ ...current, statusKey: 'processingFace' }))
      const { detectFaceInBitmap } = await import('../lib/detector')
      const detection = await detectFaceInBitmap(bitmap, () => id !== request.current)
      if (id !== request.current) return
      if (!detection.success) return fail(faceErrors[detection.error] || 'errRead')

      const { landmarks, blendshapes } = detection
      const cropStates = Object.fromEntries(
        presetList.map((preset) => [preset.id, cropFace(bitmap, landmarks, preset, defaultAdjustments)])
      )
      const originalImage = { bitmap, landmarks, blendshapes, id: crypto.randomUUID() }

      writeStep('pushState', 2, originalImage.id, 1)
      photo.current?.bitmap.close()
      photo.current = originalImage
      bitmap = null
      setState({ ...emptyWizard, step: 2, originalImage, cropStates })
    } catch {
      fail('errRead')
    } finally {
      bitmap?.close()
    }
  }

  const selectPreset = (presetId) => {
    setState((current) => ({ ...current, selectedPresetId: presetId }))
  }

  const setAdjustments = (changes) => {
    const { bitmap, landmarks } = photo.current
    const adjustments = { ...state.adjustments, ...changes }
    const cropStates = Object.fromEntries(
      presetList.map((preset) => [preset.id, cropFace(bitmap, landmarks, preset, adjustments)])
    )
    setState((current) => ({ ...current, adjustments, cropStates }))
  }

  const retake = () => {
    request.current++
    photo.current?.bitmap.close()
    photo.current = null
    writeStep('pushState', 1)
    setState(emptyWizard)
  }

  return (
    <WizardContext.Provider value={{
      ...state,
      isProcessing: Boolean(state.statusKey),
      selectedPreset: presets[state.selectedPresetId],
      activeCropState: state.cropStates[state.selectedPresetId],
      handleFile,
      goToStep,
      goBack,
      selectPreset,
      updateAdjustments: setAdjustments,
      resetAdjustments: () => setAdjustments(defaultAdjustments),
      retake,
    }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  return useContext(WizardContext)
}
