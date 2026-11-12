export const backgroundColors = { white: '#ffffff', gray: '#f0f0f0', blue: '#dce9f5' }
export const recommendedBackground = { kz_id: backgroundColors.gray, dv: backgroundColors.white }

export const initialEdit = {
  brightness: 0,
  contrast: 0,
  temperature: 0,
  saturation: 0,
  exposure: null,
  filter: 'none',
  bg: {
    enabled: false,
    method: 'auto',
    color: backgroundColors.white,
    feather: 2,
    shift: -1,
    outline: [],
    strokes: [],
  },
  suit: { enabled: false, gender: null, styleId: 'dark', scale: 0, offset: 0 },
}

const historyLimit = 30

export function createEditHistory() {
  return { past: [], present: initialEdit, future: [], group: null }
}

export function changeEditHistory(history, update, group = null) {
  const next = typeof update === 'function' ? update(history.present) : update
  if (next === history.present) return history

  const past = group && group === history.group
    ? history.past
    : [...history.past, history.present].slice(-historyLimit)
  return { past, present: next, future: [], group }
}

export function undoEdit({ past, present, future, group }) {
  if (!past.length) return { past, present, future, group }
  return { past: past.slice(0, -1), present: past.at(-1), future: [present, ...future], group: null }
}

export function redoEdit({ past, present, future, group }) {
  if (!future.length) return { past, present, future, group }
  return { past: [...past, present], present: future[0], future: future.slice(1), group: null }
}

export function hasPhotoEdits(edit) {
  return Boolean(edit.brightness || edit.contrast || edit.temperature || edit.saturation ||
    edit.exposure?.strength || edit.filter !== 'none' || edit.bg.enabled || edit.suit.enabled)
}

export function hasClosedArea(points) {
  if (points.length < 3) return false
  let twiceArea = 0
  let previous = points.at(-1)
  for (const point of points) {
    twiceArea += previous[0] * point[1] - point[0] * previous[1]
    previous = point
  }
  return Math.abs(twiceArea) >= 0.002
}
