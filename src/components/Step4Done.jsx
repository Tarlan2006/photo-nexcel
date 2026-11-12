import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { exportToJpegLimit } from '../lib/export'

export default function Step4Done() {
  const { t, lang } = useLang()
  const {
    selectedPreset,
    activeCropState,
    goToStep,
    resetAll,
  } = useWizard()

  const [isExporting, setIsExporting] = useState(false)
  const [exportInfo, setExportInfo] = useState(null)
  const [exportErrorKey, setExportErrorKey] = useState(null)
  const [readyBlob, setReadyBlob] = useState(null)
  const previewCanvasRef = useRef(null)

  const isValidCrop = Boolean(activeCropState?.success && activeCropState?.canvas)

  useEffect(() => {
    if (!previewCanvasRef.current || !isValidCrop || !activeCropState?.canvas) return

    const pCanvas = previewCanvasRef.current
    pCanvas.width = activeCropState.width
    pCanvas.height = activeCropState.height
    const ctx = pCanvas.getContext('2d')
    ctx.clearRect(0, 0, pCanvas.width, pCanvas.height)
    ctx.drawImage(activeCropState.canvas, 0, 0)

    let cancelled = false
    exportToJpegLimit(pCanvas, selectedPreset.maxKb)
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setExportInfo({
            width: selectedPreset.width,
            height: selectedPreset.height,
            sizeKb: res.sizeKb,
            quality: res.quality,
          })
          setReadyBlob(res.blob)
          setExportErrorKey(null)
        } else {
          setExportErrorKey('errFileTooLarge')
        }
      })
      .catch((err) => {
        console.warn('Pre-export error:', err)
      })

    return () => {
      cancelled = true
      setReadyBlob(null)
    }
  }, [activeCropState, isValidCrop, selectedPreset])

  const handleDownload = async () => {
    if (!previewCanvasRef.current || !isValidCrop) return

    setIsExporting(true)
    setExportErrorKey(null)

    try {
      let blobToDownload = readyBlob

      if (!blobToDownload) {
        const exportRes = await exportToJpegLimit(
          previewCanvasRef.current,
          selectedPreset.maxKb
        )

        if (!exportRes.success) {
          setExportErrorKey('errFileTooLarge')
          setIsExporting(false)
          return
        }

        blobToDownload = exportRes.blob
        setExportInfo({
          width: selectedPreset.width,
          height: selectedPreset.height,
          sizeKb: exportRes.sizeKb,
          quality: exportRes.quality,
        })
      }

      const url = URL.createObjectURL(blobToDownload)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-${selectedPreset.id}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error(err)
      setExportErrorKey('errRead')
    } finally {
      setIsExporting(false)
    }
  }

  const formattedInfo = exportInfo
    ? t.exportLimitInfo
        .replace('{w}', exportInfo.width)
        .replace('{h}', exportInfo.height)
        .replace('{kb}', exportInfo.sizeKb)
        .replace('{max}', selectedPreset.maxKb)
    : `${selectedPreset.width} × ${selectedPreset.height} px · ${lang === 'ru' ? 'до' : 'дейін'} ${selectedPreset.maxKb} КБ`

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-14 pb-28 text-center">
      {/* Title & Subtitle */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 text-xs font-bold mb-3">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{lang === 'ru' ? 'Готово к сохранению' : 'Сақтауға дайын'}</span>
        </div>

        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-text mb-2 tracking-tight">
          {t.step4Title}
        </h2>
        <p className="text-[#4B525D] text-sm sm:text-base max-w-md mx-auto">
          {t.step4Subtitle}
        </p>
      </div>

      {/* Preview Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 mb-8 inline-block shadow-2xs">
        <div className="flex justify-center mb-4">
          <div className="rounded-lg overflow-hidden border border-border/80 bg-white">
            <canvas
              ref={previewCanvasRef}
              style={{
                maxHeight: '360px',
                width: 'auto',
              }}
              className="block"
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
      {exportErrorKey && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold max-w-md mx-auto"
        >
          {t[exportErrorKey]?.replace('{max}', selectedPreset.maxKb) || exportErrorKey}
        </div>
      )}

      {/* Primary Action: Download JPEG */}
      <div className="mb-8 flex flex-col items-center">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isExporting}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-base font-semibold px-8 py-3.5 rounded transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t.downloading}</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 15C3 16.1046 3.89543 17 5 17H15C16.1046 17 17 16.1046 17 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{t.btnDownloadJpeg}</span>
            </>
          )}
        </button>

        <p className="mt-2 text-[#4B525D] text-xs font-medium">
          {lang === 'ru' ? 'Формат: JPEG' : 'Форматы: JPEG'} · {lang === 'ru' ? 'без водяных знаков' : 'су белгісіз'}
        </p>
      </div>

      {/* Secondary Actions: Other Document & New Photo */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-border/60">
        <button
          type="button"
          onClick={() => goToStep(2)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded border border-border bg-card text-text font-semibold text-xs sm:text-sm hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 6H11M5 9H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>{t.btnOtherDoc}</span>
        </button>

        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded border border-border bg-card text-text font-semibold text-xs sm:text-sm hover:bg-bg transition-colors cursor-pointer"
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
