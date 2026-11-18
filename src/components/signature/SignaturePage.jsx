import { useEffect, useMemo, useRef, useState } from 'react'
import CameraCapture from '../CameraCapture'
import Footer from '../Footer'
import { useLang } from '../../contexts/LangContext'
import { identifyPhoto, photoFileError, photoMimeTypes } from '../../lib/photo'
import { fullPaper, signatureDefaults } from '../../lib/signature'
import { signatureOutputBounds } from '../../lib/signature-crop'
import { centerSignatureFrame } from '../../lib/signature-frame'
import { egovSignature } from '../../presets'
import { signatureCopy } from './copy'
import { BrushCanvas, PaperCrop, SignatureCanvas } from './SignatureImages'
import SignatureFraming from './SignatureFraming'
import SignatureRules, { SignatureChecks } from './SignatureRules'
import './signature.css'

const defaultDraft = { crop: fullPaper, square: false, options: signatureDefaults, strokes: [] }
const colors = ['original', 'black', 'blue']
const backgrounds = ['checker', 'white', 'gray', 'dark']
const errorLabels = { NO_INK: 'noInk', TOO_DARK: 'dark', PROCESSING_FAILED: 'processingError' }
const ranges = [
  ['sensitivity', 0, 100], ['cleanup', 0, 100], ['thickness', -2, 2], ['smoothing', 0, 100],
]

function createWorker() {
  const worker = new Worker(new URL('../../lib/signature-worker.js', import.meta.url), { type: 'module' })
  const pending = new Map()
  let sequence = 0
  let closed = false
  function fail() {
    if (closed) return
    closed = true
    worker.terminate()
    for (const { reject } of pending.values()) reject(new Error('PROCESSING_FAILED'))
    pending.clear()
  }
  worker.onmessage = ({ data: { id, result, error } }) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    if (error) entry.reject(new Error(error))
    else entry.resolve(result)
  }
  worker.onerror = event => { event.preventDefault(); fail() }
  return {
    run(action, payload) {
      if (closed) return Promise.reject(new Error('PROCESSING_FAILED'))
      const id = ++sequence
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        try {
          worker.postMessage({ id, action, ...payload })
        } catch (error) {
          pending.delete(id)
          reject(error)
        }
      })
    },
    close: fail,
  }
}

