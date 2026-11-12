import { useEffect, useRef, useState } from 'react'
import { hasClosedArea, hasPhotoEdits } from '../../lib/editor/edit-state'
import { scaledSize } from '../../lib/editor/pixels'
import ContourLayer from './ContourLayer'
import BrushLayer from './BrushLayer'

export const secondaryButton = 'min-h-11 min-w-11 rounded-lg border border-grid-border bg-white px-3 py-2 text-sm font-semibold hover:border-emerald-accent hover:text-emerald-accent disabled:cursor-not-allowed disabled:opacity-50'
export const primaryButton = 'min-h-11 min-w-11 rounded-lg bg-emerald-accent px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-accent-hover disabled:cursor-not-allowed disabled:opacity-50'

export default function EditorPreview({ original, edit, getSession, showMask, draft, setDraft, applyOutline, cancelOutline, brush, text }) {
  const originalRef = useRef(null)
  const editedRef = useRef(null)
  const [painted, setPainted] = useState(false)
  const [working, setWorking] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [holding, setHolding] = useState(false)
  const [split, setSplit] = useState(false)
  const [splitPosition, setSplitPosition] = useState(50)
  const { width, height } = scaledSize(original.width, original.height, 800)
  const hasEdits = hasPhotoEdits(edit)

  useEffect(() => {
    const context = originalRef.current.getContext('2d')
    context.imageSmoothingQuality = 'high'
    context.drawImage(original, 0, 0, width, height)
  }, [original, width, height])

  useEffect(() => {
    setPreviewError(false)
    setWorking(false)
    if (!hasEdits) {
      setPainted(false)
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      if (!active) return
      setWorking(true)
      let bitmap
      try {
        const session = await getSession()
        if (!active) return
        bitmap = await session.render({ edit, preview: true, showMask })
        if (!active) return
        const canvas = editedRef.current
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0)
        setPainted(true)
      } catch {
        if (active) {
          setPainted(false)
          setPreviewError(true)
        }
      } finally {
        bitmap?.close()
        if (active) setWorking(false)
      }
    }, 75)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [edit, hasEdits, getSession, showMask])

  const showEdited = hasEdits && painted && !holding && !draft && !brush?.original
  const compare = showEdited && split && !showMask && !brush

  return (
    <div className="min-w-0">
      <div className="rounded-xl border border-grid-border bg-white p-3 sm:p-4">
        <div
          className="relative mx-auto max-w-full overflow-hidden rounded-lg bg-paper"
          style={{ width: Math.round(500 * width / height), aspectRatio: width + '/' + height }}
          aria-busy={working}
        >
          <canvas
            ref={originalRef}
            width={width}
            height={height}
            className={showEdited && !compare ? 'invisible block size-full' : 'block size-full'}
            role="img"
            aria-label={text.original}
          />
          <canvas
            ref={editedRef}
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0 size-full"
            hidden={!showEdited}
            style={compare ? { clipPath: 'inset(0 0 0 ' + splitPosition + '%)' } : undefined}
            role="img"
            aria-label={showMask ? text.mask : text.edited}
          />
          {compare && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm" style={{ left: splitPosition + '%' }} />}
          {draft && <ContourLayer draft={draft} updateDraft={setDraft} cancel={cancelOutline} text={text} />}
          {brush && <BrushLayer width={width} height={height} brush={brush} onStroke={brush.onStroke} onClose={brush.onClose} text={text} />}
        </div>

        {draft ? (
          <div className="mt-3 space-y-2">
            <p id="editor-draw-instructions" className="text-sm text-text-muted">{text.drawHelp}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButton} onClick={applyOutline} disabled={!hasClosedArea(draft.points)}>{text.applyOutline}</button>
              <button type="button" className={secondaryButton} onClick={() => setDraft((current) => ({ ...current, points: [] }))} disabled={!draft.points.length}>{text.clearOutline}</button>
              <button type="button" className={secondaryButton} onClick={cancelOutline}>{text.cancel}</button>
            </div>
          </div>
        ) : brush ? (
          <div className="mt-3 space-y-2" role="group" aria-label={text.brush}>
            <p id="editor-brush-instructions" className="text-xs text-text-muted">{text.brushHelp}</p>
            <div className="flex flex-wrap gap-2">
              {['erase', 'restore'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={brush.mode === mode}
                  className={brush.mode === mode ? primaryButton : secondaryButton}
                  onClick={() => brush.onChange({ mode })}
                >
                  {mode === 'erase' ? text.brushErase : text.brushRestore}
                </button>
              ))}
              <button type="button" aria-pressed={brush.original} className={secondaryButton} onClick={() => brush.onChange({ original: !brush.original })}>
                {text.brushOriginal}
              </button>
            </div>
            <label className="block text-sm font-medium">
              {text.brushSize} <span aria-hidden="true" className="ml-1 font-mono text-xs text-text-muted">{brush.size}%</span>
              <input
                type="range"
                min="1"
                max="20"
                value={brush.size}
                aria-valuetext={brush.size + '%'}
                onChange={event => brush.onChange({ size: Number(event.target.value) })}
                className="block min-h-11 w-full accent-emerald-accent"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} onClick={brush.onUndo} disabled={!brush.canUndo}>{text.undo}</button>
              <button type="button" className={secondaryButton} onClick={brush.onRedo} disabled={!brush.canRedo}>{text.redo}</button>
              <button type="button" className={secondaryButton} onClick={brush.onClose}>{text.brushDone}</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={!painted || !hasEdits || showMask}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setHolding(true)
              }}
              onLostPointerCapture={() => setHolding(false)}
              onPointerUp={() => setHolding(false)}
              onPointerCancel={() => setHolding(false)}
              onBlur={() => setHolding(false)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') setHolding(true)
              }}
              onKeyUp={() => setHolding(false)}
            >
              {text.holdBefore}
            </button>
            <button type="button" className={secondaryButton} aria-pressed={split} disabled={!painted || !hasEdits || showMask} onClick={() => setSplit((value) => !value)}>
              {text.split}
            </button>
          </div>
        )}

        {compare && (
          <label className="mt-2 block text-sm font-medium">
            {text.splitPosition}
            <input type="range" min="10" max="90" value={splitPosition} onChange={(event) => setSplitPosition(Number(event.target.value))} className="block min-h-11 w-full accent-emerald-accent" />
          </label>
        )}
        <p role="status" className={working ? 'mt-2 text-sm text-text-muted' : 'sr-only'}>{working ? text.processing : ''}</p>
        {previewError && <p role="alert" className="mt-2 text-sm text-amber-950">{text.processingError}</p>}
      </div>
    </div>
  )
}
