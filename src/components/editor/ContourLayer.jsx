import { useEffect, useRef } from 'react'
import { clamp } from '../../lib/editor/pixels'

const mapPoint = ([x, y]) => x * 1000 + ',' + y * 1000

export default function ContourLayer({ draft, updateDraft, cancel, text }) {
  const pointer = useRef(null)
  const target = useRef(null)
  const cursor = useRef([0.5, 0.5])

  useEffect(() => { target.current?.focus() }, [])

  const placePoint = (point, minimum = 0.002) => {
    updateDraft((current) => {
      const last = current.points.at(-1)
      if (current.points.length >= 1800 ||
          (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < minimum)) return current
      return { ...current, points: [...current.points, point] }
    })
  }

  const pointerPoint = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [
      clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    ]
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      placePoint(cursor.current)
      return
    }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!direction) return
    event.preventDefault()
    const step = event.shiftKey ? 0.05 : 0.01
    cursor.current = cursor.current.map((position, axis) => clamp(position + direction[axis] * step, 0, 1))
    const position = cursor.current
    updateDraft((current) => ({ ...current, cursor: position }))
  }

  return (
    <div
      ref={target}
      role="group"
      tabIndex={0}
      aria-label={text.drawCanvas}
      aria-describedby="editor-draw-instructions"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || pointer.current !== null) return
        event.currentTarget.setPointerCapture(event.pointerId)
        pointer.current = event.pointerId
        placePoint(pointerPoint(event))
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) placePoint(pointerPoint(event), 0.004)
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return
        placePoint(pointerPoint(event))
        pointer.current = null
      }}
      onLostPointerCapture={() => { pointer.current = null }}
      className="absolute inset-0 touch-none cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
    >
      <svg className="pointer-events-none block size-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        {draft.points.length > 0 && (
          <>
            <polyline points={draft.points.map(mapPoint).join(' ')} fill="none" stroke="black" strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={draft.points.map(mapPoint).join(' ')} fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {draft.points.length >= 3 && (
          <polyline
            points={[draft.points[0], draft.points.at(-1)].map(mapPoint).join(' ')}
            fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
          />
        )}
        {draft.cursor && (
          <circle cx={draft.cursor[0] * 1000} cy={draft.cursor[1] * 1000} r="13" fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  )
}
