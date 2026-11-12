import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { presets, presetList } from '../presets'
import { steps } from '../steps'
import { cropFace } from '../lib/crop'
import { decodePhoto, photoMimeTypes, identifyPhoto } from '../lib/photo'
import {
  changeEditHistory, createEditHistory, hasClosedArea, hasPhotoEdits, initialEdit,
  recommendedBackground, redoEdit, undoEdit,
} from '../lib/editor/edit-state'

const WizardContext = createContext(null)
const defaultAdjustments = { scaleOffset: 0, offsetY: 0 }
const idleSegmentation = { status: 'idle', result: null }
const emptyWizard = {
  step: steps.PHOTO,
  originalImage: null,
  selectedPresetId: 'kz_id',
  cropStates: {},
  adjustments: defaultAdjustments,
  statusKey: null,
  errorKey: null,
  editHistory: createEditHistory(),
  appliedEdit: initialEdit,
  editorCompleted: false,
  editorBusy: false,
  editorError: null,
  outlineDraft: null,
  segmentation: idleSegmentation,
}

const faceErrors = { NO_FACE: 'errNoFace', MULTIPLE_FACES: 'errMultipleFaces', SMALL_FACE: 'errSmallFace' }

function writeStep(method, step, photoId, previousStep) {
  window.history[method]({
    ...window.history.state,
    photoWizard: { step, photoId, previousStep },
  }, '')
}

function prepareCrops(source, landmarks, adjustments, backgroundMatte) {
  return Object.fromEntries(
    presetList.map((preset) => [preset.id, cropFace(source, landmarks, preset, adjustments, backgroundMatte)])
  )
}

