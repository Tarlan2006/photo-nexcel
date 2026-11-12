import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { exportToJpegLimit } from '../lib/export'

export default function Step4Done() {
  const { t, lang } = useLang()
  const { selectedPreset, activeCropState, goToStep, retake } = useWizard()
  const [result, setResult] = useState(null)
  const [downloadError, setDownloadError] = useState(false)
  const previewCanvasRef = useRef(null)
  const canvas = activeCropState?.canvas
  const { width, height, maxKb, id } = selectedPreset

  useEffect(() => {
    if (!canvas) return
    const preview = previewCanvasRef.current
    preview.getContext('2d').drawImage(canvas, 0, 0)

    let cancelled = false
    exportToJpegLimit(canvas, maxKb).then((encoded) => {
      if (!cancelled) setResult({ canvas, encoded })
    }).catch(() => {
      if (!cancelled) setResult({ canvas, encoded: { success: false, error: 'ENCODE_FAILED' } })
    })
    return () => { cancelled = true }
  }, [canvas, maxKb])

  const encoded = result?.canvas === canvas ? result?.encoded : null
  const handleDownload = () => {
    if (!encoded?.success) return
    try {
      const url = URL.createObjectURL(encoded.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `photo-${id}.jpg`
      try {
        link.click()
        setDownloadError(false)
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      setDownloadError(true)
    }
  }

  const failed = !canvas || encoded?.success === false
  const exportError = downloadError || failed
  const errorMessage = encoded?.error === 'FILE_TOO_LARGE' ? t.errFileTooLarge : t.errRead
  const formattedInfo = (encoded?.success ? t.exportLimitInfo : t.dimensionsAndLimit)
    .replace('{w}', width)
    .replace('{h}', height)
    .replace('{kb}', encoded?.sizeKb)
    .replace('{max}', maxKb)

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-14 pb-28 text-center">
      {/* Title & Subtitle */}
      <div className="mb-8">
        <h1 tabIndex={-1} className="font-heading font-extrabold text-2xl sm:text-3xl text-text mb-2 tracking-tight">
          {encoded?.success ? t.step4Title : failed ? t.exportFailedTitle : t.exportPreparing}
        </h1>
        {encoded?.success && (
          <p className="text-muted text-sm sm:text-base max-w-md mx-auto">{t.step4Subtitle}</p>
        )}
      </div>

      {/* Preview Card */}
      <div className="max-w-full bg-card border border-border rounded-xl p-4 sm:p-8 mb-8 inline-block shadow-2xs">
        <div className="flex justify-center mb-4">
          <div className="min-w-0 rounded-lg overflow-hidden border border-border/80 bg-white">
            <canvas
              ref={previewCanvasRef}
              width={width}
              height={height}
              className="block h-auto w-auto max-h-[360px] max-w-full"
            />
          </div>
        </div>

        <p className="font-heading font-extrabold text-sm text-text mb-1">
          {selectedPreset.name[lang]}
        </p>

        {/* Info on px & KB */}
        <p className="font-mono text-xs text-[#4B525D] font-semibold">
          {formattedInfo}
        </p>
      </div>

      {/* Export Error with role="alert" */}
      {exportError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold max-w-md mx-auto"
        >
          {errorMessage.replace('{max}', maxKb)}
        </div>
      )}

      {/* Primary Action: Download JPEG */}
      <div className="mb-8 flex flex-col items-center">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!encoded?.success}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-base font-semibold px-8 py-3.5 rounded transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 15C3 16.1046 3.89543 17 5 17H15C16.1046 17 17 16.1046 17 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>{t.btnDownloadJpeg}</span>
        </button>

        <p className="mt-2 text-[#4B525D] text-xs font-medium">
          {t.jpegFormat}
        </p>
      </div>

      {/* Secondary Actions: Other Document & New Photo */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-border/60">
        <button
          type="button"
          onClick={() => goToStep(2)}
          className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 rounded border border-border bg-card text-text font-semibold text-xs sm:text-sm hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 6H11M5 9H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>{t.btnOtherDoc}</span>
        </button>

        <button
          type="button"
          onClick={retake}
          className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2.5 rounded border border-border bg-card text-text font-semibold text-xs sm:text-sm hover:bg-bg transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 8C2 4.68629 4.68629 2 8 2C10.0526 2 11.8703 3.03057 12.9649 4.60742M14 8C14 11.3137 11.3137 14 8 14C5.94744 14 4.12968 12.9694 3.03507 11.3926" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 2V5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t.btnNewPhoto}</span>
        </button>
      </div>
    </div>
  )
}
