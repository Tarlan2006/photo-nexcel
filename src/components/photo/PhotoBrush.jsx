import { useEffect, useState } from 'react'
import { previewPhotoBackground } from '../../lib/photo-pipeline'
import { initialView, viewTransform } from '../../lib/editor/viewport'
import BrushLayer from '../editor/BrushLayer'
import { BrushControls, primaryButton } from '../editor/EditorControls'
import PhotoCanvas from './PhotoCanvas'

export default function PhotoBrush({ source, settings, text, copy, onApply, onClose, busy }) {
  const [brush, changeBrush] = useState({ mode: 'erase', size: 5, pan: false, original: false })
  const [view, setView] = useState(initialView)
  const [strokes, setStrokes] = useState(settings.strokes)
  const [redo, setRedo] = useState([])
  const [bitmap, setBitmap] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    previewPhotoBackground(source, { ...settings, strokes }).then(image => {
      if (!active) return image.close()
      setBitmap(image)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [source, settings, strokes])
  useEffect(() => () => bitmap?.close(), [bitmap])

  function onStroke(stroke) {
    setRedo([])
    setStrokes(current => [...current, { ...stroke, id: crypto.randomUUID() }])
  }
  const controls = {
    ...brush, view, onViewChange: setView,
    onChange: patch => changeBrush(current => ({ ...current, ...patch })),
    canUndo: strokes.length > settings.strokes.length,
    canRedo: Boolean(redo.length),
    onUndo: () => {
      setRedo([strokes.at(-1), ...redo])
      setStrokes(strokes.slice(0, -1))
    },
    onRedo: () => {
      setStrokes([...strokes, redo[0]])
      setRedo(redo.slice(1))
    },
  }
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row">
      {bitmap ? (
        <div className="relative overflow-hidden rounded-lg">
          <PhotoCanvas bitmap={brush.original ? source.bitmap : bitmap} label={brush.original ? text.original : text.edited}
            limit={800} style={{ transform: viewTransform(view) }}
            className="block h-auto max-h-80 w-auto max-w-full origin-top-left" />
          <BrushLayer width={bitmap.width} height={bitmap.height} brush={brush} view={view} onViewChange={setView}
            onStroke={onStroke} onClose={onClose} text={text} />
        </div>
      ) : <p role={failed ? 'alert' : 'status'} className="text-sm text-text-muted">{failed ? copy.processingError : text.processing}</p>}
      <div className="min-w-0 flex-1 space-y-3">
        {bitmap && <BrushControls brush={controls} text={text} />}
        <button type="button" className={primaryButton} disabled={busy || strokes === settings.strokes}
          onClick={() => onApply(strokes)}>{copy.applyBrush}</button>
      </div>
    </div>
  )
}