function Upload({ copy, busy, onFile }) {
  const input = useRef(null)
  const cameraButton = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [camera, setCamera] = useState(false)
  function closeCamera() {
    setCamera(false)
    cameraButton.current?.focus()
  }
  return (
    <div className="signature-upload">
      <div className={`signature-drop${dragging ? ' signature-dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          if (!busy) onFile(event.dataTransfer.files[0])
        }}>
        <svg aria-hidden="true" className="mx-auto mb-4 size-8 text-emerald-accent" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <input ref={input} type="file" hidden disabled={busy} aria-label={copy.upload} accept={photoMimeTypes.join(',')}
          onChange={event => { onFile(event.target.files[0]); event.target.value = '' }} />
        <div className="signature-actions justify-center">
          <button type="button" className="signature-button signature-primary" disabled={busy} onClick={() => input.current.click()}>
            {copy.upload}
          </button>
          {navigator.mediaDevices?.getUserMedia && (
            <button ref={cameraButton} type="button" className="signature-button" disabled={busy} onClick={() => setCamera(true)}>
              {copy.camera}
            </button>
          )}
        </div>
        <p className="signature-help mt-3">{copy.drop}</p>
        <p className="signature-help mt-1">{copy.formats}</p>
      </div>
      <section className="signature-card">
        <h2>{copy.tips}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-muted">
          {copy.tipsList.map(tip => <li key={tip}>{tip}</li>)}
        </ul>
        <p className="mt-4 border-t border-grid-border pt-4 text-sm leading-relaxed text-text-main">{copy.legal}</p>
      </section>
      {camera && (
        <CameraCapture mode="signature" signatureGuideCopy={copy} onClose={closeCamera}
          onCapture={file => { setCamera(false); onFile(file) }}
          onSelectFile={() => { closeCamera(); input.current.click() }} />
      )}
    </div>
  )
}

function Edit({ copy, photo, draft, setDraft, preview, busy, finish, restart, frame, setFrame }) {
  const [background, setBackground] = useState('checker')
  const [before, setBefore] = useState(false)
  const [brush, setBrush] = useState(null)
  const options = draft.options
  const change = (key, value) => setDraft(current => ({ ...current, options: { ...current.options, [key]: value } }))
  const reset = () => {
    setBefore(false)
    setBrush(null)
    setBackground('checker')
    setDraft(defaultDraft)
    setFrame(null)
  }

  return (
    <>
      <SignatureFraming photo={photo} region={preview?.region} frame={frame} onChange={setFrame} copy={copy} />
      <div className="signature-grid">
        <PaperCrop photo={photo} crop={draft.crop} square={draft.square} copy={copy}
          onCrop={(crop, square) => setDraft(current => current.crop === crop && current.square === square
            ? current : { ...current, crop, square })} />
        <section className="signature-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>{copy.preview}</h2>
            <button type="button" className="signature-button" disabled={!preview && !before} aria-pressed={before}
              onClick={() => setBefore(!before)}>{copy.compare}</button>
          </div>
          <div className={`signature-well signature-bg-${before ? 'white' : background}`}>
            {before ? (
              <SignatureCanvas image={photo} label={copy.original} />
            ) : preview && (
              <BrushCanvas image={preview} copy={copy} mode={busy ? null : brush}
                onStroke={stroke => setDraft(current => ({ ...current, strokes: [...current.strokes, stroke] }))} />
            )}
          </div>
          <div role="group" aria-label={copy.previewBackground} className="signature-actions mt-3">
            {backgrounds.map((name, i) => (
              <button key={name} type="button" className="signature-button" aria-pressed={background === name}
                onClick={() => { setBefore(false); setBackground(name) }}>{copy.backgrounds[i]}</button>
            ))}
          </div>
          <div role="group" aria-label={copy.brushTools} className="signature-actions mt-2">
            {['erase', 'restore'].map(mode => (
              <button key={mode} type="button" className="signature-button" aria-pressed={brush === mode}
                disabled={!preview || before} onClick={() => setBrush(brush === mode ? null : mode)}>{copy[mode]}</button>
            ))}
          </div>
          <p id="signature-brush-hint" className="signature-help mt-2" hidden={!brush || before}>{copy.brushHint}</p>
        </section>
      </div>
      <section className="signature-card">
        <h2>{copy.settings}</h2>
        <div className="signature-options">
          {ranges.map(([name, min, max]) => (
            <label key={name} className="signature-field">
              <span>{copy[name]} <span aria-hidden="true" className="float-right text-text-muted">
                {options[name]} {name === 'thickness' ? copy.px : '%'}
              </span></span>
              <input type="range" min={min} max={max} value={options[name]} onChange={event => change(name, event.target.valueAsNumber)} />
            </label>
          ))}
          <div className="signature-field">
            <label htmlFor="signature-color">{copy.color}</label>
            <select id="signature-color" value={options.color} onChange={event => change('color', event.target.value)}>
              {colors.map((color, i) => <option key={color} value={color}>{copy.colors[i]}</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold">
            <input type="checkbox" checked={options.lines} onChange={event => change('lines', event.target.checked)} />
            {copy.lines}
          </label>
        </div>
      </section>
      <div className="signature-actions signature-controls">
        <button type="button" className="signature-button" onClick={restart}>{copy.new}</button>
        <button type="button" className="signature-button" onClick={reset}>{copy.reset}</button>
        <button type="button" className="signature-button signature-primary" disabled={busy || !preview} onClick={finish}>{copy.finish}</button>
      </div>
    </>
  )
}

function Downloads({ copy, result, maxKb, locale }) {
  const [urls, setUrls] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write &&
    (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'))
  useEffect(() => {
    const transparent = URL.createObjectURL(result.transparent)
    const white = URL.createObjectURL(result.white)
    setUrls({ transparent, white })
    setCopyStatus('')
    return () => { URL.revokeObjectURL(transparent); URL.revokeObjectURL(white) }
  }, [result])
  async function copyPng() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.transparent })])
      setCopyStatus(copy.copied)
    } catch {
      setCopyStatus(copy.copyFailed)
    }
  }
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  return (
    <>
      <div className="signature-output-preview">
        {urls && <img src={urls.transparent} alt={copy.result} className="signature-canvas signature-bg-checker"
          style={{ '--signature-aspect': result.width / result.height }} />}
      </div>
      <p className="signature-help mt-2">{copy.size.replace('{width}', result.width).replace('{height}', result.height)}</p>
      {result.exceedsLimit && <p role="alert" className="signature-alert">{copy.tooLarge.replace('{limit}', maxKb)}</p>}
      {urls && (
        <div className="signature-downloads">
          <a className="signature-button signature-primary" download="signature.png" href={urls.transparent}>
            {copy.download} · {format.format(result.transparent.size / 1000)} {copy.kb}
          </a>
          <a className="signature-button" download="signature-white.png" href={urls.white}>
            {copy.downloadWhite} · {format.format(result.white.size / 1000)} {copy.kb}
          </a>
          {canCopy && <button type="button" className="signature-button" onClick={copyPng}>{copy.copy}</button>}
        </div>
      )}
      <p role="status" className="signature-help">{copyStatus}</p>
    </>
  )
}

function EgovDownload({ copy, result }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const href = URL.createObjectURL(result.jpeg)
    setUrl({ blob: result.jpeg, href })
    return () => URL.revokeObjectURL(href)
  }, [result.jpeg])
  const href = url?.blob === result.jpeg ? url.href : null

  return (
    <>
      <div className="signature-output-preview">
        {href && <img src={href} alt={copy.egovResult} className="signature-canvas signature-bg-white"
          style={{ '--signature-aspect': result.width / result.height }} />}
      </div>
      <p className="signature-help mt-2">{copy.size.replace('{width}', result.width).replace('{height}', result.height)}</p>
      {result.tooSmall && <p role="status" className="signature-alert">{copy.lowResolution}</p>}
      {href && result.checks?.content !== 'fail' && (
        <div className="signature-downloads">
          <a className="signature-button signature-primary" download="signature-egov.jpg" href={href}>{copy.downloadEgov}</a>
        </div>
      )}
    </>
  )
}

function ResultCrop({ copy, image, crop, onApply, onCancel }) {
  const [frame, setFrame] = useState(crop)
  const [square, setSquare] = useState(false)
  const size = signatureOutputBounds(image, frame)
  return (
    <PaperCrop photo={image} crop={frame} square={square} copy={copy} output
      onCrop={(next, isSquare) => { setFrame(next); setSquare(isSquare) }}>
      <p className="signature-help mt-2">{copy.size.replace('{width}', size.width).replace('{height}', size.height)}</p>
      <div className="signature-actions mt-3">
        <button type="button" className="signature-button signature-primary" onClick={() => onApply(frame)}>{copy.applyCrop}</button>
        <button type="button" className="signature-button" onClick={onCancel}>{copy.cancelCrop}</button>
      </div>
    </PaperCrop>
  )
}

export default function SignaturePage() {
  const { lang, t } = useLang()
  const copy = signatureCopy[lang]
  const heading = useRef(null)
  const worker = useRef(null)
  const generation = useRef(0)
  const exportSource = useRef(null)
  const cropButton = useRef(null)
  const [step, setStep] = useState(1)
  const [photo, setPhoto] = useState(null)
  const [draft, setDraft] = useState(defaultDraft)
  const [load, setLoad] = useState({ busy: false, error: null })
  const [preview, setPreview] = useState(null)
  const [framing, setFraming] = useState(null)
  const [removeFrame, setRemoveFrame] = useState(false)
  const [finished, setFinished] = useState(null)
  const [exportImage, setExportImage] = useState(null)
  const [outputCrop, setOutputCrop] = useState(fullPaper)
  const [cropping, setCropping] = useState(false)
  const [format, setFormat] = useState('png')
  const [fixedWidth, setFixedWidth] = useState(0)
  const [customWidth, setCustomWidth] = useState('600')
  const [limit, setLimit] = useState('0')
  const [custom, setCustom] = useState('50')
  const maxKb = Number(limit === 'custom' ? custom : limit)
  const egov = format === 'egov'
  const frame = useMemo(() => framing ?? (photo ? centerSignatureFrame(photo, preview?.result?.region) : null), [framing, photo, preview?.result])
  const cropSize = exportImage && signatureOutputBounds(exportImage, outputCrop)
  const customHeight = cropSize && customWidth !== '' ? Math.max(1, Math.round(Number(customWidth) * cropSize.height / cropSize.width)) : ''
  const exactSize = fixedWidth === 'custom'
  const width = exactSize ? Number(customWidth) : fixedWidth
  const invalidSize = !egov && exactSize && (!Number.isInteger(width) || width < 1 || width > 4096 || customHeight > 4096)
  const invalidLimit = !egov && limit === 'custom' && (!Number.isInteger(maxKb) || maxKb < 1 || maxKb > 50000)
  const invalidOutput = invalidLimit || invalidSize
  const egovOutput = useMemo(() => ({ format: 'egov', frame, removeFrame }), [frame, removeFrame])
  const pngOutput = useMemo(() => ({ format: 'png', crop: outputCrop, width, maxKb, exactSize }), [outputCrop, width, maxKb, exactSize])
  const output = egov ? egovOutput : pngOutput
  const hasCurrentExport = finished?.draft === draft && finished?.output === output && Boolean(finished.result)

  useEffect(() => () => {
    generation.current++
    worker.current?.close()
    worker.current = null
  }, [])

  useEffect(() => {
    if (!photo || step !== 2) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const result = await worker.current.run('preview', draft)
        if (active) setPreview({ draft, result })
      } catch (error) {
        if (active) setPreview({ draft, error: errorLabels[error.message] ?? 'processingError' })
      }
    }, 50)
    return () => { active = false; clearTimeout(timer) }
  }, [photo, draft, step])

  useEffect(() => {
    if (step !== 3 || invalidOutput || hasCurrentExport) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        if (exportSource.current?.draft !== draft) {
          const image = await worker.current.run('result', draft)
          if (!active) return
          exportSource.current = { draft, image }
          setExportImage(image)
        }
        const result = await worker.current.run('export', { ...draft, output })
        if (active) setFinished({ draft, output, result })
      } catch (error) {
        if (active) setFinished({ draft, output, error: errorLabels[error.message] ?? 'processingError' })
      }
    }, 50)
    return () => { active = false; clearTimeout(timer) }
  }, [draft, output, step, invalidOutput, hasCurrentExport])

  const go = next => {
    setStep(next)
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }
  function restart() {
    generation.current++
    worker.current?.close()
    worker.current = null
    setPhoto(null)
    setDraft(defaultDraft)
    setPreview(null)
    setFraming(null)
    setRemoveFrame(false)
    setFinished(null)
    exportSource.current = null
    setExportImage(null)
    setOutputCrop(fullPaper)
    setCropping(false)
    setLoad({ busy: false, error: null })
    setFormat('png')
    setFixedWidth(0)
    setCustomWidth('600')
    setLimit('0')
    setCustom('50')
    go(1)
  }
  async function handleFile(file) {
    if (!file || load.busy) return
    const id = ++generation.current
    const current = () => id === generation.current
    const error = photoFileError(file)
    if (error) {
      setLoad({ busy: false, error })
      return
    }
    setLoad({ busy: true, error: null })
    try {
      const mimeType = await identifyPhoto(file)
      if (!current()) return
      if (mimeType === 'image/heic') {
        setLoad({ busy: false, error: 'errHeic' })
        return
      }
      if (!mimeType) {
        setLoad({ busy: false, error: file.type ? 'errRead' : 'errUnsupportedFormat' })
        return
      }
      worker.current?.close()
      worker.current = createWorker()
      const image = await worker.current.run('load', { file, mimeType })
      if (current()) {
        setPhoto(image)
        setLoad({ busy: false, error: null })
        go(2)
      }
    } catch {
      if (current()) {
        worker.current?.close()
        worker.current = null
        setLoad({ busy: false, error: 'errRead' })
      }
    }
  }

  const previewing = step === 2 && preview?.draft !== draft
  const exporting = step === 3 && !invalidOutput && (finished?.draft !== draft || finished?.output !== output)
  const error = step === 1 ? load.error : step === 2 ? !previewing && preview?.error : !exporting && !invalidOutput && finished?.error

  function finish() {
    if (exportSource.current?.draft !== draft) {
      setOutputCrop(fullPaper)
      setExportImage(null)
    }
    go(3)
  }
  function closeCrop() {
    setCropping(false)
    cropButton.current?.focus({ preventScroll: true })
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <main id="signature-main" tabIndex={-1} className="signature-main grow">
        <h1 ref={heading} tabIndex={-1} className="text-2xl tracking-tight focus:outline-none sm:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">{copy.subtitle}</p>
        <ol aria-label={copy.stepLabel} className="signature-steps">
          {copy.steps.map((label, i) => <li key={label} aria-current={i + 1 === step ? 'step' : undefined}>{label}</li>)}
        </ol>
        <p role="status" className="signature-status" aria-live="polite">
          {(load.busy || previewing || exporting) ? copy.processing : ''}
        </p>
        {error && <p role="alert" className="signature-alert">{copy[error] ?? t[error]}</p>}
        {step === 1 && <Upload copy={copy} busy={load.busy} onFile={handleFile} />}
        {step === 2 && (
          <Edit copy={copy} photo={photo} draft={draft} setDraft={setDraft} preview={preview?.result}
            busy={previewing} finish={finish} restart={restart} frame={frame} setFrame={setFraming} />
        )}
        {step === 3 && (
          <>
            <section className="signature-card">
              <h2>{copy.export}</h2>
              <div className="signature-options">
                <div className="signature-field">
                  <label htmlFor="signature-format">{copy.outputFormat}</label>
                  <select id="signature-format" value={format} onChange={event => setFormat(event.target.value)}>
                    <option value="png">{copy.pngMode}</option>
                    <option value="egov">{copy.egovMode}</option>
                  </select>
                </div>
                {!egov && (
                  <>
                    <div className="signature-field">
                      <label htmlFor="signature-width">{copy.width}</label>
                      <select id="signature-width" value={fixedWidth}
                        onChange={event => setFixedWidth(event.target.value === 'custom' ? 'custom' : Number(event.target.value))}>
                        <option value="0">{copy.autoWidth}</option>
                        {[300, 600, 1000].map(width => <option key={width} value={width}>{width} {copy.px}</option>)}
                        <option value="custom">{copy.customSize}</option>
                      </select>
                    </div>
                    <div className="signature-field">
                      <label htmlFor="signature-limit">{copy.limit}</label>
                      <select id="signature-limit" value={limit} onChange={event => setLimit(event.target.value)}>
                        <option value="0">{copy.noLimit}</option>
                        {[50, 100, 200].map(kb => <option key={kb} value={kb}>{kb} {copy.kb}</option>)}
                        <option value="custom">{copy.custom}</option>
                      </select>
                    </div>
                    {limit === 'custom' && (
                      <label className="signature-field">
                        <span>{copy.customLimit}</span>
                        <input type="number" min="1" max="50000" value={custom} aria-invalid={invalidLimit}
                          aria-describedby={invalidLimit ? 'signature-invalid-limit' : undefined}
                          onChange={event => setCustom(event.target.value)} />
                      </label>
                    )}
                  </>
                )}
              </div>
              {!egov && exactSize && (
                <>
                  <div className="signature-options">
                    <label className="signature-field">
                      <span>{copy.pixelWidth}</span>
                      <input type="number" min="1" max="4096" step="1" value={customWidth} aria-invalid={invalidSize}
                        aria-describedby="signature-size-hint" onChange={event => setCustomWidth(event.target.value)} />
                    </label>
                    <label className="signature-field">
                      <span>{copy.pixelHeight}</span>
                      <input type="number" min="1" max="4096" step="1" value={customHeight} aria-invalid={invalidSize}
                        aria-describedby="signature-size-hint" disabled={!cropSize}
                        onChange={event => setCustomWidth(event.target.value === '' ? '' :
                          String(Math.round(event.target.valueAsNumber * cropSize.width / cropSize.height)))} />
                    </label>
                  </div>
                  <p id="signature-size-hint" className="signature-help mt-2">{copy.sizeHint}</p>
                </>
              )}
              {egov && (
                <div className="my-3 space-y-1">
                  <p className="signature-help">
                    {copy.egovDetails.replace('{width}', egovSignature.width).replace('{height}', egovSignature.height)}
                  </p>
                </div>
              )}
              {invalidLimit && <p id="signature-invalid-limit" className="signature-alert">{copy.invalidLimit}</p>}
              {invalidSize && <p role="alert" className="signature-alert">{copy.invalidSize}</p>}
              {!egov && <div className="signature-actions mt-3">
                <button ref={cropButton} type="button" className="signature-button" disabled={!exportImage}
                  aria-expanded={cropping} aria-controls="signature-result-crop" onClick={() => setCropping(!cropping)}>
                  {copy.cropResult}
                </button>
                {outputCrop !== fullPaper && !cropping && (
                  <button type="button" className="signature-button" onClick={() => setOutputCrop(fullPaper)}>{copy.resetOutputCrop}</button>
                )}
              </div>}
              <div id="signature-result-crop">
                {!egov && cropping && exportImage && (
                  <ResultCrop copy={copy} image={exportImage} crop={outputCrop} onCancel={closeCrop}
                    onApply={crop => { setOutputCrop(crop); closeCrop() }} />
                )}
              </div>
              {egov && <SignatureFraming photo={photo} region={preview?.result?.region} frame={frame} onChange={setFraming} copy={copy} />}
              {(egov || !cropping) && !exporting && !invalidOutput && finished?.result && (
                <>
                  {egov
                    ? <EgovDownload copy={copy} result={finished.result} />
                    : <Downloads copy={copy} result={finished.result} maxKb={maxKb} locale={lang === 'kz' ? 'kk-KZ' : 'ru-RU'} />}
                  <SignatureChecks copy={copy} result={finished.result} onCropFrame={egov ? () => setRemoveFrame(true) : undefined} />
                </>
              )}
            </section>
            <div className="signature-actions signature-controls">
              <button type="button" className="signature-button" onClick={() => { setCropping(false); go(2) }}>{copy.edit}</button>
              <button type="button" className="signature-button" onClick={restart}>{copy.new}</button>
            </div>
          </>
        )}
        {(step === 1 || step === 3) && <SignatureRules copy={copy} />}
      </main>
      <Footer />
    </div>
  )
}
