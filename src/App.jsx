import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react'
import { useLang } from './contexts/LangContext'
import { photoCopy } from './content/photo-copy'
import { presets } from './presets'
import { decodePhoto, identifyPhoto, photoFileError, supportsWasmSimd } from './lib/photo'
import { changePhotoDocument, initialPhotoFlow, photoFlow, releasePhoto } from './lib/photo-flow'
import { isPhotoPath } from './lib/routes'
import Footer from './components/Footer'
import CameraCapture from './components/CameraCapture'
import PhotoUpload from './components/photo/PhotoUpload'
import PhotoSettings, { photoMessage } from './components/photo/PhotoSettings'

const PhotoResult = lazy(() => import('./components/photo/PhotoResult.jsx'))

function writeHistory(method, photoResult) {
  if (isPhotoPath(window.location.pathname)) window.history[method]({ ...window.history.state, photoResult }, '')
}

export default function App({ active, doc = 'kz_id', onDocument }) {
  const { lang, t } = useLang()
  const copy = photoCopy[lang]
  const [state, dispatch] = useReducer(photoFlow, undefined, () => initialPhotoFlow(doc))
  const [chooseDocument, setChooseDocument] = useState(false)
  const [camera, setCamera] = useState(false)
  const [simd] = useState(supportsWasmSimd)
  const heading = useRef(null)
  const picker = useRef(null)
  const returning = useRef(null)
  const cameraTrigger = useRef(null)
  const source = useRef(null)
  const result = useRef(null)
  const token = useRef(0)
  const loading = useRef(false)
  const lastScreen = useRef('upload')
  const set = settings => dispatch({ type: 'settings', settings })
  const selectDocument = id => {
    set(changePhotoDocument(state.settings, id))
    onDocument?.(id)
  }
  const showResult = state.screen === 'result' && state.result && state.source

  useEffect(() => {
    writeHistory('replaceState', null)
    function onPopState(event) {
      if (!isPhotoPath(window.location.pathname)) return
      if (!loading.current) token.current++
      setCamera(false)
      dispatch({ type: 'history', result: Boolean(result.current && event.state?.photoResult === result.current.sourceId) })
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      token.current++
      loading.current = false
      releasePhoto(source.current)
      source.current = null
      result.current = null
    }
  }, [])

  useEffect(() => {
    // Back/forward or a direct link changed the document in the URL.
    if (doc !== state.settings.presetId) dispatch({ type: 'settings', settings: changePhotoDocument(state.settings, doc) })
  }, [doc]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) {
      setCamera(false)
      return
    }
    if (lastScreen.current === state.screen) return
    lastScreen.current = state.screen
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [active, state.screen])

  async function selectFile(file, trigger) {
    if (!file) return
    if (trigger) returning.current = trigger
    setChooseDocument(false)
    const id = ++token.current
    loading.current = true
    dispatch({ type: 'load' })
    let bitmap
    function fail(error) {
      if (id === token.current) dispatch({ type: 'error', error })
    }
    try {
      const error = photoFileError(file)
      if (error) return fail(error)
      const mime = await identifyPhoto(file)
      if (id !== token.current) return
      if (mime === 'image/heic') return fail('errHeic')
      if (!mime) return fail(file.type ? 'errRead' : 'errUnsupportedFormat')
      if (simd) import('./lib/detector.js').then(({ prepareFaceDetector }) => prepareFaceDetector()).catch(() => {})
      bitmap = await decodePhoto(file, mime)
      if (id !== token.current) return
      const next = { id: crypto.randomUUID(), bitmap }
      releasePhoto(source.current)
      source.current = next
      result.current = null
      if (window.history.state?.photoResult) writeHistory('replaceState', null)
      bitmap = null
      dispatch({ type: 'loaded', source: next })
    } catch {
      fail('errRead')
    } finally {
      if (id === token.current) loading.current = false
      bitmap?.close()
    }
  }

  function closeSettings() {
    if (!loading.current) token.current++
    dispatch({ type: 'close' })
  }

  function openSettings(trigger, documentFirst = false) {
    returning.current = trigger
    setChooseDocument(documentFirst)
    if (result.current) set(result.current.settings)
    dispatch({ type: 'open' })
  }

  async function processPhoto(settings) {
    const photo = source.current
    if (!photo || state.status) return
    if (!simd) {
      dispatch({ type: 'error', error: 'browserRequiresSimd' })
      return
    }
    const id = ++token.current
    const cancelled = () => id !== token.current
    const progress = status => { if (!cancelled()) dispatch({ type: 'progress', status }) }
    dispatch({ type: 'process', settings })
    try {
      const { runPhotoPipeline } = await import('./lib/photo-pipeline.js')
      if (cancelled()) return
      const work = (photo.work ?? Promise.resolve()).catch(() => {})
        .then(() => runPhotoPipeline(photo, settings, progress, cancelled))
      photo.work = work
      const next = await work
      if (cancelled()) return
      result.current = next
      writeHistory(window.history.state?.photoResult === photo.id ? 'replaceState' : 'pushState', photo.id)
      dispatch({ type: 'result', result: next })
    } catch (error) {
      if (!cancelled()) {
        dispatch({ type: 'error', error: error.message })
      }
    }
  }

  function reset() {
    token.current++
    loading.current = false
    releasePhoto(source.current)
    source.current = null
    result.current = null
    writeHistory('replaceState', null)
    dispatch({ type: 'reset' })
  }

  function closeCamera() {
    setCamera(false)
    cameraTrigger.current?.focus()
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <main id="wizard-main" tabIndex={-1} className="grow">
        {showResult ? (
          <Suspense fallback={<p role="status" className="p-8 text-center">{copy.starting}</p>}>
            <PhotoResult result={state.result} source={state.source} heading={heading} onSettings={openSettings}
              onProcess={processPhoto} onReset={reset} status={state.status} />
          </Suspense>
        ) : (
          <PhotoUpload presetId={state.settings.presetId} onDocument={selectDocument} onFile={selectFile}
            onCamera={trigger => { cameraTrigger.current = trigger; setCamera(true) }} cameraAvailable={Boolean(navigator.mediaDevices?.getUserMedia)}
            heading={heading} picker={picker} />
        )}
        {!state.dialog && (
          <p role="status" aria-live="polite" className={state.status ? 'mx-auto mb-4 max-w-5xl px-4 text-sm font-medium text-emerald-accent' : 'sr-only'}>
            {photoMessage(t, copy, state.status, presets[state.settings.presetId])}
          </p>
        )}
        {active && state.dialog && (
          <PhotoSettings source={state.source} settings={state.settings} status={state.status} error={state.error}
            chooseDocument={chooseDocument} onDocument={selectDocument} onSettings={set} onFile={selectFile}
            onProcess={processPhoto} onClose={closeSettings} returnFocus={returning} />
        )}
        {active && camera && (
          <CameraCapture mode={state.settings.presetId} onClose={closeCamera} onSelectFile={() => { closeCamera(); picker.current?.click() }}
            onCapture={file => { setCamera(false); selectFile(file, cameraTrigger.current) }} />
        )}
      </main>
      <Footer />
    </div>
  )
}
