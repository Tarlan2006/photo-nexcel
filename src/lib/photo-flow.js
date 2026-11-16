import { backgroundColors, initialEdit, recommendedBackground } from './editor/edit-state.js'

const naturalWhite = '#fafafa'
const sharedBackgrounds = ['recommended', 'original', 'white', 'natural']

export function backgroundChoices(presetId) {
  return presetId === 'dv'
    ? [...sharedBackgrounds]
    : [...sharedBackgrounds, 'gray', 'custom']
}

export function createPhotoSettings(presetId = 'kz_id') {
  return {
    presetId, background: 'recommended', customColor: backgroundColors.gray,
    fixTilt: true, autoExposure: true, brightness: 0, contrast: 0,
    filter: 'none', suit: initialEdit.suit, strokes: [],
    scaleOffset: 0, offsetY: 0,
  }
}

export function changePhotoDocument(settings, presetId) {
  if (settings.presetId === presetId) return settings
  return {
    ...settings, presetId,
    background: backgroundChoices(presetId).includes(settings.background) ? settings.background : 'recommended',
    filter: 'none',
    suit: initialEdit.suit,
    scaleOffset: 0, offsetY: 0,
  }
}

export function toPhotoParameters(settings) {
  const { presetId, background, customColor, brightness, contrast, filter, suit, strokes } = settings
  const colorByChoice = { recommended: recommendedBackground[presetId], ...backgroundColors, natural: naturalWhite, custom: customColor }
  const color = colorByChoice[backgroundChoices(presetId).includes(background) ? background : 'recommended']
  return {
    autoExposure: settings.autoExposure,
    adjustments: { fixTilt: settings.fixTilt, scaleOffset: settings.scaleOffset, offsetY: settings.offsetY },
    edit: {
      ...initialEdit, brightness, contrast, filter, suit,
      bg: { ...initialEdit.bg, enabled: Boolean(color), color: color || initialEdit.bg.color, strokes },
    },
  }
}

export function initialPhotoFlow(presetId = 'kz_id') {
  return {
    screen: 'upload', dialog: false, status: null, error: null,
    source: null, result: null, settings: createPhotoSettings(presetId),
  }
}

export function photoFlow(state, action) {
  switch (action.type) {
    case 'settings':
      return { ...state, settings: action.settings, error: state.status ? state.error : null }
    case 'load':
      return { ...state, dialog: true, status: 'loading', error: null }
    case 'loaded':
      return {
        ...state, screen: 'upload', status: null, source: action.source, result: null, error: null,
        settings: { ...state.settings, strokes: [], scaleOffset: 0, offsetY: 0 },
      }
    case 'open':
      return { ...state, dialog: true, error: null }
    case 'close':
      return { ...state, dialog: false, status: state.status === 'loading' ? state.status : null, error: null }
    case 'process':
      return { ...state, status: 'starting', settings: action.settings, error: null }
    case 'progress':
      return { ...state, status: action.status }
    case 'error':
      return { ...state, dialog: true, status: null, error: action.error }
    case 'result':
      return { ...state, screen: 'result', dialog: false, status: null, result: action.result }
    case 'history':
      return {
        ...state, screen: action.result && state.result ? 'result' : 'upload',
        dialog: false, status: state.status === 'loading' ? state.status : null, error: null,
      }
    case 'reset':
      return initialPhotoFlow(state.settings.presetId)
    default:
      return state
  }
}

export function releasePhoto(source) {
  if (!source || source.closed) return
  source.closed = true
  source.session?.then(session => session.close()).catch(() => {})
  source.rendered?.bitmap.close()
  source.bitmap.close()
}
