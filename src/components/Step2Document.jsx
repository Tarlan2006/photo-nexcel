import { useEffect, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { presetList } from '../presets'

function IdCardIcon({ className }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="7" width="26" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 22C7 19.791 9.239 18 12 18C14.761 18 17 19.791 17 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="13" x2="27" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="17" x2="25" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GreenCardIcon({ className }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="24" height="22" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 25C8 21.134 11.582 18 16 18C20.418 18 24 21.134 24 25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 7L24 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const iconMap = {
  kz_id: IdCardIcon,
  dv: GreenCardIcon,
}

function MiniCanvasPreview({ cropRes, preset }) {
  const { t } = useLang()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !cropRes?.canvas || !cropRes.success) return

    const canvas = canvasRef.current
    canvas.width = cropRes.width
    canvas.height = cropRes.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(cropRes.canvas, 0, 0)
  }, [cropRes])

  if (!cropRes || !cropRes.success) {
    return (
      <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-lg bg-amber-50 border border-dashed border-amber-400 flex flex-col items-center justify-center p-2 text-center shrink-0">
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="text-amber-700 mb-1" aria-hidden="true">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="6" x2="10" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="14" r="0.75" fill="currentColor" />
        </svg>
        <span className="text-[11px] text-amber-950 leading-tight font-bold">
          {t.outOfFrame}
        </span>
      </div>
    )
  }

  const isKz = preset.id === 'kz_id'

  return (
    <div
      className={`rounded-lg overflow-hidden border border-border/80 bg-white shadow-2xs shrink-0 flex items-center justify-center ${
        isKz ? 'w-24 h-31 sm:w-28 sm:h-36' : 'w-28 h-28 sm:w-32 sm:h-32'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover block"
      />
    </div>
  )
}

export default function Step2Document() {
  const { t, lang } = useLang()
  const {
    selectedPresetId,
    selectPreset,
    cropStates,
    retake,
    goToStep,
  } = useWizard()

  const handleSelectAndProceed = (presetId) => {
    selectPreset(presetId)
    goToStep(3)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 pb-28">
      {/* Title & Subtitle */}
      <div className="text-center mb-8">
        <h1 tabIndex={-1} className="font-heading font-extrabold text-2xl sm:text-3xl text-text mb-2 tracking-tight">
          {t.step2Title}
        </h1>
        <p className="text-[#4B525D] text-sm sm:text-base max-w-lg mx-auto">
          {t.step2Subtitle}
        </p>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" role="group" aria-label={t.step2Title}>
        {presetList.map((preset) => {
          const isSelected = selectedPresetId === preset.id
          const cropRes = cropStates[preset.id]
          const isOutOfBounds = !cropRes || !cropRes.success
          const Icon = iconMap[preset.id]

          return (
            <div
              key={preset.id}
              className={`bg-card border rounded-xl p-5 text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'border-accent ring-2 ring-accent/30 bg-accent/[0.01]'
                  : 'border-border hover:border-accent/50'
              }`}
            >
              <div>
                {/* Header of Card */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-accent/10 text-accent' : 'bg-bg text-[#4B525D]'
                      }`}
                    >
                      <Icon />
                    </div>
                    <div>
                      <label htmlFor={preset.id} className="block cursor-pointer font-heading font-extrabold text-base text-text">
                        {preset.name[lang]}
                      </label>
                      <p className="text-muted text-xs font-mono">
                        {t.dimensionsAndLimit.replace('{w}', preset.width).replace('{h}', preset.height).replace('{max}', preset.maxKb)}
                      </p>
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="photo-document"
                    id={preset.id}
                    checked={isSelected}
                    onChange={() => selectPreset(preset.id)}
                    className="size-11 shrink-0 cursor-pointer accent-accent"
                  />
                </div>

                {/* Body with Mini-Preview and Details */}
                <div className="flex flex-col min-[420px]:flex-row items-start gap-4 mb-4">
                  <MiniCanvasPreview cropRes={cropRes} preset={preset} />

                  <div className="flex-1 min-w-0">
                    {isOutOfBounds ? (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 mb-3" role="alert">
                        <p className="text-amber-950 text-xs font-bold mb-2">
                          {t.outOfBoundsCard}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            retake()
                          }}
                          className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-amber-400 text-amber-950 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                              d="M2 8C2 4.68629 4.68629 2 8 2C10.0526 2 11.8703 3.03057 12.9649 4.60742M14 8C14 11.3137 11.3137 14 8 14C5.94744 14 4.12968 12.9694 3.03507 11.3926"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path d="M13 2V5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>{t.btnRetake}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-950 mb-2">
                          ✓ {t.cropReady}
                        </span>
                        <p className="text-[#4B525D] text-xs font-medium">
                          {t.headEstimate
                            .replace('{percent}', cropRes.headPct)
                            .replace('{range}', [preset.headMinPct, preset.headMaxPct].join('–'))}
                        </p>
                      </div>
                    )}

                    {/* Requirements summary */}
                    <ul className="space-y-1 text-[#4B525D] text-xs">
                      {preset.rules[lang].slice(0, 2).map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-1 font-medium">
                          <span className="text-accent shrink-0 font-bold">·</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Button inside card */}
              <div className="pt-3 border-t border-border/40 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectAndProceed(preset.id)
                  }}
                  className={`min-h-11 text-xs font-semibold px-4 py-2 rounded transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'border border-border text-text hover:border-accent hover:text-accent'
                  }`}
                >
                  {t.selectAndContinue} →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
