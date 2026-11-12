import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { runPhotoChecks } from '../lib/checks'

export default function Step3Check() {
  const { t, lang } = useLang()
  const {
    selectedPreset,
    activeCropState,
    originalImage,
    adjustments,
    updateAdjustments,
    resetAdjustments,
  } = useWizard()

  const [checks, setChecks] = useState([])
  const previewCanvasRef = useRef(null)

  const isValidCrop = Boolean(activeCropState?.success && activeCropState?.canvas)

  useEffect(() => {
    if (!previewCanvasRef.current || !isValidCrop || !activeCropState?.canvas) {
      setChecks([])
      return
    }

    const pCanvas = previewCanvasRef.current
    pCanvas.width = activeCropState.width
    pCanvas.height = activeCropState.height
    const ctx = pCanvas.getContext('2d')
    ctx.clearRect(0, 0, pCanvas.width, pCanvas.height)
    ctx.drawImage(activeCropState.canvas, 0, 0)

    if (originalImage?.landmarks && originalImage?.bitmap) {
      const results = runPhotoChecks(
        pCanvas,
        originalImage.landmarks,
        originalImage.bitmap.width,
        originalImage.bitmap.height,
        selectedPreset,
        activeCropState.headPct,
        originalImage.blendshapes
      )
      setChecks(results)
    }
  }, [activeCropState, isValidCrop, originalImage, selectedPreset])

  const handleScaleChange = (e) => {
    const scaleVal = parseFloat(e.target.value) / 100
    updateAdjustments({ scaleOffset: scaleVal })
  }

  const handleShiftYChange = (e) => {
    const shiftVal = parseFloat(e.target.value) / 100
    updateAdjustments({ offsetY: shiftVal })
  }

  const scalePercent = Math.round((adjustments.scaleOffset || 0) * 100)
  const shiftYPercent = Math.round((adjustments.offsetY || 0) * 100)
  const hasAdjustments = scalePercent !== 0 || shiftYPercent !== 0

  // Nominal guidelines calculation
  const midHeadPct = (selectedPreset.headMinPct + selectedPreset.headMaxPct) / 2 / 100
  const chinPercentFromTop = (0.4 * (1 - midHeadPct) + midHeadPct) * 100
  const corridorTopMaxPct = chinPercentFromTop - selectedPreset.headMaxPct
  const corridorTopMinPct = chinPercentFromTop - selectedPreset.headMinPct

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14 pb-28">
      {/* Title & Subtitle */}
      <div className="text-center mb-8">
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-text mb-2 tracking-tight">
          {t.step3Title}
        </h2>
        <p className="text-[#4B525D] text-sm sm:text-base max-w-lg mx-auto">
          {t.step3Subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Canvas Preview + Sliders */}
        <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
            <span className="font-heading font-extrabold text-sm text-text">
              {selectedPreset.name[lang]}
            </span>
            <span className="font-mono text-xs text-[#4B525D] font-medium">
              {selectedPreset.width} × {selectedPreset.height} px
            </span>
          </div>

          {/* Out of bounds error alert if invalid crop */}
          {!isValidCrop && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-amber-700 mt-0.5" aria-hidden="true">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="6" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="14" r="0.75" fill="currentColor" />
              </svg>
              <div>
                <p className="font-bold mb-0.5 text-amber-950">{t.errOutOfBounds}</p>
                <p className="text-amber-900 font-medium">{t.errOutOfBoundsHint}</p>
              </div>
            </div>
          )}

          {/* Canvas Container */}
          <div className="flex flex-col items-center mb-6">
            <div className={`relative rounded-lg overflow-hidden border ${isValidCrop ? 'border-border shadow-2xs' : 'border-amber-400 bg-amber-50'}`}>
              <canvas
                ref={previewCanvasRef}
                style={{
                  maxHeight: '340px',
                  width: 'auto',
                  display: isValidCrop ? 'block' : 'none',
                }}
                className="bg-white block"
              />
              {isValidCrop && (
                <div className="absolute inset-0 pointer-events-none select-none">
                  {/* Corridor band */}
                  <div
                    style={{
                      top: `${corridorTopMaxPct}%`,
                      height: `${corridorTopMinPct - corridorTopMaxPct}%`,
                    }}
                    className="absolute left-0 right-0 bg-sky-500/10 border-y border-dashed border-sky-500/70"
                  >
                    <span className="absolute right-1 top-0.5 text-[9px] font-mono font-bold text-sky-800 bg-white/80 px-1 rounded leading-none border border-sky-300">
                      {selectedPreset.headMaxPct}%
                    </span>
                    <span className="absolute right-1 bottom-0.5 text-[9px] font-mono font-bold text-sky-800 bg-white/80 px-1 rounded leading-none border border-sky-300">
                      {selectedPreset.headMinPct}%
                    </span>
                  </div>

                  {/* Chin line */}
                  <div
                    style={{ top: `${chinPercentFromTop}%` }}
                    className="absolute left-0 right-0 border-t-2 border-emerald-500"
                  >
                    <span className="absolute right-1 bottom-0.5 text-[9px] font-mono font-bold text-emerald-800 bg-white/80 px-1 rounded leading-none border border-emerald-300">
                      {t.guideChin}
                    </span>
                  </div>
                </div>
              )}
              {!isValidCrop && (
                <div className="w-56 h-64 flex flex-col items-center justify-center p-4 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-amber-700 mb-2" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs font-bold text-amber-950">
                    {t.errOutOfBounds}
                  </p>
                </div>
              )}
            </div>
            {isValidCrop && (
              <p className="text-xs text-[#4B525D] text-center mt-2.5 font-medium max-w-xs">
                {t.guideCorridor}
              </p>
            )}
          </div>

          {/* Sliders with accessible labels */}
          <div className="pt-4 border-t border-border/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#4B525D]">
                {t.adjustTitle}
              </span>
              {hasAdjustments && (
                <button
                  type="button"
                  onClick={resetAdjustments}
                  className="font-mono text-xs font-semibold text-accent hover:underline cursor-pointer"
                >
                  {t.adjustReset}
                </button>
              )}
            </div>

            {/* Scale Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="scale-slider" className="text-text font-semibold cursor-pointer">
                  {t.adjustScale}
                </label>
                <span className="font-mono text-[#4B525D] font-bold">
                  {scalePercent > 0 ? `+${scalePercent}%` : `${scalePercent}%`}
                </span>
              </div>
              <input
                id="scale-slider"
                type="range"
                min="-10"
                max="10"
                step="1"
                value={scalePercent}
                onChange={handleScaleChange}
                aria-valuemin="-10"
                aria-valuemax="10"
                aria-valuenow={scalePercent}
                aria-label={t.adjustScale}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            {/* Shift Y Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="shifty-slider" className="text-text font-semibold cursor-pointer">
                  {t.adjustShiftY}
                </label>
                <span className="font-mono text-[#4B525D] font-bold">
                  {shiftYPercent > 0 ? `+${shiftYPercent}%` : `${shiftYPercent}%`}
                </span>
              </div>
              <input
                id="shifty-slider"
                type="range"
                min="-10"
                max="10"
                step="1"
                value={shiftYPercent}
                onChange={handleShiftYChange}
                aria-valuemin="-10"
                aria-valuemax="10"
                aria-valuenow={shiftYPercent}
                aria-label={t.adjustShiftY}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Automated & Manual Checks */}
        <div className="lg:col-span-6 space-y-5">
          {/* Automated Checks */}
          <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
            <h3 className="font-heading font-extrabold text-sm text-text mb-4 pb-2 border-b border-border/60">
              {t.checksTitle}
            </h3>

            {checks.length === 0 ? (
              <p className="text-[#4B525D] text-xs">
                {lang === 'ru' ? 'Выполняется проверка параметров...' : 'Параметрлер тексерілуде...'}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {checks.map((chk) => (
                  <li
                    key={chk.id}
                    className="flex items-start justify-between gap-3 text-xs pb-2 border-b border-border/40 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0" aria-hidden="true">
                        {chk.ok ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-emerald-700">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-700">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.8" />
                            <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                          </svg>
                        )}
                      </span>
                      <span className={chk.ok ? 'text-text font-medium' : 'text-amber-950 font-bold'}>
                        {chk.message?.[lang] || t[chk.key] || chk.id}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        chk.ok
                          ? 'bg-emerald-100 text-emerald-950'
                          : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {chk.ok ? t.checkStatusOk : t.checkStatusWarn}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manual Visual Checklist */}
          <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
            <h3 className="font-heading font-extrabold text-sm text-text mb-4 pb-2 border-b border-border/60 flex items-center justify-between">
              <span>{lang === 'ru' ? 'Визуальный контроль' : 'Көзбен тексеру'}</span>
              <span className="font-mono text-xs text-[#4B525D] font-bold">
                {t.checkStatusManual}
              </span>
            </h3>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2 text-[#4B525D] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                <span>{t.manualGlasses}</span>
              </li>
              <li className="flex items-center gap-2 text-[#4B525D] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                <span>{t.manualMouth}</span>
              </li>
              <li className="flex items-center gap-2 text-[#4B525D] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                <span>{t.manualShadows}</span>
              </li>
              <li className="flex items-center gap-2 text-[#4B525D] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                <span>{t.manualBg}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