function createMatteCanvas(matte) {
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

function releasePhoto(source) {
  if (!source) return
  source.session?.then((session) => session.close()).catch(() => {})
  source.editedBitmap?.close()
  if (source.backgroundMatte) source.backgroundMatte.width = 0
  source.bitmap.close()
}

export function WizardProvider({ children }) {
  const [state, setState] = useState(emptyWizard)
  const request = useRef(0)
  const photo = useRef(null)

  const getEditorSession = useCallback(() => {
    const source = photo.current
    if (!source) return Promise.reject(new Error('EDITOR_CLOSED'))
    source.session ??= import('../lib/editor/session').then(({ createEditorSession }) => {
      if (photo.current !== source) throw new Error('EDITOR_CLOSED')
      return createEditorSession(source.bitmap, source.landmarks)
    })
    return source.session
  }, [])

  const ensureSegmentation = useCallback(() => {
    const source = photo.current
    if (!source) return
    source.segmentationRequest ??= (async () => {
      setState((current) => ({ ...current, segmentation: { status: 'loading', result: null } }))
      try {
        const session = await getEditorSession()
        const result = await session.segment()
        if (photo.current === source) {
          setState((current) => ({ ...current, segmentation: { status: 'ready', result } }))
        }
      } catch {
        source.segmentationRequest = null
        if (photo.current === source) {
          setState((current) => ({ ...current, segmentation: { status: 'error', result: null } }))
        }
      }
    })()
    return source.segmentationRequest
  }, [getEditorSession])

  useEffect(() => {
    const oldRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    writeStep('replaceState', steps.PHOTO)

    const onPopState = (event) => {
      request.current++
      const entry = event.state?.photoWizard
      const target = photo.current && entry?.photoId === photo.current.id ? entry.step : steps.PHOTO
      if (target === steps.PHOTO && entry?.step !== steps.PHOTO) writeStep('replaceState', steps.PHOTO)
      setState((current) => {
        let step = target
        if (target > steps.EDITOR && !current.editorCompleted) step = steps.EDITOR
        if (target === steps.DONE && !current.cropStates[current.selectedPresetId]?.success) step = steps.CHECK
        return { ...current, step, statusKey: null, errorKey: null, editorBusy: false, editorError: null }
      })
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.history.scrollRestoration = oldRestoration
      request.current++
      const source = photo.current
      photo.current = null
      releasePhoto(source)
    }
  }, [])

  const goToStep = (step) => {
    if (step === state.step || (step > steps.PHOTO && !photo.current) ||
        (step > steps.EDITOR && !state.editorCompleted)) return
    request.current++
    writeStep('pushState', step, photo.current?.id, state.step)
    setState((current) => ({ ...current, step, statusKey: null, errorKey: null, editorBusy: false, editorError: null }))
  }

  const goBack = () => {
    const previousStep = state.step - 1
    if (window.history.state?.photoWizard?.previousStep === previousStep) {
      request.current++
      window.history.back()
    } else {
      goToStep(previousStep)
    }
  }

  const handleFile = async (file) => {
    if (!file) return
    const id = ++request.current
    const fail = (errorKey) => {
      if (id === request.current) setState((current) => ({ ...current, statusKey: null, errorKey }))
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
      const cropStates = prepareCrops(bitmap, landmarks, defaultAdjustments)
      const originalImage = { bitmap, landmarks, blendshapes, id: crypto.randomUUID() }

      writeStep('pushState', steps.EDITOR, originalImage.id, steps.PHOTO)
      const previous = photo.current
      photo.current = originalImage
      releasePhoto(previous)
      bitmap = null
      setState({ ...emptyWizard, step: steps.EDITOR, originalImage, cropStates })
    } catch {
      fail('errRead')
    } finally {
      bitmap?.close()
    }
  }

  const edit = state.editHistory.present
  const mask = state.segmentation.result
  const usableBackground = !edit.bg.enabled || (edit.bg.method === 'manual'
    ? hasClosedArea(edit.bg.outline)
    : mask?.reliable)
  const canApplyEditor = !state.editorBusy && !state.outlineDraft && edit.filter !== 'mono' && usableBackground &&
    (!edit.suit.enabled || mask?.suitSupported)

  const changeEditorHistory = (update) => setState((current) => ({
    ...current,
    editorError: null,
    editHistory: update(current.editHistory),
  }))
  const updateEditor = (update, group) => changeEditorHistory((history) => changeEditHistory(history, update, group))

  const applyEdit = async (nextEdit, advance) => {
    const source = photo.current
    if (!source || state.editorBusy) return
    const id = ++request.current
    setState((current) => ({ ...current, editorBusy: true, editorError: null }))
    let bitmap
    let matte
    try {
      if (hasPhotoEdits(nextEdit)) {
        const session = await getEditorSession()
        if (id !== request.current) return
        const rendered = await session.render({ edit: nextEdit, preview: false, showMask: false })
        bitmap = rendered.bitmap
        matte = rendered.matte
      }
      if (id !== request.current) return

      const backgroundMatte = createMatteCanvas(matte)
      const cropStates = prepareCrops(bitmap || source.bitmap, source.landmarks, state.adjustments, backgroundMatte)
      if (advance) writeStep('pushState', steps.DOCUMENT, source.id, steps.EDITOR)
      source.editedBitmap?.close()
      if (source.backgroundMatte) source.backgroundMatte.width = 0
      source.editedBitmap = bitmap
      source.backgroundMatte = backgroundMatte
      bitmap = null
      setState((current) => ({
        ...current,
        step: advance ? steps.DOCUMENT : current.step,
        cropStates,
        appliedEdit: nextEdit,
        editorCompleted: true,
        editorBusy: false,
        editHistory: advance ? current.editHistory : changeEditHistory(current.editHistory, (draft) => ({
          ...draft, bg: { ...draft.bg, color: nextEdit.bg.color },
        })),
      }))
    } catch {
      if (id === request.current) {
        setState((current) => ({ ...current, editorBusy: false, editorError: 'processingError' }))
      }
    } finally {
      bitmap?.close()
    }
  }

  const selectPreset = (presetId) => {
    setState((current) => ({ ...current, selectedPresetId: presetId }))
  }

  const setAdjustments = (changes) => {
    const source = photo.current
    if (!source) return
    const adjustments = { ...state.adjustments, ...changes }
    const cropStates = prepareCrops(source.editedBitmap || source.bitmap, source.landmarks, adjustments, source.backgroundMatte)
    setState((current) => ({ ...current, adjustments, cropStates }))
  }

  const retake = () => {
    request.current++
    const source = photo.current
    photo.current = null
    releasePhoto(source)
    writeStep('pushState', steps.PHOTO)
    setState(emptyWizard)
  }

  return (
    <WizardContext.Provider value={{
      ...state,
      edit,
      canApplyEditor,
      getEditorSession,
      ensureSegmentation,
      updateEditor,
      setOutlineDraft: (update) => setState((current) => ({
        ...current,
        outlineDraft: typeof update === 'function' ? update(current.outlineDraft) : update,
      })),
      undoEditor: () => changeEditorHistory(undoEdit),
      redoEditor: () => changeEditorHistory(redoEdit),
      resetEditor: () => updateEditor(initialEdit),
      finishEditor: (skip = false) => {
        if (skip || canApplyEditor) return applyEdit(skip ? initialEdit : edit, true)
      },
      suggestBackground: () => {
        if (!state.appliedEdit.bg.enabled) return
        const bg = { ...state.appliedEdit.bg, color: recommendedBackground[state.selectedPresetId] }
        return applyEdit({ ...state.appliedEdit, bg }, false)
      },
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
