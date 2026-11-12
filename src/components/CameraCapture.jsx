import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'

export default function CameraCapture({ onClose, onCapture, onSelectFile }) {
  const { t } = useLang()
  const videoRef = useRef(null)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const streamRef = useRef(null)
  const generation = useRef(0)

  const [isLoading, setIsLoading] = useState(true)
  const [errorType, setErrorType] = useState(null)
  const [camera, setCamera] = useState(null)
  const [nextCamera, setNextCamera] = useState(null)
  const [mirrored, setMirrored] = useState(true)
  const [countdown, setCountdown] = useState(null)
  const [encoding, setEncoding] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    closeRef.current.focus()
    return () => dialog.close()
  }, [])

  useEffect(() => {
    const id = ++generation.current
    const video = videoRef.current
    let stream
    let track
    let permission
    const current = () => id === generation.current
    const stop = () => {
      track?.removeEventListener('ended', onEnded)
      permission?.removeEventListener('change', onPermission)
      stream?.getTracks().forEach((item) => item.stop())
      streamRef.current = null
      video.srcObject = null
    }
    const fail = (error) => {
      if (!current()) return
      generation.current++
      stop()
      setCountdown(null)
      setEncoding(false)
      setIsLoading(false)
      setErrorType(error)
      closeRef.current?.focus()
    }
    const onEnded = () => fail('NotReadableError')
    const onPermission = () => {
      if (permission.state === 'denied') fail('NotAllowedError')
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(camera ? { deviceId: { exact: camera } } : { facingMode: 'user' }),
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (!current()) {
          stream.getTracks().forEach((item) => item.stop())
          return
        }

        track = stream.getVideoTracks()[0]
        if (!track || track.readyState !== 'live') return onEnded()
        track.addEventListener('ended', onEnded)
        streamRef.current = stream
        video.srcObject = stream
        await video.play()
        if (!current()) return

        const settings = track.getSettings()
        setMirrored(settings.facingMode ? settings.facingMode === 'user' : !camera)
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        if (!current()) return
        const activeDevice = settings.deviceId || camera || devices.find((device) => device.kind === 'videoinput')?.deviceId
        setNextCamera(devices.find((device) =>
          device.kind === 'videoinput' && device.deviceId && device.deviceId !== activeDevice
        )?.deviceId ?? null)
        setIsLoading(false)

        permission = await navigator.permissions?.query({ name: 'camera' }).catch(() => null)
        if (current() && permission) {
          permission.addEventListener('change', onPermission)
          onPermission()
        }
      } catch (error) {
        fail(error.name)
      }
    }

    start()
    return () => {
      generation.current++
      stop()
    }
  }, [camera])

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }

    setCountdown(null)
    setEncoding(true)
    const id = generation.current
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const finish = (blob) => {
      if (id !== generation.current) return
      if (!blob) {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        video.srcObject = null
        setErrorType('NotReadableError')
        setEncoding(false)
        closeRef.current?.focus()
        return
      }
      onCapture(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }))
    }

    try {
      canvas.getContext('2d').drawImage(video, 0, 0)
      canvas.toBlob(finish, 'image/jpeg', 0.95)
    } catch {
      finish(null)
    }
  }, [countdown, onCapture])

  const dismiss = () => {
    dialogRef.current.close()
    onClose()
  }

  const toggleCamera = () => {
    setIsLoading(true)
    setCamera(nextCamera)
    closeRef.current?.focus()
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const buttons = dialogRef.current.querySelectorAll('button:not(:disabled)')
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Error content resolution
  const errorTitle =
    errorType === 'NotAllowedError'
      ? t.cameraErrNotAllowedTitle
      : errorType === 'NotFoundError'
      ? t.cameraErrNotFoundTitle
      : errorType === 'NotReadableError'
      ? t.cameraErrNotReadableTitle
      : t.cameraErrGenericTitle

  const errorDesc =
    errorType === 'NotAllowedError'
      ? t.cameraErrNotAllowedDesc
      : errorType === 'NotFoundError'
      ? t.cameraErrNotFoundDesc
      : errorType === 'NotReadableError'
      ? t.cameraErrNotReadableDesc
      : t.cameraErrGenericDesc

  const countdownText =
    countdown !== null && countdown > 0
      ? t.cameraCountdown.replace('{sec}', countdown)
      : ''

  return (
    <dialog
      aria-labelledby="camera-modal-title"
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      className="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-lg max-h-[calc(100dvh-1.5rem)] rounded-2xl bg-card text-text overflow-y-auto backdrop:bg-black/80 backdrop:backdrop-blur-xs"
    >
      {/* Screen reader live region for countdown */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {countdownText}
      </div>

      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-bg/50">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              className="text-accent"
              aria-hidden="true"
            >
              <path
                d="M3 6C3 4.89543 3.89543 4 5 4H6.5L7.8 2.5H12.2L13.5 4H15C16.1046 4 17 4.89543 17 6V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V6Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <h2
              id="camera-modal-title"
              className="font-heading font-extrabold text-sm sm:text-base text-text"
            >
              {t.cameraModalTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={dismiss}
            ref={closeRef}
            aria-label={t.cameraClose}
            className="size-11 shrink-0 rounded-lg flex items-center justify-center text-[#4B525D] hover:text-text hover:bg-border/60 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5L15 15M5 15L15 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="relative bg-black aspect-3/4 sm:aspect-4/3 flex items-center justify-center overflow-hidden">
          {/* Live Video (Mirrored in CSS only for selfie/user camera) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-300 ${mirrored ? '-scale-x-100' : ''} ${
              isLoading || errorType ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Loading state */}
          {isLoading && !errorType && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/90 z-10">
              <svg
                className="animate-spin h-8 w-8 text-accent"
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
              <span className="text-xs font-mono font-medium tracking-wide">
                {t.cameraStarting}
              </span>
            </div>
          )}

          {/* Error State */}
          {errorType && (
            <div
              role="alert"
              className="absolute inset-0 p-6 grid place-items-center overflow-y-auto text-center bg-card text-text z-20"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 9V14M12 17.5V18M12 3L2 21H22L12 3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h3 className="font-heading font-extrabold text-base text-text mb-1">
                {errorTitle}
              </h3>
              <p className="text-xs sm:text-sm text-[#4B525D] max-w-sm mb-6 leading-relaxed">
                {errorDesc}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => {
                    dismiss()
                    onSelectFile?.()
                  }}
                  className="flex-1 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-semibold min-h-11 py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  {t.btnChooseFile}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex-1 border border-border text-text hover:bg-bg/60 text-xs sm:text-sm font-semibold min-h-11 py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                >
                  {t.cameraClose}
                </button>
              </div>
            </div>
          )}

          {/* Guidelines Overlay (Head Oval & Eye Level) */}
          {!isLoading && !errorType && (
            <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center">
              {/* Top Hint */}
              <div className="absolute top-3 inset-x-3 flex justify-center">
                <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-3 py-1 rounded-full border border-white/20 text-center shadow-xs">
                  {t.cameraGuideOval}
                </span>
              </div>

              {/* Head Outline Oval Guide */}
              <div className="relative w-52 h-72 sm:w-60 sm:h-80 border-2 border-dashed border-white/80 rounded-[50%/42%] flex flex-col justify-center items-center shadow-[0_0_0_9999px_rgba(0,0,0,0.30)]">
                {/* Eye level guideline across upper portion */}
                <div className="absolute top-[42%] inset-x-[-12%] flex items-center">
                  <div className="flex-1 border-t-2 border-dashed border-emerald-400/90" />
                  <span className="bg-emerald-950/80 text-emerald-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/60 leading-none">
                    {t.cameraEyeLine}
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-emerald-400/90" />
                </div>
              </div>
            </div>
          )}

          {/* Countdown display over video */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-20">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-accent text-white flex items-center justify-center font-heading font-extrabold text-5xl sm:text-6xl shadow-2xl animate-pulse">
                {countdown}
              </div>
            </div>
          )}
        </div>

        {/* Controls Footer */}
        {!errorType && (
          <div className="p-4 sm:p-5 bg-card border-t border-border/80 flex items-center justify-between gap-2 sm:gap-4">
            {/* Camera switch button (visible if > 1 camera) */}
            <div className="w-12 flex justify-start">
              {nextCamera && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={isLoading || encoding || countdown !== null}
                  title={t.cameraSwitch}
                  aria-label={t.cameraSwitch}
                  className="size-11 rounded-full border border-border bg-bg hover:bg-border/60 text-text flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.21 0.895 4.21 2.343 5.657L4 18h6v-6l-2.343 2.343A5.98 5.98 0 0 1 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6c-1.328 0-2.553-0.432-3.536-1.164" />
                  </svg>
                </button>
              )}
            </div>

            {/* Main Action: Shoot with 3-2-1 Countdown or Cancel */}
            <div className="flex-1 flex justify-center">
              {countdown !== null ? (
                <button
                  type="button"
                  onClick={() => setCountdown(null)}
                  className="inline-flex items-center gap-2 bg-amber-800 hover:bg-amber-900 text-white font-heading font-bold text-sm min-h-11 px-4 py-2.5 rounded-full transition-colors cursor-pointer shadow-md"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M5 5L15 15M5 15L15 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{t.cameraCancelCountdown}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCountdown(3)}
                  disabled={isLoading || encoding}
                  className="group inline-flex items-center gap-2.5 bg-accent hover:bg-accent-hover text-white font-heading font-extrabold text-sm sm:text-base px-3 sm:px-7 min-h-11 py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-white group-hover:scale-110 transition-transform" />
                  <span>{t.cameraShoot}</span>
                </button>
              )}
            </div>

            {/* Secondary fallback: Pick file */}
            <div className="w-12 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  dismiss()
                  onSelectFile?.()
                }}
                title={t.btnChooseFile}
                aria-label={t.btnChooseFile}
                className="size-11 rounded-full border border-border bg-bg hover:bg-border/60 text-[#4B525D] hover:text-text flex items-center justify-center transition-colors cursor-pointer"
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
              </button>
            </div>
          </div>
        )}
        <p className="px-4 py-3 text-center text-xs text-muted">{t.cameraPrivacy}</p>
      </div>
    </dialog>
  )
}
