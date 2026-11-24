import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createSignatureTemplate } from '../../lib/signature-template.js'

export function SignatureSources({ copy }) {
  return (
    <div className="signature-sources signature-help">
      <a href="https://zan.gov.kz/client/#!/doc/140840/rus/158" target="_blank" rel="noopener noreferrer">{copy.officialSource}</a>
      <a href="https://old.adilet.zan.kz/rus/docs/V2000020192" target="_blank" rel="noopener noreferrer">{copy.adiletSource}</a>
      <p>{copy.revisionNote}</p>
    </div>
  )
}

const mainRules = 4

export function RulesList({ copy }) {
  const cards = rules => <div className="signature-rule-grid">{rules.map(([title, description]) => <div key={title} className="signature-rule"><h3>{title}</h3><p>{description}</p></div>)}</div>
  return (
    <>
      {cards(copy.rules.slice(0, mainRules))}
      <details className="signature-rules-more mt-3">
        <summary>{copy.allRules}</summary>
        {cards(copy.rules.slice(mainRules))}
      </details>
      <SignatureSources copy={copy} />
    </>
  )
}

// Same place and look as the "Требования" button on the photo page.
export function SignatureRequirements({ copy }) {
  const [open, setOpen] = useState(false)
  const dialog = useRef(null)
  const slot = document.getElementById('tool-nav-actions')
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current.open) dialog.current.close()
  }, [open])
  return (
    <>
      {slot && createPortal(
        <button type="button" data-for="signature" onClick={() => setOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-grid-border bg-white px-3 text-sm font-semibold hover:border-emerald-accent hover:text-emerald-accent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4"><path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" /></svg> {copy.requirementsButton}
        </button>, slot)}
      <dialog ref={dialog} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) setOpen(false) }}
        aria-labelledby="signature-requirements-title"
        className="signature-requirements-dialog m-auto max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-grid-border bg-white p-0 backdrop:bg-black/40">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="signature-requirements-title" className="text-lg">{copy.rulesTitle}</h2>
            <button type="button" aria-label={copy.closeDialog} onClick={() => setOpen(false)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-grid-border hover:border-emerald-accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-5"><path d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {open && <RulesList copy={copy} />}
        </div>
      </dialog>
    </>
  )
}

export default function SignatureRules({ copy }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const downloading = useRef(false)
  async function download() {
    if (downloading.current) return
    downloading.current = true; setBusy(true); setError(false)
    let url
    try {
      url = URL.createObjectURL(await createSignatureTemplate(copy))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'signature-template-a4.pdf'
      document.body.append(anchor); anchor.click(); anchor.remove()
    } catch { setError(true) }
    finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 0)
      downloading.current = false; setBusy(false)
    }
  }
  return (
    <section className="signature-card signature-rules">
      <h2>{copy.rulesTitle}</h2>
      <RulesList copy={copy} />
      <div className="signature-actions mt-4">
        <button type="button" className="signature-button" disabled={busy} onClick={download}>{copy.templateDownload}</button>
      </div>
      <p className="signature-help mt-2">{copy.templateNote}</p>
      {error && <p role="alert" className="signature-alert">{copy.templateError}</p>}
    </section>
  )
}

const symbols = { pass: '✓', warn: '⚠', fail: '✕' }

export function SignatureChecks({ copy, result, onCropFrame }) {
  const checks = result.checks
  if (!checks) return null
  const measurements = checks.measurements
  function message(key) {
    if (checks[key] === 'pass') return null
    if (key === 'stroke') return copy.checkMessages[measurements.stroke.status === 'thick' ? 'thick' : 'thin']
    if ((key === 'content' || key === 'margins') && !measurements.margins.count) return copy.checkMessages.empty
    return copy.checkMessages[key]
  }
  return (
    <section className="signature-checks mt-4" aria-label={copy.checksTitle}>
      <h2>{copy.checksTitle}</h2>
      <p className="signature-help">{copy.approximate}</p>
      <ul className="signature-check-list">
        {Object.entries(copy.checkLabels).map(([key, label]) => <li key={key} data-check={key} data-status={checks[key]}>
          <p><span aria-hidden="true">{symbols[checks[key]]}</span> <strong>{label}</strong> · {copy.status[checks[key]]}</p>
          {message(key) && <p className="signature-help">{message(key)}</p>}
          {key === 'stroke' && measurements.margins.count > 0 && <p className="signature-help">{copy.strokeValue.replace('{mm}', measurements.stroke.mm.toFixed(2))}</p>}
          {key === 'margins' && measurements.margins.count > 0 && <p className="signature-help">{copy.marginValue
            .replace('{top}', Math.round(measurements.margins.top / result.height * 100))
            .replace('{bottom}', Math.round(measurements.margins.bottom / result.height * 100))}</p>}
        </li>)}
      </ul>
      {checks.frameRemoved && <p className="signature-help">{copy.frameRemoved}</p>}
      {checks.frameDetected > 0 && onCropFrame && <button type="button" className="signature-button" onClick={onCropFrame}>{copy.cropFrame}</button>}
    </section>
  )
}
