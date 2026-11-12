import { useEffect, useRef, useState } from 'react'
import { hasPhotoEdits } from '../../lib/editor/edit-state'
import { scaledSize } from '../../lib/editor/pixels'
import { viewTransform } from '../../lib/editor/viewport'
import ContourLayer from './ContourLayer'
import BrushLayer from './BrushLayer'

export default function EditorPreview({ original, edit, getSession, showMask, draft, setDraft, cancelOutline, brush, compare, text }) {
  const originalRef = useRef(null)
  const editedRef = useRef(null)
  const [painted, setPainted] = useState(false)
  const [working, setWorking] = useState(false)
  const [previewError, setPreviewError] = useState(false)
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

  const showEdited = hasEdits && painted && !compare.holding && !draft && !brush?.original
  const split = showEdited && compare.split && !showMask && !brush
  const ratio = width / height

  return (
    <div className="min-w-0 rounded-xl border border-grid-border bg-white p-1.5 sm:p-3">
      <div
        className="relative mx-auto max-w-full overflow-hidden rounded-lg bg-paper"
        style={{
          width: 'min(100%, ' + Math.round(500 * ratio) + 'px, calc((var(--editor-room) - 2.75rem) * ' + ratio + '))',
          aspectRatio: width + '/' + height,
        }}
        aria-busy={working}
      >
        <div className="absolute inset-0 origin-top-left" style={brush ? { transform: viewTransform(brush.view) } : undefined}>
          <canvas
            ref={originalRef}
            width={width}
            height={height}
            className={showEdited && !split ? 'invisible block size-full' : 'block size-full'}
            role="img"
            aria-label={text.original}
          />
          <canvas
            ref={editedRef}
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0 size-full"
            hidden={!showEdited}
            style={split ? { clipPath: 'inset(0 0 0 ' + compare.splitPosition + '%)' } : undefined}
            role="img"
            aria-label={showMask ? text.mask : text.edited}
          />
          {split && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm" style={{ left: compare.splitPosition + '%' }} />}
        </div>
        {draft && <ContourLayer draft={draft} updateDraft={setDraft} cancel={cancelOutline} text={text} />}
        {brush && (
          <BrushLayer
            width={width}
            height={height}
            brush={brush}
            view={brush.view}
            onViewChange={brush.onViewChange}
            onStroke={brush.onStroke}
            onClose={brush.onClose}
            text={text}
          />
        )}
      </div>
      <p role="status" className={working ? 'mt-2 text-xs text-text-muted' : 'sr-only'}>{working ? text.processing : ''}</p>
      {previewError && <p role="alert" className="mt-2 text-xs text-amber-950">{text.processingError}</p>}
    </div>
  )
}
