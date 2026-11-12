import { useState, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import CameraCapture from './CameraCapture'
import { photoMimeTypes } from '../lib/photo'

function TipIcon({ type }) {
  if (type === 'wall') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-accent shrink-0" aria-hidden="true">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="2" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="7" y1="8" x2="7" y2="13" stroke="currentColor" strokeWidth="1.2" />
        <line x1="13" y1="3" x2="13" y2="8" stroke="currentColor" strokeWidth="1.2" />
        <line x1="12" y1="13" x2="12" y2="17" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }
  if (type === 'sun') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-accent shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (type === 'camera') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-accent shrink-0" aria-hidden="true">
        <path
          d="M3 6C3 4.89543 3.89543 4 5 4H6.5L7.8 2.5H12.2L13.5 4H15C16.1046 4 17 4.89543 17 6V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V6Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  if (type === 'distance') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-accent shrink-0" aria-hidden="true">
        <circle cx="6" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.5 10H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  // greencard
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-emerald-accent shrink-0" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 14.5C6 13 7.8 12 10 12C12.2 12 14 13 14 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Step1Photo() {
  const { t } = useLang()
  const { isProcessing, statusKey, errorKey, handleFile } = useWizard()

  const [isDragging, setIsDragging] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)

  const inputRef = useRef(null)
  const cameraBtnRef = useRef(null)

  const hasCameraSupport =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const onDragOver = (e) => {
    e.preventDefault()
    if (!isProcessing) setIsDragging(true)
  }

  const onDragLeave = () => {
    setIsDragging(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!isProcessing) handleFile(file)
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!isProcessing) handleFile(file)
    e.target.value = ''
  }

  const triggerInput = () => {
    if (!isProcessing) inputRef.current?.click()
  }

  const handleCameraClose = () => {
    setIsCameraOpen(false)
    cameraBtnRef.current?.focus()
  }

  const handleCameraCapture = (file) => {
    setIsCameraOpen(false)
    handleFile(file)
  }

  const resolvedErrorMessage = errorKey ? t[errorKey] || errorKey : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-14">
      {/* Title & Subtitle */}
      <div className="text-center mb-8">
        <h1 tabIndex={-1} className="font-heading font-extrabold text-2xl sm:text-3xl text-text-main mb-2 tracking-tight">
          {t.step1Title}
        </h1>
        <p className="text-text-muted text-sm sm:text-base max-w-lg mx-auto">
          {t.step1Subtitle}
        </p>
      </div>

      {/* Upload Zone (drop & click zone) */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={triggerInput}
        className={`bg-white border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-emerald-accent bg-emerald-accent/5'
            : 'border-grid-border hover:border-emerald-accent/50'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={photoMimeTypes.join(',')}
          className="hidden"
          onChange={onFileChange}
        />

        <div className="w-14 h-14 rounded-full bg-emerald-accent/10 mx-auto mb-5 flex items-center justify-center text-emerald-accent" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V8M12 8L9 11M12 8L15 11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          {hasCameraSupport && (
            <button
              ref={cameraBtnRef}
              disabled={isProcessing}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsCameraOpen(true)
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-accent hover:bg-emerald-accent-hover text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 6C3 4.89543 3.89543 4 5 4H6.5L7.8 2.5H12.2L13.5 4H15C16.1046 4 17 4.89543 17 6V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V6Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>{t.btnShootCamera}</span>
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation()
              triggerInput()
            }}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-lg transition-colors shadow-2xs cursor-pointer ${
              hasCameraSupport
                ? 'bg-white hover:bg-paper/80 text-text-main border border-grid-border hover:border-emerald-accent/60'
                : 'bg-emerald-accent hover:bg-emerald-accent-hover text-white shadow-sm'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 16V8M12 8L9 11M12 8L15 11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>{t.btnChooseFile}</span>
          </button>
        </div>

        <p className="text-text-muted text-xs sm:text-sm mb-1">{t.uploadOr} {t.uploadDrag.toLowerCase()}</p>
        <p className="font-mono text-xs text-text-muted">{t.uploadHint}</p>
      </div>
      <p className="mt-3 text-center text-xs text-text-muted">{t.photoPrivacy}</p>

      {/* Processing Status Spinner */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 p-4 rounded-xl bg-emerald-accent/10 border border-emerald-accent/20 flex items-center justify-center gap-3 text-text-main"
        >
          <svg
            className="animate-spin h-5 w-5 text-emerald-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-semibold text-text-main">{t[statusKey]}</span>
        </div>
      )}

      {/* Error Message with role="alert" */}
      {resolvedErrorMessage && !isProcessing && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-600/30 text-amber-950 flex items-start gap-3"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="text-amber-700 shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <path
              d="M10 2L1 18H19L10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="15" r="0.75" fill="currentColor" />
          </svg>
          <div className="text-sm">
            <p className="font-bold text-amber-950 mb-0.5">{resolvedErrorMessage}</p>
            {errorKey === 'errNoFace' && (
              <p className="text-xs text-amber-900 font-medium">
                {t.errNoFaceHint}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Tips: "Как снять" */}
      <div className="mt-8 border border-grid-border rounded-xl bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setTipsOpen(!tipsOpen)}
          aria-expanded={tipsOpen}
          aria-controls="how-to-shoot-content"
          className="w-full min-h-11 flex items-center justify-between p-4 text-left cursor-pointer hover:bg-paper/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-emerald-accent uppercase font-bold" aria-hidden="true">
              [ ? ]
            </span>
            <span className="font-heading font-extrabold text-sm text-text-main">
              {t.tipsToggle}
            </span>
          </div>
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={`text-text-muted transition-transform duration-200 ${tipsOpen ? 'rotate-180' : ''}`}
          >
            <path
              d="M5 8L10 13L15 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div id="how-to-shoot-content" hidden={!tipsOpen}>
          <div className="p-4 pt-1 border-t border-grid-border/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {t.howToShootTips.map((tip) => (
              <div
                key={tip.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-paper/60 border border-grid-border/60"
              >
                <TipIcon type={tip.icon} />
                <div>
                  <h2 className="font-heading font-extrabold text-xs text-text-main mb-0.5">
                    {tip.title}
                  </h2>
                  <p className="text-text-muted text-xs leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isCameraOpen && (
        <CameraCapture
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          onSelectFile={triggerInput}
        />
      )}
    </div>
  )
}
