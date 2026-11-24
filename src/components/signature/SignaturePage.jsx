import { useEffect, useMemo, useRef, useState } from 'react'
import CameraCapture from '../CameraCapture'
import Footer from '../Footer'
import { useLang } from '../../contexts/LangContext'
import { releaseCopy } from '../../content/release-copy'
import { BusinessCta, ResultDisclaimer } from '../ResultNotice'
import { identifyPhoto, photoFileError, photoMimeTypes } from '../../lib/photo'
import { fullPaper, signatureDefaults } from '../../lib/signature'
import { signatureOutputBounds } from '../../lib/signature-crop'
import { centerSignatureFrame } from '../../lib/signature-frame'
import { egovSignature } from '../../presets'
import { signatureCopy } from './copy'
import { BrushCanvas, PaperCrop, SignatureCanvas } from './SignatureImages'
import SignatureFraming from './SignatureFraming'
import SignatureRules, { SignatureChecks, SignatureRequirements } from './SignatureRules'
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
  const { lang } = useLang()
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
      <div className={`signature-drop mx-auto w-full max-w-[960px] ${dragging ? 'signature-dragging' : ''}`}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          if (!busy) onFile(event.dataTransfer.files[0])
        }}>
        <span className="mx-auto mb-3 hidden size-14 items-center justify-center rounded-2xl bg-emerald-accent/10 text-emerald-accent sm:flex">
          <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </span>
        <h2 className="text-xl">{copy.uploadTitle}</h2>
        <p className="mx-auto mt-1 mb-5 max-w-md text-base text-text-muted">{copy.uploadText}</p>
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
      </div>
      <details className="signature-tips-more mx-auto w-full max-w-[960px] rounded-2xl border border-grid-border bg-white px-4 sm:px-5">
        <summary>{copy.tips}</summary>
        <ul className="mt-1 list-disc space-y-2 pl-5 text-sm text-text-muted">
          {copy.tipsList.map(tip => <li key={tip}>{tip}</li>)}
        </ul>
        <p className="my-4 border-t border-grid-border pt-4 text-sm leading-relaxed text-text-main">{copy.legal}</p>
      </details>
      {camera && (
        <CameraCapture mode="signature" signatureGuideCopy={copy} onClose={closeCamera}
          onCapture={file => { setCamera(false); onFile(file) }}
          onSelectFile={() => { closeCamera(); input.current.click() }} />
      )}
    </div>
  )
}

function Edit({ copy, photo, draft, setDraft, preview, busy, frame, setFrame, hidePaper, left, right }) {
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
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-7">
        <section className="signature-card order-1 lg:order-none">
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
        <div className="order-5 lg:order-none"><SignatureFraming photo={photo} region={preview?.region} frame={frame} onChange={setFrame} copy={copy} /></div>
        {!hidePaper && (
          <div className="order-6 lg:order-none"><PaperCrop photo={photo} crop={draft.crop} square={draft.square} copy={copy}
            onCrop={(crop, square) => setDraft(current => current.crop === crop && current.square === square
              ? current : { ...current, crop, square })} /></div>
        )}
        {left}
      </div>
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-5">
        <section className="signature-card order-2 lg:order-none">
          <div className="flex items-center justify-between gap-2">
            <h2>{copy.settings}</h2>
            <button type="button" className="signature-link" onClick={reset}>{copy.reset}</button>
          </div>
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
        {right}
      </div>
    </div>
  )
}

function Downloads({ copy, result, maxKb, locale, onSaved }) {
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
          <a className="signature-button signature-primary" download="signature.png" href={urls.transparent} onClick={onSaved}>
            {copy.download} · {format.format(result.transparent.size / 1000)} {copy.kb}
          </a>
          <a className="signature-button" download="signature-white.png" href={urls.white} onClick={onSaved}>
            {copy.downloadWhite} · {format.format(result.white.size / 1000)} {copy.kb}
          </a>
          {canCopy && <button type="button" className="signature-button" onClick={copyPng}>{copy.copy}</button>}
        </div>
      )}
      <p role="status" className="signature-help">{copyStatus}</p>
    </>
  )
}

