import assert from 'node:assert/strict'
import { test } from 'node:test'
import { presets } from '../src/presets.js'
import { requirements } from '../src/content/requirements.js'
import { photoCopy } from '../src/content/photo-copy.js'
import { backgroundChoices, changePhotoDocument, createPhotoSettings, initialPhotoFlow, photoFlow,
  releasePhoto, toPhotoParameters } from '../src/lib/photo-flow.js'

test('photo settings preserve explicit color, optional alignment and optional exposure', () => {
  const initial = createPhotoSettings()
  assert.equal(toPhotoParameters(initial).edit.bg.color, '#f0f0f0')
  assert.equal(toPhotoParameters(createPhotoSettings('dv')).edit.bg.color, '#ffffff')
  const original = toPhotoParameters({ ...initial, background: 'original', fixTilt: false, autoExposure: false })
  assert.equal(original.edit.bg.enabled, false)
  assert.equal(original.adjustments.fixTilt, false)
  assert.equal(original.autoExposure, false)
  const custom = toPhotoParameters({ ...initial, background: 'custom', customColor: '#123456', brightness: 12 })
  assert.equal(custom.edit.bg.color, '#123456')
  assert.equal(custom.edit.brightness, 12)
  assert.equal(custom.adjustments.fixTilt, true)
  assert.equal(custom.autoExposure, true)
})

test('DV exposes only white colors and starts with filters and suit off', () => {
  const settings = changePhotoDocument({
    ...createPhotoSettings(), background: 'custom', filter: 'sharp', suit: { enabled: true },
  }, 'dv')
  assert.deepEqual(backgroundChoices('dv'), ['recommended', 'original', 'white', 'natural'])
  assert.equal(settings.background, 'recommended')
  assert.equal(settings.filter, 'none')
  assert.equal(settings.suit.enabled, false)
  assert.equal(toPhotoParameters({ ...settings, background: 'natural' }).edit.bg.color, '#fafafa')
})

test('the official requirements are complete in both languages and have valid source references', () => {
  const expected = ['size', 'weight', 'head', 'format', 'background', 'position', 'expression', 'glasses', 'headwear', 'lighting', 'retouch', 'age', 'clothing']
  for (const [id, { intro, sources, items }] of Object.entries(requirements)) {
    assert.deepEqual(items.map(item => item.id), expected)
    assert.ok(intro.ru.trim() && intro.kz.trim())
    const allowedHosts = id === 'kz_id' ? ['beta.egov.kz', 'old.adilet.zan.kz'] : ['travel.state.gov']
    for (const { label, href, kazakhHref } of Object.values(sources)) {
      assert.ok(label.ru.trim() && label.kz.trim())
      for (const link of [href, kazakhHref ?? href]) {
        const url = new URL(link)
        assert.equal(url.protocol, 'https:')
        assert.ok(allowedHosts.includes(url.hostname), link)
      }
    }
    for (const item of items) {
      assert.ok(item.title.ru.trim() && item.title.kz.trim())
      assert.ok(item.detail.ru.trim() && item.detail.kz.trim())
      assert.ok(Object.hasOwn(sources, item.source), item.id)
    }
    const preset = presets[id]
    for (const lang of ['ru', 'kz']) {
      for (const [index, value] of [
        [0, preset.width + ' × ' + preset.height],
        [1, preset.maxKb + ' КБ'],
        [2, preset.headMinPct + '–' + preset.headMaxPct + '%'],
      ]) {
        assert.ok(items[index].detail[lang].includes(value), id + ' ' + lang + ' ' + value)
      }
      assert.match(requirements.dv.items[3].detail[lang], /JPEG/)
      assert.doesNotMatch(requirements.kz_id.items[3].detail[lang], /JPEG/)
    }
  }
})

test('photo flow maintains two screens, settings, errors, history, and reset', () => {
  const source = { id: 'photo' }
  let state = initialPhotoFlow('dv')
  const dispatch = (type, props = {}) => { state = photoFlow(state, { type, ...props }); return state }
  assert.equal(state.screen, 'upload')
  assert.equal(dispatch('load').dialog, true)
  assert.equal(dispatch('loaded', { source }).source, source)
  assert.equal(dispatch('process', { settings: state.settings }).status, 'starting')
  assert.equal(dispatch('error', { error: 'errNoFace' }).dialog, true)
  assert.equal(state.source, source)
  assert.equal(dispatch('result', { result: { sourceId: source.id } }).screen, 'result')
  assert.equal(dispatch('open').dialog, true)
  assert.equal(dispatch('history', { result: false }).screen, 'upload')
  assert.equal(dispatch('history', { result: true }).screen, 'result')
  assert.deepEqual(dispatch('reset'), initialPhotoFlow('dv'))
})

test('reset releases the original, rendered image and worker exactly once', async () => {
  const closed = []
  const source = {
    bitmap: { close: () => closed.push('original') },
    rendered: { bitmap: { close: () => closed.push('rendered') } },
    session: Promise.resolve({ close: () => closed.push('worker') }),
  }
  releasePhoto(source)
  releasePhoto(source)
  await source.session
  assert.deepEqual(closed, ['rendered', 'original', 'worker'])
})

test('photo copy has matching Kazakh and Russian keys and placeholders', () => {
  const placeholders = value => (value.match(/\{\w+\}/g) ?? []).sort()
  assert.deepEqual(Object.keys(photoCopy.ru), Object.keys(photoCopy.kz))
  for (const [key, value] of Object.entries(photoCopy.ru)) {
    if (Array.isArray(value)) assert.equal(value.length, photoCopy.kz[key].length)
    else assert.deepEqual(placeholders(value), placeholders(photoCopy.kz[key]), key)
  }
})
