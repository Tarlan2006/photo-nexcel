import { useLayoutEffect, useRef, useState } from 'react'
import { clamp } from '../../lib/editor/pixels.js'

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

export function PaperCrop({ photo, crop, onCrop, copy }) {
  const drag = useRef(null)
  const [draft, setDraft] = useState(null)
  const frame = draft ?? crop
  const { width, height } = photo
  const [left, right] = [frame.left * width, frame.right * width]
  const [top, bottom] = [frame.top * height, frame.bottom * height]

  function move([horizontal, vertical], x, y) {
    return {
      ...crop,
      [horizontal]: horizontal === 'left' ? clamp(x, 0, crop.right - 0.06) : clamp(x, crop.left + 0.06, 1),
      [vertical]: vertical === 'top' ? clamp(y, 0, crop.bottom - 0.06) : clamp(y, crop.top + 0.06, 1),
    }
  }

  function moveGrip(event) {
    const { corner, start } = drag.current
    const [horizontal, vertical] = corner
    const [x, y] = pointerPosition(event)
    return move(corner, crop[horizontal] + x - start[0], crop[vertical] + y - start[1])
  }

  return (
    <section className="signature-card">
      <h2>{copy.paper}</h2>
      <p className="signature-help">{copy.cropHint}</p>
      <div className="signature-well">
        <div className="signature-image">
          <SignatureCanvas image={photo} label={copy.original} />
          <svg viewBox={`0 0 ${width} ${height}`} className="signature-crop"
            onPointerMove={event => {
              if (drag.current?.pointerId === event.pointerId) setDraft(moveGrip(event))
            }}
            onPointerUp={event => {
              if (drag.current?.pointerId !== event.pointerId) return
              const next = moveGrip(event)
              drag.current = null
              setDraft(null)
              onCrop(next)
            }}
            onLostPointerCapture={() => { drag.current = null; setDraft(null) }}>
            <path aria-hidden="true" fillRule="evenodd" fill="#0c1715" fillOpacity="0.56"
              d={`M0 0H${width}V${height}H0Z M${left} ${top}H${right}V${bottom}H${left}Z`} />
            <rect aria-hidden="true" x={left} y={top} width={right - left} height={bottom - top}
              stroke="#1b6b44" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
            {corners.map(([horizontal, vertical], i) => {
              const x = frame[horizontal] * width
              const y = frame[vertical] * height
              // Keep the grips visible and reachable when the crop touches the border.
              const gripX = clamp(x, width * 0.018, width * 0.982)
              const gripY = clamp(y, height * 0.018, height * 0.982)
              return (
                <g key={copy.corners[i]} role="button" tabIndex={0} aria-label={copy.corners[i]}
                  className="signature-grip"
                  onPointerDown={event => {
                    if (event.button !== 0 || drag.current) return
                    const svg = event.currentTarget.ownerSVGElement
                    drag.current = { pointerId: event.pointerId, corner: corners[i], start: pointerPosition(event, svg) }
                    svg.setPointerCapture(event.pointerId)
                  }}
                  onKeyDown={event => {
                    const delta = arrows[event.key]
                    if (!delta) return
                    event.preventDefault()
                    const step = event.shiftKey ? 0.05 : 0.01
                    onCrop(move(corners[i], crop[horizontal] + delta[0] * step, crop[vertical] + delta[1] * step))
                  }}>
                  <circle cx={gripX} cy={gripY} r={0.2} vectorEffect="non-scaling-stroke" stroke="transparent" strokeWidth="44" />
                  <circle className="signature-grip-mark" cx={gripX} cy={gripY} r={0.2} vectorEffect="non-scaling-stroke"
                    stroke="white" strokeWidth="13" />
                </g>
              )
            })}
          </svg>
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
