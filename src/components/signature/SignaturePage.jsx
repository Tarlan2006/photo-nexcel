import { useEffect, useRef, useState } from 'react'
import CameraCapture from '../CameraCapture'
import Footer from '../Footer'
import { useLang } from '../../contexts/LangContext'
import { identifyPhoto, photoFileError, photoMimeTypes } from '../../lib/photo'
import { signatureCopy } from './copy'
import SignatureRules, { SignatureRequirements } from './SignatureRules'
import SignaturePad from './SignaturePad'
import SignatureStudio from './SignatureStudio'
import './signature.css'

function Upload({ copy, busy, onFile, onDrawn }) {
  const { lang } = useLang()
  const input = useRef(null)
  const cameraButton = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [camera, setCamera] = useState(false)
  const [pad, setPad] = useState(false)
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
          <button type="button" className="signature-button" disabled={busy} onClick={() => setPad(true)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 size-4 shrink-0 text-text-muted"><path d="M15.23 5.23l3.54 3.54m-2.04-5.04a2.5 2.5 0 1 1 3.54 3.54L6.5 21.04H3v-3.57L16.73 3.73Z" /></svg>
            {copy.draw}
          </button>
        </div>
      </div>
      <details className="signature-tips-more mx-auto w-full max-w-[960px] rounded-2xl border border-grid-border bg-white px-4 sm:px-5">
        <summary>{copy.tips}</summary>
        <ul className="mt-1 list-disc space-y-2 pl-5 text-sm text-text-muted">
          {copy.tipsList.map(tip => <li key={tip}>{tip}</li>)}
        </ul>
        <p className="my-4 border-t border-grid-border pt-4 text-sm leading-relaxed text-text-main">{copy.legal}</p>
      </details>
      <SignaturePad copy={copy} open={pad} onClose={() => setPad(false)} onUse={bitmap => { setPad(false); onDrawn(bitmap) }} />
      {camera && (
        <CameraCapture mode="signature" signatureGuideCopy={copy} onClose={closeCamera}
          onCapture={file => { setCamera(false); onFile(file) }}
          onSelectFile={() => { closeCamera(); input.current.click() }} />
      )}
    </div>
  )
}

export default function SignaturePage() {
  const { lang, t } = useLang()
  const copy = signatureCopy[lang]
  const heading = useRef(null)
  const generation = useRef(0)
  const [photo, setPhoto] = useState(null)
  const [load, setLoad] = useState({ busy: false, error: null })

  useEffect(() => () => {
    generation.current++
  }, [])
  useEffect(() => () => photo?.image.close?.(), [photo])

  function restart() {
    generation.current++
    setPhoto(null)
    setLoad({ busy: false, error: null })
    window.scrollTo(0, 0)
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
  }
  function handleDrawn(image) {
    const id = ++generation.current
    setPhoto({ image, id, drawn: true })
    setLoad({ busy: false, error: null })
    window.scrollTo(0, 0)
  }
  async function handleFile(file) {
    if (!file || load.busy) return
    const id = ++generation.current
    const current = () => id === generation.current
    const error = photoFileError(file)
    if (error) return setLoad({ busy: false, error })
    setLoad({ busy: true, error: null })
    try {
      const mimeType = await identifyPhoto(file)
      if (!current()) return
      if (mimeType === 'image/heic') return setLoad({ busy: false, error: 'errHeic' })
      if (!mimeType) return setLoad({ busy: false, error: file.type ? 'errRead' : 'errUnsupportedFormat' })
      const image = await createImageBitmap(file)
      if (!current()) return image.close()
      setPhoto({ image, id })
      setLoad({ busy: false, error: null })
      window.scrollTo(0, 0)
      heading.current?.focus({ preventScroll: true })
    } catch {
      if (current()) setLoad({ busy: false, error: 'errRead' })
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <main id="signature-main" tabIndex={-1} className="signature-main grow">
        <div className={photo ? '' : 'text-center'}>
          {!photo && (
            <p className="mx-auto mb-3 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-emerald-accent/25 bg-emerald-accent/5 px-3 py-1.5 text-sm font-semibold text-emerald-accent">
              <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg> {copy.trust}
            </p>
          )}
          <h1 ref={heading} tabIndex={-1} className={`leading-tight tracking-tight focus:outline-none ${photo ? 'mb-4 text-2xl' : 'text-3xl sm:text-4xl'}`}>{copy.title}</h1>
          {!photo && <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-text-muted">{copy.subtitle}</p>}
        </div>
        <p role="status" className="signature-status" aria-live="polite">{load.busy ? copy.processing : ''}</p>
        {load.error && <p role="alert" className="signature-alert">{copy[load.error] ?? t[load.error]}</p>}
        {photo
          ? <SignatureStudio key={photo.id} copy={copy} lang={lang} source={photo.image} drawn={photo.drawn} onOther={restart} />
          : <Upload copy={copy} busy={load.busy} onFile={handleFile} onDrawn={handleDrawn} />}
        <SignatureRequirements copy={copy} />
        <div className="mt-6" />
        <SignatureRules copy={copy} collapsed />
      </main>
      <Footer />
    </div>
  )
}
