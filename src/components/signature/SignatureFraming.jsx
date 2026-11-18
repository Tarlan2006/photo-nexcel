import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { clamp } from '../../lib/editor/pixels.js'
import { centerSignatureFrame, signatureFrameDefault, signatureFrameRect, signatureGuideRect, signatureFrameSize, zoomSignatureFrame } from '../../lib/signature-frame.js'
import SignatureContour from './SignatureContour.jsx'

const stage = { width: 1000, height: 750 }
const guide = signatureGuideRect(stage)
const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export default function SignatureFraming({ photo, region, frame, onChange, copy }) {
  const canvas = useRef(null)
  const surface = useRef(null)
  const original = useRef(null)
  const latest = useRef(frame)
  latest.current = frame
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const [contour, setContour] = useState(true)
  const id = useId()
  const low = signatureFrameSize({ width: photo.sourceWidth ?? photo.width, height: photo.sourceHeight ?? photo.height }, frame).tooSmall
  useLayoutEffect(() => {
    const image = document.createElement('canvas')
    image.width = photo.width; image.height = photo.height
    image.getContext('2d').putImageData(new ImageData(photo.data, photo.width, photo.height), 0, 0)
    original.current = image
    return () => { original.current = null; image.width = image.height = 1 }
  }, [photo])
  useLayoutEffect(() => {
    const ctx = canvas.current.getContext('2d')
    ctx.fillStyle = '#eef1ef'; ctx.fillRect(0, 0, stage.width, stage.height)
    const rect = signatureFrameRect(photo, frame)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(original.current, guide.x + rect.left * guide.width, guide.y + rect.top * guide.height,
      rect.width * guide.width, rect.height * guide.height)
  }, [photo, frame])
  function point(event) {
    const box = surface.current.getBoundingClientRect()
    return [((event.clientX - box.left) / box.width * stage.width - guide.x) / guide.width,
      ((event.clientY - box.top) / box.height * stage.height - guide.y) / guide.height]
  }
  function start() {
    const values = [...pointers.current.values()]
    if (!values.length) { gesture.current = null; return }
    const [a, b = a] = values
    gesture.current = { frame: latest.current, center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      distance: values.length > 1 ? Math.hypot(a[0] - b[0], (a[1] - b[1]) / (550 / 124)) : 0 }
  }
  function release(event) {
    pointers.current.delete(event.pointerId)
    start()
  }
  useEffect(() => {
    const element = surface.current
    function wheel(event) {
      event.preventDefault()
      onChange(zoomSignatureFrame(latest.current, latest.current.zoom * Math.exp(-clamp(event.deltaY, -200, 200) * .002), point(event)))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [onChange])
  return (
    <section className="signature-card signature-framing">
      <h2>{copy.framingTitle}</h2>
      <p className="signature-help">{copy.framingHelp}</p>
      <div className="signature-actions mt-3">
        <button type="button" className="signature-button" aria-pressed={contour} onClick={() => setContour(!contour)}>{copy.contour}</button>
        <button type="button" className="signature-button" onClick={() => onChange(signatureFrameDefault)}>{copy.fitFrame}</button>
        <button type="button" className="signature-button" disabled={!region} onClick={() => onChange(centerSignatureFrame(photo, region))}>{copy.centerSignature}</button>
      </div>
      <div ref={surface} className="signature-frame-stage mt-3">
        <canvas ref={canvas} width={stage.width} height={stage.height} role="img" aria-label={copy.framingImage} />
        {contour && <SignatureContour size={stage} />}
        <button type="button" className="signature-pan" aria-label={copy.panImage} aria-describedby={id}
          onPointerDown={event => {
            if (event.button !== 0 || pointers.current.size >= 2) return
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, point(event)); start()
          }}
          onPointerMove={event => {
            if (!pointers.current.has(event.pointerId) || !gesture.current) return
            pointers.current.set(event.pointerId, point(event))
            const [a, b = a] = [...pointers.current.values()]
            const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            const initial = gesture.current
            const distance = Math.hypot(a[0] - b[0], (a[1] - b[1]) / (550 / 124))
            const next = initial.distance > 0 ? zoomSignatureFrame(initial.frame,
              initial.frame.zoom * distance / initial.distance, initial.center) : initial.frame
            onChange({ ...next, panX: clamp(next.panX + center[0] - initial.center[0], -3, 3),
              panY: clamp(next.panY + center[1] - initial.center[1], -6, 6) })
          }}
          onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
          onKeyDown={event => {
            const delta = arrows[event.key]
            if (!delta) return
            event.preventDefault()
            const step = event.shiftKey ? .05 : .01
            onChange({ ...frame, panX: clamp(frame.panX + delta[0] * step, -3, 3), panY: clamp(frame.panY + delta[1] * step, -6, 6) })
          }} />
      </div>
      <p className="signature-help mt-2">{copy.contourWidth.replace('{percent}', '88')}</p>
      <p className="signature-help">{copy.safeZone}</p>
      <p id={id} className="signature-help">{copy.panHint}</p>
      <div className="signature-zoom mt-3">
        <button type="button" className="signature-button" aria-label={copy.zoomOut} disabled={frame.zoom <= .25}
          onClick={() => onChange(zoomSignatureFrame(frame, frame.zoom - .1))}>−</button>
        <label className="signature-field grow">
          <span>{copy.zoom} <span className="float-right">{Math.round(frame.zoom * 100)}%</span></span>
          <input type="range" aria-label={copy.zoom} min="25" max="400" step="1" value={Math.round(frame.zoom * 100)}
            onChange={event => onChange(zoomSignatureFrame(frame, event.target.valueAsNumber / 100))} />
        </label>
        <button type="button" className="signature-button" aria-label={copy.zoomIn} disabled={frame.zoom >= 4}
          onClick={() => onChange(zoomSignatureFrame(frame, frame.zoom + .1))}>+</button>
      </div>
      {low && <p className="signature-alert" role="status">{copy.lowResolution}</p>}
    </section>
  )
}
