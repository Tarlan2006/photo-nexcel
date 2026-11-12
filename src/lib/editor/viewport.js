import { clamp } from './pixels.js'

export const initialView = { scale: 1, x: 0, y: 0 }
export const maxZoom = 5

export function limitView(scale, x, y) {
  return { scale, x: clamp(x, 1 - scale, 0), y: clamp(y, 1 - scale, 0) }
}

export function zoomView(view, scale, from = [0.5, 0.5], to = from) {
  const next = clamp(scale, 1, maxZoom)
  const ratio = next / view.scale
  return limitView(next, to[0] - (from[0] - view.x) * ratio, to[1] - (from[1] - view.y) * ratio)
}

export function imagePoint(point, view) {
  return [clamp((point[0] - view.x) / view.scale, 0, 1), clamp((point[1] - view.y) / view.scale, 0, 1)]
}

export function viewTransform(view) {
  return 'translate(' + view.x * 100 + '%, ' + view.y * 100 + '%) scale(' + view.scale + ')'
}
