import { useEffect, useRef, useState } from 'react'
import { brushRadius } from '../../lib/editor/brush'
import { clamp } from '../../lib/editor/pixels'

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export default function BrushLayer({ width, height, brush, onStroke, onClose, text }) {
  const surface = useRef(null)
  const draft = useRef(null)
  const [path, setPath] = useState(null)
  const [cursor, setCursor] = useState(null)
  const radius = brushRadius(width, height, brush.size)

  useEffect(() => { surface.current?.focus() }, [])

  const pointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp((event.clientY - rect.top) / rect.height, 0, 1)]
  }

  const append = (point, minimum) => {
    const current = draft.current
    const [x, y] = current.points.at(-1)
    if (Math.hypot((point[0] - x) * width, (point[1] - y) * height) >= minimum) current.points.push(point)
  }

  const endStroke = (event) => {
    const current = draft.current
    if (current?.pointerId !== event.pointerId) return
    const point = pointFromEvent(event)
    append(point, 0.5)
    draft.current = null
    setPath(null)
    setCursor(event.pointerType === 'touch' ? null : point)
    onStroke({ mode: current.mode, size: current.size, points: current.points })
  }

  const cancelStroke = (event) => {
    if (draft.current?.pointerId !== event.pointerId) return
    draft.current = null
    setPath(null)
    setCursor(null)
  }

  const keyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (draft.current) return
    const point = cursor ?? [0.5, 0.5]
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setCursor(point)
      if (!event.repeat) onStroke({ mode: brush.mode, size: brush.size, points: [point] })
      return
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const step = Math.max(2, radius / 2) * (event.shiftKey ? 4 : 1)
    setCursor([
      clamp(point[0] + direction[0] * step / width, 0, 1),
      clamp(point[1] + direction[1] * step / height, 0, 1),
    ])
  }

  return (
    <div
      ref={surface}
      role="group"
      tabIndex={0}
      aria-label={text.brushCanvas}
      aria-describedby="editor-brush-instructions"
      onKeyDown={keyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || draft.current) return
        const point = pointFromEvent(event)
        event.currentTarget.setPointerCapture(event.pointerId)
        draft.current = { pointerId: event.pointerId, mode: brush.mode, size: brush.size, points: [point] }
        setPath({ ...draft.current, points: [point] })
        setCursor(point)
      }}
      onPointerMove={(event) => {
        const point = pointFromEvent(event)
        if (draft.current?.pointerId === event.pointerId) {
          append(point, Math.max(1, radius / 8))
          setPath({ ...draft.current, points: [...draft.current.points] })
        } else if (draft.current || event.pointerType === 'touch') return
        setCursor(point)
      }}
      onPointerUp={endStroke}
      onPointerCancel={cancelStroke}
      onLostPointerCapture={cancelStroke}
      onPointerLeave={() => { if (!draft.current) setCursor(null) }}
      className="absolute inset-0 touch-none cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
    >
      <svg viewBox={'0 0 ' + width + ' ' + height} className="pointer-events-none block size-full" aria-hidden="true">
        {path && (
          <path
            d={'M' + path.points.map(([x, y]) => x * width + ',' + y * height).join(' L') + (path.points.length === 1 ? ' l0.001,0' : '')}
            fill="none"
            stroke="currentColor"
            strokeWidth={brushRadius(width, height, path.size) * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={path.mode === 'restore' ? 'text-emerald-400/45' : 'text-rose-500/45'}
          />
        )}
        {cursor && (
          <g transform={'translate(' + cursor[0] * width + ' ' + cursor[1] * height + ')'} fill="none">
            <circle r={radius} stroke="black" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <circle r={radius} stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
    </div>
  )
}
