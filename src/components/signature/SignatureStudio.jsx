import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STUDIO_HEIGHT, STUDIO_WIDTH, autoCenter, buildProcessed, detectThreshold, evaluateCompliance, quarterTurn, renderStudio, studioDefaults,
} from '../../lib/signature-studio'
import { BusinessCta, ResultDisclaimer } from '../ResultNotice'
import { studioCopy } from './studio-copy'

const card = 'rounded-2xl border border-grid-border bg-white p-4 shadow-2xs sm:p-5'
const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-grid-border bg-white px-3 text-sm font-medium hover:border-emerald-accent hover:text-emerald-accent'
const resolutions = { '550x124': [550, 124], '1100x248': [1100, 248] }

function Icon({ d, className = 'size-4 shrink-0' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={d} /></svg>
  )
}

const icons = {
  eye: 'M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3-9.96-7.18ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  frame: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
  center: 'M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5m4.5 0-5.25 5.25M15 9h4.5M15 9V4.5m0 4.5 5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25',
  rotate: 'M16.02 9.35h4.99m-18.03 10.3v-4.99m0 0h4.99m-4.99 0 3.18 3.18a8.25 8.25 0 0 0 13.8-3.7M4.03 9.87a8.25 8.25 0 0 1 13.8-3.7l3.18 3.18m0-4.99v4.99',
  eraser: 'm16.86 4.49 2.65 2.65a1.5 1.5 0 0 1 0 2.12L10.3 18.5a1.5 1.5 0 0 1-1.06.44H6l-2.65-2.65a1.5 1.5 0 0 1 0-2.12l9.4-9.2a1.5 1.5 0 0 1 2.11 0ZM9 19h11',
  download: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  ok: 'm5 13 4 4L19 7',
  warn: 'M12 9v2m0 4h.01',
}

