import { useLayoutEffect, useRef, useState } from 'react'
import { clamp } from '../../lib/editor/pixels.js'
import { moveSignatureCrop, resizeSignatureCrop, squareSignatureCrop } from '../../lib/signature-crop.js'
import { fullPaper } from '../../lib/signature.js'

const corners = [
  ['left', 'top'], ['right', 'top'], ['right', 'bottom'], ['left', 'bottom'],
]
const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export function SignatureCanvas({ image, label }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
    return () => { canvas.width = canvas.height = 1 }
  }, [image])
  return <canvas ref={ref} role="img" aria-label={label} className="signature-canvas" />
}

function pointerPosition(event, element = event.currentTarget) {
  const box = element.getBoundingClientRect()
  return [
    clamp((event.clientX - box.left) / box.width, 0, 1),
    clamp((event.clientY - box.top) / box.height, 0, 1),
  ]
}

export function PaperCrop({ photo, crop, square, onCrop, copy }) {
  const surface = useRef(null)
  const drag = useRef(null)
  const [selection, setSelection] = useState(null)
  const frame = selection ?? crop
  const { width, height } = photo
  const [left, right] = [frame.left * width, frame.right * width]
  const [top, bottom] = [frame.top * height, frame.bottom * height]

  function startDrag(event, corner) {
    if (event.button !== 0 || drag.current) return
    const element = surface.current
    drag.current = { pointerId: event.pointerId, crop, corner, start: pointerPosition(event, element) }
    element.setPointerCapture(event.pointerId)
  }

  function moveFrame(event) {
    const { corner, start, crop: initial } = drag.current
    const [x, y] = pointerPosition(event)
    const dx = x - start[0]
    const dy = y - start[1]
    if (!corner) return moveSignatureCrop(initial, dx, dy)
    const [horizontal, vertical] = corner
    return resizeSignatureCrop(initial, photo, corner, initial[horizontal] + dx, initial[vertical] + dy, square)
  }

  function handleArrow(event, corner) {
    const delta = arrows[event.key]
    if (!delta) return
    event.preventDefault()
    const step = (event.shiftKey ? 0.05 : 0.01) * Math.min(width, height)
    const dx = delta[0] * step / width
    const dy = delta[1] * step / height
    if (!corner) {
      onCrop(moveSignatureCrop(crop, dx, dy), square)
      return
    }
    const [horizontal, vertical] = corner
    onCrop(resizeSignatureCrop(crop, photo, corner, crop[horizontal] + dx, crop[vertical] + dy, square), square)
  }

  return (
    <section className="signature-card">
      <h2>{copy.paper}</h2>
      <p className="signature-help">{copy.cropHint}</p>
      <div className="signature-actions mt-3" role="group" aria-label={copy.cropShape}>
        <button type="button" className="signature-button" aria-pressed={!square} onClick={() => onCrop(crop, false)}>
          {copy.freeCrop}
        </button>
        <button type="button" className="signature-button" aria-pressed={square}
          onClick={() => { if (!square) onCrop(squareSignatureCrop(crop, photo), true) }}>
          {copy.squareCrop}
        </button>
        <button type="button" className="signature-button" onClick={() => onCrop(fullPaper, false)}>
          {copy.resetCrop}
        </button>
      </div>
      <div className="signature-well">
        <div ref={surface} className="signature-image"
          onPointerMove={event => {
            if (drag.current?.pointerId === event.pointerId) setSelection(moveFrame(event))
          }}
          onPointerUp={event => {
            if (drag.current?.pointerId !== event.pointerId) return
            const next = moveFrame(event)
            drag.current = null
            setSelection(null)
            onCrop(next, square)
          }}
          onLostPointerCapture={() => { drag.current = null; setSelection(null) }}>
          <SignatureCanvas image={photo} label={copy.original} />
          <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="signature-crop">
            <path fillRule="evenodd" fill="#0c1715" fillOpacity="0.56"
              d={`M0 0H${width}V${height}H0Z M${left} ${top}H${right}V${bottom}H${left}Z`} />
            <rect x={left} y={top} width={right - left} height={bottom - top}
              stroke="#1b6b44" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
          </svg>
          {(crop.right - crop.left < 1 || crop.bottom - crop.top < 1) && (
            <button type="button" className="signature-crop-move" aria-label={copy.moveCrop}
              style={{ left: frame.left * 100 + '%', top: frame.top * 100 + '%',
                width: (frame.right - frame.left) * 100 + '%', height: (frame.bottom - frame.top) * 100 + '%' }}
              onPointerDown={event => startDrag(event, null)} onKeyDown={event => handleArrow(event, null)} />
          )}
          {corners.map((corner, i) => (
            <button type="button" key={copy.corners[i]} aria-label={copy.corners[i]} className="signature-grip"
              style={{ left: clamp(frame[corner[0]] * 100, 1.8, 98.2) + '%', top: clamp(frame[corner[1]] * 100, 1.8, 98.2) + '%' }}
              onPointerDown={event => startDrag(event, corner)} onKeyDown={event => handleArrow(event, corner)}>
              <span aria-hidden="true" className="signature-grip-mark" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BrushCanvas({ image, mode, onStroke, copy }) {
  const gesture = useRef(null)
  const [cursor, setCursor] = useState(null)
  const [path, setPath] = useState([])
  const { region } = image
  const apply = points => onStroke({
    mode, size: 4 * region.relativeSize,
    points: points.map(([x, y]) => [region.left + x * region.width, region.top + y * region.height]),
  })
  const length = Math.max(image.width, image.height)
  return (
    <div className={`signature-image${mode ? ' signature-brush' : ''}`}
      role={mode ? 'group' : undefined} aria-label={mode ? copy.brushTools : undefined}
      aria-describedby={mode ? 'signature-brush-hint' : undefined} tabIndex={mode ? 0 : undefined}
      onPointerDown={event => {
        if (!mode || event.button !== 0 || gesture.current) return
        event.currentTarget.setPointerCapture(event.pointerId)
        gesture.current = { pointerId: event.pointerId, points: [pointerPosition(event)] }
        setPath(gesture.current.points)
      }}
      onPointerMove={event => {
        if (!mode) return
        const point = pointerPosition(event)
        setCursor(point)
        if (gesture.current?.pointerId === event.pointerId) {
          const points = [...gesture.current.points, point]
          gesture.current.points = points
          setPath(points)
        }
      }}
      onPointerUp={event => {
        if (!mode || gesture.current?.pointerId !== event.pointerId) return
        const points = [...gesture.current.points, pointerPosition(event)]
        gesture.current = null
        setPath([])
        apply(points)
      }}
      onLostPointerCapture={() => { gesture.current = null; setPath([]) }}
      onPointerLeave={() => setCursor(null)}
      onBlur={() => setCursor(null)}
      onKeyDown={event => {
        if (!mode) return
        const [x, y] = cursor ?? [0.5, 0.5]
        const delta = arrows[event.key]
        if (delta) {
          event.preventDefault()
          setCursor([clamp(x + delta[0] * 0.015, 0, 1), clamp(y + delta[1] * 0.015, 0, 1)])
        } else if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          setCursor([x, y])
          apply([[x, y]])
        }
      }}>
      <SignatureCanvas image={image} label={copy.result} />
      {mode && (
        <svg aria-hidden="true" className="signature-brush-cursor" viewBox={`0 0 ${image.width} ${image.height}`}>
          {path.length > 1 && (
            <polyline points={path.map(([x, y]) => `${x * image.width},${y * image.height}`).join(' ')}
              fill="none" stroke="#26a475" strokeWidth={length * 0.04} strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {cursor && (
            <circle cx={cursor[0] * image.width} cy={cursor[1] * image.height} r={length * 0.02}
              stroke="#26a475" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
          )}
        </svg>
      )}
    </div>
  )
}
