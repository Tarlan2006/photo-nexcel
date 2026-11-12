import { useEffect, useId, useRef, useState } from 'react'
import { backgroundColors } from '../../lib/editor/edit-state'
import { suitStyles } from '../../lib/editor/suits'
import { primaryButton, secondaryButton } from './EditorPreview'

const toneSliders = ['brightness', 'contrast', 'temperature', 'saturation']
const filters = ['none', 'soft', 'sharp', 'mono']

function Range({ name, label, value, min, max, reset = 0, onChange, text }) {
  const id = useId()
  const gesture = useRef(null)
  const changeNumber = useRef(0)
  const valueText = text.value.replace('{value}', value > 0 ? '+' + value : value)
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <span aria-hidden="true" className="font-mono text-xs text-text-muted">{value > 0 ? '+' + value : value}</span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={valueText}
        onPointerDown={() => { gesture.current = id + '-' + ++changeNumber.current }}
        onPointerUp={() => { gesture.current = null }}
        onPointerCancel={() => { gesture.current = null }}
        onBlur={() => { gesture.current = null }}
        onChange={(event) => onChange(Number(event.target.value), gesture.current)}
        onDoubleClick={() => onChange(reset, null)}
        className="block min-h-11 w-full cursor-pointer accent-emerald-accent"
      />
      {name === 'temperature' && (
        <div className="flex justify-between text-xs text-text-muted" aria-hidden="true">
          <span>{text.cooler}</span>
          <span>{text.warmer}</span>
        </div>
      )}
    </div>
  )
}

function Panel({ title, initialOpen, children }) {
  return (
    <details open={initialOpen} className="rounded-xl border border-grid-border bg-white">
      <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-3 font-heading font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-accent">
        {title}
      </summary>
      <div className="space-y-3 border-t border-grid-border p-4">{children}</div>
    </details>
  )
}

export function TonePanel({ edit, update, getSession, text }) {
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(null)
  const request = useRef(0)

  useEffect(() => () => { request.current++ }, [])

  const autoExposure = async () => {
    const id = ++request.current
    setWorking(true)
    setMessage(null)
    try {
      const session = await getSession()
      const exposure = await session.exposure()
      if (id !== request.current) return
      update((current) => ({ ...current, exposure }))
      setMessage(exposure.strength ? 'exposureApplied' : 'exposureNormal')
    } catch {
      if (id === request.current) setMessage('processingError')
    } finally {
      if (id === request.current) setWorking(false)
    }
  }

  return (
    <Panel title={text.tone}>
      <p className="text-xs text-text-muted">{text.doubleClickReset}</p>
      {toneSliders.map((key) => (
        <Range
          key={key} name={key} label={text[key]} value={edit[key]} min={-50} max={50} text={text}
          onChange={(value, group) => update((current) => ({ ...current, [key]: value }), group)}
        />
      ))}
      <button type="button" onClick={autoExposure} disabled={working} className={secondaryButton}>{text.autoExposure}</button>
      <p role="status" className={working || message ? 'text-sm text-text-muted' : 'sr-only'}>
        {working ? text.processing : message ? text[message] : ''}
      </p>
    </Panel>
  )
}

export function FiltersPanel({ filter, update, text }) {
  return (
    <Panel title={text.filters}>
      <div className="flex flex-wrap gap-2">
        {filters.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => update((current) => ({ ...current, filter: choice }))}
            aria-pressed={filter === choice}
            className={filter === choice ? primaryButton : secondaryButton}
          >
            {text[choice]}
          </button>
        ))}
      </div>
      {filter === 'mono' && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text.monoWarning}</p>}
    </Panel>
  )
}

