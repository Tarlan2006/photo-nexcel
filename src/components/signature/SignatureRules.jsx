import { useRef, useState } from 'react'
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
      <div className="signature-rule-grid">
        {copy.rules.map(([title, description]) => <div key={title} className="signature-rule"><h3>{title}</h3><p>{description}</p></div>)}
      </div>
      <SignatureSources copy={copy} />
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
