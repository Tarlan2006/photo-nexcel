import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { brushRadius } from '../../lib/editor/brush'
import { clamp } from '../../lib/editor/pixels'
import { imagePoint, limitView, viewTransform, zoomView } from '../../lib/editor/viewport'

const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

function viewportPoint(event, rect) {
  return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
}

function pinchGeometry(pointers, rect) {
  const [[x1, y1], [x2, y2]] = [...pointers.values()]
  return {
    center: [(x1 + x2) / 2, (y1 + y2) / 2],
    distance: Math.max(1, Math.hypot((x2 - x1) * rect.width, (y2 - y1) * rect.height)),
  }
}

function appendPoint(stroke, point, width, height, spacing) {
  const [x, y] = stroke.points.at(-1)
  if (Math.hypot((point[0] - x) * width, (point[1] - y) * height) < spacing) return false
  stroke.points.push(point)
  return true
}

export default function BrushLayer({ width, height, brush, view, onViewChange, onStroke, onClose, text }) {
  const surface = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const latestView = useRef(view)
  const [path, setPath] = useState(null)
  const [cursor, setCursor] = useState(null)
  const radius = brushRadius(width, height, brush.size)

  useEffect(() => { surface.current?.focus({ preventScroll: true }) }, [])
  useLayoutEffect(() => { latestView.current = view }, [view])

  const changeView = useCallback((next) => {
    latestView.current = next
    onViewChange(next)
  }, [onViewChange])

  useEffect(() => {
    const element = surface.current
    const wheel = (event) => {
      if (pointers.current.size) return
      const current = latestView.current
      const zooming = event.ctrlKey || event.metaKey
      if (!zooming && current.scale === 1) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
      if (zooming) {
        changeView(zoomView(current, current.scale * Math.exp(-event.deltaY * unit / 320), viewportPoint(event, rect)))
      } else {
        changeView(limitView(current.scale, current.x - event.deltaX * unit / rect.width, current.y - event.deltaY * unit / rect.height))
      }
      setCursor(null)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [changeView])

  const startPinch = (rect) => {
    gesture.current = { kind: 'pinch', ...pinchGeometry(pointers.current, rect), view: latestView.current }
    setPath(null)
    setCursor(null)
  }

  const start = (event) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = viewportPoint(event, rect)
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, point)
    if (pointers.current.size >= 2) {
      startPinch(rect)
    } else if (brush.pan) {
      gesture.current = { kind: 'pan', point, view: latestView.current }
      setCursor(null)
    } else {
      const stroke = { mode: brush.mode, size: brush.size, points: [imagePoint(point, latestView.current)] }
      gesture.current = { kind: 'paint', stroke }
      setPath(stroke)
      setCursor(point)
    }
  }

  const move = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const point = viewportPoint(event, rect)
    if (!pointers.current.has(event.pointerId)) {
      if (!pointers.current.size && event.pointerType !== 'touch' && !brush.pan) setCursor(point)
      return
    }
    pointers.current.set(event.pointerId, point)
    const current = gesture.current
    if (current?.kind === 'pinch') {
      const { center, distance } = pinchGeometry(pointers.current, rect)
      changeView(zoomView(current.view, current.view.scale * distance / current.distance, current.center, center))
    } else if (current?.kind === 'pan') {
      const { scale, x, y } = current.view
      changeView(limitView(scale, x + point[0] - current.point[0], y + point[1] - current.point[1]))
    } else if (current?.kind === 'paint') {
      const next = imagePoint(point, latestView.current)
      const spacing = Math.max(1, brushRadius(width, height, current.stroke.size) / 8)
      if (appendPoint(current.stroke, next, width, height, spacing)) {
        setPath({ ...current.stroke, points: [...current.stroke.points] })
      }
      setCursor(point)
    }
  }

  const finish = (event, commit) => {
    if (!pointers.current.delete(event.pointerId)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const current = gesture.current
    if (commit && current?.kind === 'paint') {
      const point = viewportPoint(event, rect)
      appendPoint(current.stroke, imagePoint(point, latestView.current), width, height, 0.5)
      onStroke(current.stroke)
      setCursor(event.pointerType === 'touch' ? null : point)
    } else {
      setCursor(null)
    }

    if (pointers.current.size >= 2) startPinch(rect)
    else {
      // After a pinch, the remaining finger cannot begin a stroke until all fingers lift.
      gesture.current = null
      setPath(null)
    }
  }

  const keyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (pointers.current.size) return
    const current = latestView.current
    const point = cursor ?? [0.5, 0.5]
    const direction = directions[event.key]
    if (direction) {
      event.preventDefault()
      const multiplier = event.shiftKey ? 4 : 1
      if (brush.pan) {
        changeView(limitView(current.scale, current.x + direction[0] * 0.05 * multiplier, current.y + direction[1] * 0.05 * multiplier))
      } else {
        const step = Math.max(2, radius / 2) * current.scale * multiplier
        setCursor([
          clamp(point[0] + direction[0] * step / width, 0, 1),
          clamp(point[1] + direction[1] * step / height, 0, 1),
        ])
      }
    } else if (!brush.pan && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      setCursor(point)
      if (!event.repeat) onStroke({ mode: brush.mode, size: brush.size, points: [imagePoint(point, current)] })
    }
  }

  const cursorImage = cursor && !brush.pan ? imagePoint(cursor, view) : null

  return (
    <div
      ref={surface}
      role="group"
      tabIndex={0}
      aria-label={text.brushCanvas}
      aria-describedby="editor-brush-instructions"
      onKeyDown={keyDown}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={event => finish(event, true)}
      onPointerCancel={event => finish(event, false)}
      onLostPointerCapture={event => finish(event, false)}
      onPointerLeave={() => { if (!pointers.current.size) setCursor(null) }}
      className={'absolute inset-0 touch-none rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-accent ' + (brush.pan ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair')}
    >
      <svg
        viewBox={'0 0 ' + width + ' ' + height}
        className="pointer-events-none block size-full origin-top-left"
        style={{ transform: viewTransform(view) }}
        aria-hidden="true"
      >
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
        {cursorImage && (
          <g transform={'translate(' + cursorImage[0] * width + ' ' + cursorImage[1] * height + ')'} fill="none">
            <circle r={radius} stroke="black" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <circle r={radius} stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
    </div>
  )
}