export function BackgroundPanel({
  bg, update, startOutline, drawButton, draft, showMask, setShowMask, segmentation, originalBackgroundWarning, text,
  brushAvailable, brushActive, brushButton, toggleBrush,
}) {
  const change = (patch, group) => update((edit) => ({ ...edit, bg: { ...edit.bg, ...patch } }), group)
  const showUnreliable = bg.enabled && bg.method === 'auto' && segmentation.result?.reliable === false

  return (
    <Panel title={text.background} initialOpen>
      {originalBackgroundWarning && !bg.enabled && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text.backgroundSuggestion}</p>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-emerald-accent" checked={bg.enabled} onChange={(event) => change({ enabled: event.target.checked })} />
        {text.replaceBackground}
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={bg.enabled && bg.method === 'auto' && !draft ? primaryButton : secondaryButton}
          aria-pressed={bg.enabled && bg.method === 'auto' && !draft}
          onClick={() => change({ enabled: true, method: 'auto' })}
        >
          {text.automatic}
        </button>
        <button
          ref={drawButton}
          type="button"
          className={draft || (bg.enabled && bg.method === 'manual') ? primaryButton : secondaryButton}
          aria-pressed={Boolean(draft) || (bg.enabled && bg.method === 'manual')}
          onClick={startOutline}
        >
          {text.pencil}
        </button>
        {brushAvailable && (
          <button
            ref={brushButton}
            type="button"
            className={brushActive ? primaryButton : secondaryButton}
            aria-pressed={brushActive}
            onClick={toggleBrush}
          >
            {text.brush}
          </button>
        )}
      </div>
      {!draft && <p className="text-xs text-text-muted">{text.pencilHint}</p>}
      {showUnreliable && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text.unreliableMask}</p>}

      <div className="flex flex-wrap gap-2">
        {Object.entries(backgroundColors).map(([key, color]) => (
          <button
            key={color}
            type="button"
            onClick={() => change({ color })}
            aria-pressed={bg.color === color}
            className={secondaryButton + (bg.color === color ? ' border-emerald-accent text-emerald-accent' : '')}
          >
            <span aria-hidden="true" className="me-2 inline-block size-3 rounded-sm border border-slate-400 align-middle" style={{ backgroundColor: color }} />
            {text[key]}
          </button>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="color" className="size-11 cursor-pointer rounded border border-grid-border bg-white p-1" value={bg.color} onChange={(event) => change({ color: event.target.value })} />
          {text.customColor}
        </label>
      </div>
      {bg.enabled && (
        <>
          <Range name="feather" label={text.feather} min={0} max={5} value={bg.feather} reset={2} text={text} onChange={(feather, group) => change({ feather }, group)} />
          <Range name="edgeShift" label={text.edgeShift} min={-4} max={4} value={bg.shift} reset={-1} text={text} onChange={(shift, group) => change({ shift }, group)} />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" className="size-5 accent-emerald-accent" checked={showMask} onChange={(event) => setShowMask(event.target.checked)} />
            {text.showMask}
          </label>
        </>
      )}
    </Panel>
  )
}

export function SuitPanel({ suit, update, segmentation, text }) {
  const unavailable = segmentation.result?.suitSupported === false
  const change = (patch, group) => update((edit) => ({ ...edit, suit: { ...edit.suit, ...patch } }), group)
  return (
    <Panel title={text.suit}>
      <p className="text-sm text-text-muted">{text.suitHelp}</p>
      <div role="group" aria-label={text.suitGender} className="flex flex-wrap gap-2">
        {['male', 'female', null].map((gender) => (
          <button
            key={gender ?? 'skip'}
            type="button"
            aria-pressed={suit.gender === gender}
            className={suit.gender === gender ? primaryButton : secondaryButton}
            onClick={() => change({ gender, enabled: false, styleId: 'dark', scale: 0, offset: 0 })}
          >
            {text[gender ?? 'skipSuit']}
          </button>
        ))}
      </div>
      {suit.gender && (
        <>
          {unavailable && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text.suitUnavailable}</p>}
          <div className="flex flex-wrap gap-2">
            {suitStyles.map((styleId) => (
              <button
                key={styleId}
                type="button"
                className={suit.enabled && suit.styleId === styleId ? primaryButton : secondaryButton}
                aria-pressed={suit.enabled && suit.styleId === styleId}
                disabled={unavailable}
                onClick={() => change({ enabled: true, styleId })}
              >
                {text[styleId]}
              </button>
            ))}
            {suit.enabled && <button type="button" className={secondaryButton} onClick={() => change({ enabled: false })}>{text.removeSuit}</button>}
          </div>
          {suit.enabled && !unavailable && (
            <>
              <Range name="suitScale" label={text.suitScale} min={-25} max={25} value={suit.scale} text={text} onChange={(scale, group) => change({ scale }, group)} />
              <Range name="suitOffset" label={text.suitOffset} min={-10} max={10} value={suit.offset} text={text} onChange={(offset, group) => change({ offset }, group)} />
            </>
          )}
        </>
      )}
    </Panel>
  )
}