export default function SignatureStudio({ copy, lang, source, onOther }) {
  const t = studioCopy[lang]
  const [initial] = useState(() => {
    const level = detectThreshold(source)
    const canvas = buildProcessed(source, { threshold: level, mode: 'bw', thickness: 1 })
    const { found, ...fit } = autoCenter(canvas, 0)
    return { level, canvas, view: { ...studioDefaults, ...fit } }
  })
  const [view, setView] = useState(initial.view)
  const [threshold, setThreshold] = useState(initial.level)
  const [strokeCount, setStrokeCount] = useState(0)
  const [eraser, setEraser] = useState(false)
  const [guides, setGuides] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [res, setRes] = useState('550x124')
  const [format, setFormat] = useState('image/jpeg')
  const [checks, setChecks] = useState(null)
  const [bytes, setBytes] = useState(null)
  const [saved, setSaved] = useState('')
  const main = useRef(null)
  const thumb = useRef(null)
  const processed = useRef({ key: `${initial.level}|bw|1`, canvas: initial.canvas })
  const strokes = useRef([])
  const live = useRef({ view, threshold, eraser })
  live.current = { view, threshold, eraser }
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const params = useMemo(() => ({ threshold, mode: view.mode, thickness: view.thickness }), [threshold, view.mode, view.thickness])
  const ensureProcessed = useCallback(() => {
    const key = `${params.threshold}|${params.mode}|${params.thickness}`
    if (processed.current.key !== key) processed.current = { key, canvas: buildProcessed(source, params) }
    return processed.current.canvas
  }, [params, source])

  const patch = useCallback(next => setView(current => ({ ...current, ...next })), [])

  // Redraw the working canvas and the small "what you download" preview.
  useEffect(() => {
    const canvas = ensureProcessed()
    const input = { source, processed: canvas, view, strokes: strokes.current }
    if (main.current) renderStudio(main.current, STUDIO_WIDTH * 2, STUDIO_HEIGHT * 2, { ...input, showOriginal: comparing })
    if (thumb.current) renderStudio(thumb.current, STUDIO_WIDTH, STUDIO_HEIGHT, input)
  }, [source, view, threshold, strokeCount, comparing, ensureProcessed])

  // Automatic check and file size, a moment after the last change.
  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = ensureProcessed()
      const probe = document.createElement('canvas')
      renderStudio(probe, STUDIO_WIDTH, STUDIO_HEIGHT, { source, processed: canvas, view, strokes: strokes.current })
      setChecks(evaluateCompliance(probe.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, STUDIO_WIDTH, STUDIO_HEIGHT).data))
      const [w, h] = resolutions[res]
      const out = document.createElement('canvas')
      renderStudio(out, w, h, { source, processed: canvas, view, strokes: strokes.current })
      out.toBlob(blob => setBytes(blob ? blob.size : null), format, 0.94)
    }, 120)
    return () => clearTimeout(timer)
  }, [source, view, threshold, strokeCount, res, format, ensureProcessed])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(''), 5000)
    return () => clearTimeout(timer)
  }, [saved])

  const toBase = event => {
    const rect = main.current.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * STUDIO_WIDTH, y: ((event.clientY - rect.top) / rect.height) * STUDIO_HEIGHT }
  }
  const clampZoom = value => Math.max(0.2, Math.min(3, value))

  function pointerDown(event) {
    if (event.button > 0) return
    main.current.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const point = toBase(event)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom: live.current.view.zoom }
      return
    }
    if (live.current.eraser) {
      strokes.current = [...strokes.current, [point]]
      setStrokeCount(strokes.current.length)
      gesture.current = { erase: true }
    } else {
      gesture.current = { dx: point.x - live.current.view.offsetX, dy: point.y - live.current.view.offsetY }
    }
  }
  function pointerMove(event) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const current = gesture.current
    if (current.pinch) {
      const [a, b] = [...pointers.current.values()]
      if (b) patch({ zoom: clampZoom(current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / current.pinch) })
      return
    }
    const point = toBase(event)
    if (current.erase) {
      strokes.current[strokes.current.length - 1].push(point)
      setStrokeCount(count => count + 0.0001)
    } else patch({ offsetX: point.x - current.dx, offsetY: point.y - current.dy })
  }
  function pointerUp(event) {
    pointers.current.delete(event.pointerId)
    if (!pointers.current.size) gesture.current = null
    setStrokeCount(strokes.current.length)
  }
  function wheel(event) {
    event.preventDefault()
    patch({ zoom: clampZoom(live.current.view.zoom + (event.deltaY < 0 ? 0.06 : -0.06)) })
  }
  useEffect(() => {
    const node = main.current
    node.addEventListener('wheel', wheel, { passive: false })
    return () => node.removeEventListener('wheel', wheel)
  }, [])
  function keyDown(event) {
    const step = event.shiftKey ? 16 : 4
    const { view: current } = live.current
    const moves = { ArrowLeft: { offsetX: current.offsetX - step }, ArrowRight: { offsetX: current.offsetX + step },
      ArrowUp: { offsetY: current.offsetY - step }, ArrowDown: { offsetY: current.offsetY + step },
      '+': { zoom: clampZoom(current.zoom + 0.05) }, '=': { zoom: clampZoom(current.zoom + 0.05) }, '-': { zoom: clampZoom(current.zoom - 0.05) } }
    if (!moves[event.key]) return
    event.preventDefault()
    patch(moves[event.key])
  }

  function center() {
    const { found, ...fit } = autoCenter(ensureProcessed(), view.angle)
    patch(fit)
  }
  function resetFilters() {
    patch({ mode: 'bw', thickness: 1 })
    setThreshold(detectThreshold(source))
  }
  function download() {
    const [w, h] = resolutions[res]
    const out = document.createElement('canvas')
    renderStudio(out, w, h, { source, processed: ensureProcessed(), view, strokes: strokes.current })
    const name = `podpis_egov_${w}x${h}.${format === 'image/png' ? 'png' : 'jpg'}`
    out.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setSaved(name)
    }, format, 0.94)
  }

  const [resW, resH] = resolutions[res]
  const items = checks && [
    { ok: true, title: t.size.replace('{w}', resW).replace('{h}', resH), text: t.sizeDesc },
    { ok: checks.noBorder, title: checks.noBorder ? t.frameOk : t.frameBad, text: checks.noBorder ? t.frameOkDesc : t.frameBadDesc },
    { ok: checks.margins, title: checks.margins ? t.marginsOk : checks.hasSignature ? t.marginsBad : t.marginsNone, text: checks.margins ? t.marginsOkDesc : t.marginsBadDesc },
    { ok: checks.cleanBackground && checks.hasSignature, title: checks.cleanBackground ? t.backgroundOk : t.backgroundBad, text: checks.cleanBackground ? t.backgroundOkDesc : t.backgroundBadDesc },
  ]
  const allOk = items?.every(item => item.ok)
  const fileName = `podpis_egov_${resW}x${resH}.${format === 'image/png' ? 'png' : 'jpg'}`
  const slider = 'w-full'

  return (
    <div className="studio flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-7">
        <div className="order-1 overflow-hidden rounded-2xl lg:order-none border border-grid-border bg-white shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold">{t.canvasTitle}</h2>
              <span className="rounded-md bg-paper px-2 py-0.5 font-mono text-xs text-text-muted">{t.canvasSize}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-pressed={comparing} title={t.originalHint} className={chip + ' select-none'}
                onPointerDown={() => setComparing(true)} onPointerUp={() => setComparing(false)} onPointerLeave={() => setComparing(false)} onPointerCancel={() => setComparing(false)}
                onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setComparing(true) } }}
                onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') setComparing(false) }} onBlur={() => setComparing(false)}>
                <Icon d={icons.eye} /> {t.original}
              </button>
              <button type="button" aria-pressed={guides} className={chip + (guides ? ' border-emerald-accent/40 bg-emerald-accent/5 text-emerald-accent' : '')} onClick={() => setGuides(!guides)}>
                <Icon d={icons.frame} /> {t.guides}
              </button>
            </div>
          </div>

          <div className="studio-backdrop flex flex-col items-center justify-center p-4 select-none sm:p-7">
            <div role="group" tabIndex={0} aria-label={t.canvasLabel} aria-describedby="studio-hint" onKeyDown={keyDown}
              className="relative w-full max-w-[660px] touch-none overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d4d4ce] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-accent"
              style={{ aspectRatio: '550 / 124' }}>
              <canvas ref={main} role="img" aria-label={copy.result} data-studio-canvas
                className={'block h-full w-full ' + (eraser ? 'cursor-cell' : 'cursor-grab active:cursor-grabbing')}
                onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 transition-opacity duration-150" style={{ opacity: guides && !comparing ? 1 : 0 }} data-studio-guides>
                <div className="absolute border border-dashed border-emerald-accent/75 bg-emerald-accent/[0.03]" style={{ left: '4.2%', right: '4.2%', top: '18.5%', bottom: '18.5%' }}>
                  <span className="absolute -top-4 left-1.5 rounded bg-white/95 px-1 text-[10px] font-medium text-emerald-accent">{t.zone}</span>
                </div>
                <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-emerald-accent/25" />
                <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-emerald-accent/25" />
              </div>
            </div>
            <p id="studio-hint" className="mt-3 max-w-xl text-center text-xs text-text-muted">{eraser ? t.hintErase : t.hintMove}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-grid-border bg-paper px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={chip} onClick={center}><Icon d={icons.center} className="size-4 shrink-0 text-emerald-accent" /> {t.autoCenter}</button>
              <button type="button" className={chip} title={t.rotateHint} aria-label={t.rotateHint} onClick={() => patch({ angle: quarterTurn(view.angle) })}><Icon d={icons.rotate} /> {t.rotate}</button>
              <button type="button" aria-pressed={eraser} className={chip + (eraser ? ' border-amber-300 bg-amber-50 text-amber-900' : '')} onClick={() => setEraser(!eraser)}>
                <Icon d={icons.eraser} className="size-4 shrink-0 text-amber-700" /> {eraser ? t.eraserOn : t.eraser}
              </button>
              {strokeCount >= 1 && (
                <button type="button" title={t.undoHint} className={chip} onClick={() => { strokes.current = strokes.current.slice(0, -1); setStrokeCount(strokes.current.length) }}>{t.undo}</button>
              )}
            </div>
            <button type="button" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-text-muted hover:bg-white hover:text-text-main" onClick={onOther}>{t.otherPhoto}</button>
          </div>
        </div>

        <section className={card + ' order-5 lg:order-none'} aria-labelledby="studio-checks">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="studio-checks" className="text-sm font-bold">{t.checkTitle}</h2>
            {items && <span className={'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ' + (allOk ? 'border-emerald-accent/25 bg-emerald-accent/5 text-emerald-accent' : 'border-amber-200 bg-amber-50 text-amber-900')}>{allOk ? t.allOk : t.needsFix}</span>}
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {(items ?? []).map(item => (
              <li key={item.title} data-ok={item.ok} className={'flex items-start gap-2.5 rounded-xl border p-2.5 text-sm ' + (item.ok ? 'border-grid-border bg-paper' : 'border-amber-200 bg-amber-50')}>
                <span aria-hidden="true" className={'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ' + (item.ok ? 'bg-emerald-accent/15 text-emerald-accent' : 'bg-amber-100 text-amber-900')}>
                  <Icon d={item.ok ? icons.ok : icons.warn} className="size-3" />
                </span>
                <div>
                  <p className={'font-semibold ' + (item.ok ? 'text-text-main' : 'text-amber-950')}>{item.title}</p>
                  <p className={'text-xs ' + (item.ok ? 'text-text-muted' : 'text-amber-900')}>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:col-span-5">
        <section className={card + ' order-2 lg:order-none'} aria-labelledby="studio-clean">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="studio-clean" className="text-sm font-bold">{t.clean}</h2>
            <button type="button" className="min-h-11 px-1 text-sm font-semibold text-emerald-accent hover:underline" onClick={resetFilters}>{t.reset}</button>
          </div>
          <div role="group" aria-label={t.modeLabel} className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
            {[['bw', t.modeBw], ['gray', t.modeGray]].map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={view.mode === mode} onClick={() => patch({ mode })}
                className={'min-h-11 rounded-lg px-3 text-sm ' + (view.mode === mode ? 'bg-white font-semibold text-text-main shadow-2xs' : 'font-medium text-text-muted hover:text-text-main')}>{label}</button>
            ))}
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium"><span>{t.threshold}</span><span className="font-mono text-xs text-text-muted">{threshold}</span></span>
              <input className={slider} type="range" min="60" max="245" value={threshold} onChange={event => setThreshold(event.target.valueAsNumber)} />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium"><span>{t.thickness}</span><span className="font-mono text-xs text-text-muted">{t.thicknessLabels[view.thickness]}</span></span>
              <input className={slider} type="range" min="0" max="3" step="1" value={view.thickness} onChange={event => patch({ thickness: event.target.valueAsNumber })} />
            </label>
          </div>
        </section>

        <section className={card + ' order-3 lg:order-none'} aria-labelledby="studio-position">
          <h2 id="studio-position" className="mb-4 text-sm font-bold">{t.position}</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium"><span>{t.zoom}</span><span className="font-mono text-xs text-text-muted">{Math.round(view.zoom * 100)}%</span></span>
              <input className={slider} type="range" min="20" max="300" value={Math.round(view.zoom * 100)} onChange={event => patch({ zoom: event.target.valueAsNumber / 100 })} />
            </label>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm font-medium">
                <label htmlFor="studio-angle">{t.angle}</label>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-muted">{view.angle.toFixed(1)}°</span>
                  <button type="button" className="min-h-11 px-1 text-sm font-semibold text-emerald-accent hover:underline" onClick={() => patch({ angle: 0 })}>{t.zero}</button>
                </span>
              </div>
              <input id="studio-angle" className={slider} type="range" min="-30" max="30" step="0.5" value={Math.max(-30, Math.min(30, view.angle))} onChange={event => patch({ angle: event.target.valueAsNumber })} />
            </div>
          </div>
        </section>

        <section className={card + ' order-4 lg:order-none'} aria-labelledby="studio-save">
          <h2 id="studio-save" className="mb-3 text-sm font-bold">{t.save}</h2>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <label className="block text-xs font-medium text-text-muted">{t.resolution}
              <select value={res} onChange={event => setRes(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-grid-border bg-paper px-3 text-sm font-medium text-text-main">
                <option value="550x124">{t.resolutionBase}</option>
                <option value="1100x248">{t.resolutionSharp}</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-text-muted">{t.format}
              <select value={format} onChange={event => setFormat(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-grid-border bg-paper px-3 text-sm font-medium text-text-main">
                <option value="image/jpeg">{t.formatJpeg}</option>
                <option value="image/png">{t.formatPng}</option>
              </select>
            </label>
          </div>
          <figure className="mb-4 rounded-xl border border-grid-border bg-paper p-3">
            <figcaption className="mb-2 text-xs font-semibold text-text-muted">{t.thumbnail}</figcaption>
            <canvas ref={thumb} role="img" aria-label={t.willDownload + ': ' + fileName} className="block w-full rounded-md bg-white ring-1 ring-grid-border" style={{ aspectRatio: '550 / 124' }} />
            <p className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-xs text-text-muted">
              <span className="font-mono text-text-main">{fileName}</span>
              <span>{resW} × {resH} px</span>
            </p>
          </figure>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-grid-border bg-paper px-3 py-2 text-sm text-text-muted">
            <span>{t.fileSize}</span>
            <span className="font-mono font-semibold text-text-main" data-file-size>{bytes ? `~${Math.max(1, Math.round(bytes / 1024))} ${copy.kb}` : '…'}</span>
          </div>
          <button type="button" onClick={download}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-accent px-5 text-base font-semibold text-white shadow-2xs hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-accent">
            <Icon d={icons.download} className="size-5 shrink-0" /> {t.download}
          </button>
          <ResultDisclaimer />
        </section>
        <div className="order-6 lg:order-none"><BusinessCta /></div>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md sm:left-auto">
        {saved && (
          <p className="flex items-center gap-3 rounded-xl bg-emerald-accent px-4 py-3 text-base font-semibold text-white shadow-lg">
            <span aria-hidden="true" className="text-xl">✓</span>
            <span>{copy.saved}<span className="block text-sm font-normal opacity-90">{t.fileSaved.replace('{name}', saved)}</span></span>
          </p>
        )}
      </div>
    </div>
  )
}