function EgovDownload({ copy, result, onSaved }) {
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
          <a className="signature-button signature-primary" download="signature-egov.jpg" href={href} onClick={onSaved}>{copy.downloadEgov}</a>
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
  const [saved, setSaved] = useState(false)
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
    if (step !== 2 || invalidOutput || hasCurrentExport) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        if (exportSource.current?.draft !== draft) {
          const image = await worker.current.run('result', draft)
          if (!active) return
          exportSource.current = { draft, image }
          setExportImage(image)
          setOutputCrop(fullPaper)
          setCropping(false)
        }
        const result = await worker.current.run('export', { ...draft, output })
        if (active) setFinished({ draft, output, result })
      } catch (error) {
        if (active) setFinished({ draft, output, error: errorLabels[error.message] ?? 'processingError' })
      }
    }, 120)
    return () => { active = false; clearTimeout(timer) }
  }, [draft, output, step, invalidOutput, hasCurrentExport])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(timer)
  }, [saved])

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
    setSaved(false)
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
  const exporting = step === 2 && !invalidOutput && (finished?.draft !== draft || finished?.output !== output)
  const error = step === 1 ? load.error : (!previewing && preview?.error) || (!exporting && !invalidOutput && finished?.error)

  function closeCrop() {
    setCropping(false)
    cropButton.current?.focus({ preventScroll: true })
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <main id="signature-main" tabIndex={-1} className="signature-main grow">
        <div className={step === 1 ? 'text-center' : ''}>
          {step === 1 && (
            <p className="mx-auto mb-3 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-emerald-accent/25 bg-emerald-accent/5 px-3 py-1 text-xs font-semibold text-emerald-accent">
              <svg aria-hidden="true" className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg> {copy.trust}
            </p>
          )}
          <h1 ref={heading} tabIndex={-1} className={`leading-tight tracking-tight focus:outline-none ${step === 1 ? 'text-3xl sm:text-4xl' : 'mb-3 text-2xl'}`}>{copy.title}</h1>
          {step === 1 && <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-text-muted">{copy.subtitle}</p>}
        </div>
        <p role="status" className="signature-status" aria-live="polite">
          {(load.busy || previewing || exporting) ? copy.processing : ''}
        </p>
        {error && <p role="alert" className="signature-alert">{copy[error] ?? t[error]}</p>}
        {step === 1 && <Upload copy={copy} busy={load.busy} onFile={handleFile} />}
        {step === 2 && (
          <Edit copy={copy} photo={photo} draft={draft} setDraft={setDraft} preview={preview?.result}
            busy={previewing} frame={frame} setFrame={setFraming} hidePaper={cropping}
            left={<>
          {!exporting && !invalidOutput && finished?.result && (
            <div className="order-7 lg:order-none"><SignatureChecks copy={copy} result={finished.result} onCropFrame={egov ? () => setRemoveFrame(true) : undefined} /></div>
          )}
            </>}
            right={<>
          <section className="signature-card order-3 lg:order-none">
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
            {(egov || !cropping) && !exporting && !invalidOutput && finished?.result && (
              <>
                {egov
                  ? <EgovDownload copy={copy} result={finished.result} onSaved={() => setSaved(true)} />
                  : <Downloads copy={copy} result={finished.result} maxKb={maxKb} locale={lang === 'kz' ? 'kk-KZ' : 'ru-RU'} onSaved={() => setSaved(true)} />}
                <ResultDisclaimer />
              </>
            )}
          </section>
          <div className="signature-actions order-4 lg:order-none">
            <button type="button" className="signature-button" onClick={restart}>{copy.new}</button>
          </div>
          <div className="order-4 lg:order-none"><BusinessCta /></div>
            </>} />
        )}
        <SignatureRules copy={copy} collapsed />
      </main>
      {saved && (
        <div aria-live="polite" className="fixed right-4 bottom-4 left-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-emerald-accent px-4 py-3 text-base font-semibold text-white shadow-lg sm:left-auto">
          <span aria-hidden="true" className="text-xl">✓</span> {copy.saved}
        </div>
      )}
      <Footer />
    </div>
  )
}
