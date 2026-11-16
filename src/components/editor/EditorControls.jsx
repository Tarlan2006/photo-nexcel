import { initialView, maxZoom, zoomView } from '../../lib/editor/viewport'

const button = 'min-h-11 min-w-11 rounded-lg px-3 py-2 text-sm font-semibold [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButton = button + ' border border-grid-border bg-white hover:border-emerald-accent hover:text-emerald-accent'
export const primaryButton = button + ' bg-emerald-accent text-white hover:bg-emerald-accent-hover'
const zoomButton = 'min-h-11 min-w-0 rounded-lg border border-grid-border bg-white px-1 text-sm font-semibold hover:border-emerald-accent disabled:opacity-50'

export function BrushControls({ brush, text }) {
  const { view, onViewChange } = brush
  const resize = (ratio) => onViewChange(zoomView(view, view.scale * ratio))
  const zoomPercent = Math.round(view.scale * 100) + '%'

  return (
    <div className="space-y-2">
      <p id="editor-brush-instructions" className="text-xs text-text-muted">{text.brushHelp}</p>
      <div className="grid grid-cols-2 gap-1 sm:gap-2">
        {['erase', 'restore'].map(mode => (
          <button
            key={mode}
            type="button"
            aria-pressed={brush.mode === mode && !brush.pan}
            className={brush.mode === mode && !brush.pan ? primaryButton : secondaryButton}
            onClick={() => brush.onChange({ mode, pan: false })}
          >
            {mode === 'erase' ? text.brushErase : text.brushRestore}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={brush.original}
        className={brush.original ? primaryButton : secondaryButton}
        onClick={() => brush.onChange({ original: !brush.original })}
      >
        {text.brushOriginal}
      </button>
      <div role="group" aria-label={text.brushZoom} className="grid grid-cols-[1fr_1.2fr_1fr] gap-1 sm:gap-2">
        <button type="button" aria-label={text.zoomOut} className={zoomButton} disabled={view.scale === 1} onClick={() => resize(1 / 1.4)}>−</button>
        <button type="button" aria-label={`${zoomPercent}, ${text.zoomReset}`} className={zoomButton} disabled={view.scale === 1} onClick={() => onViewChange(initialView)}>
          {zoomPercent}
        </button>
        <button type="button" aria-label={text.zoomIn} className={zoomButton} disabled={view.scale === maxZoom} onClick={() => resize(1.4)}>+</button>
      </div>
      <button
        type="button"
        aria-pressed={brush.pan}
        className={brush.pan ? primaryButton : secondaryButton}
        onClick={() => brush.onChange({ pan: !brush.pan })}
      >
        {text.brushPan}
      </button>
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
      </div>
    </div>
  )
}
