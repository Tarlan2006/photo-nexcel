import { useLayoutEffect, useRef } from 'react'
import { scaledSize } from '../../lib/editor/pixels'

export default function PhotoCanvas({ bitmap, label, className, style, limit = 520 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!bitmap) return
    const { width, height } = scaledSize(bitmap.width, bitmap.height, limit)
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    return () => { canvas.width = canvas.height = 1 }
  }, [bitmap, limit])
  if (!bitmap) return null
  return <canvas ref={ref} role="img" aria-label={label} className={className} style={style} />
}
