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

test('each document has one main source and uses localized labels on approved HTTPS hosts', () => {
  const allowedHosts = new Set(['egov.kz', 'www.gov.kz', 'gov.kz', 'adilet.zan.kz', 'travel.state.gov'])
  const kinds = new Set(['primary', 'document', 'service', 'regulation'])
  for (const { sources } of Object.values(requirements)) {
    assert.equal(sources.filter(source => source.kind === 'primary').length, 1)
    assert.equal(new Set(sources.map(source => source.url)).size, sources.length)
    for (const { label, url, kind } of sources) {
      assert.ok(label.ru.trim() && label.kz.trim())
      assert.ok(kinds.has(kind), kind)
      const link = new URL(url)
      assert.equal(link.protocol, 'https:')
      assert.ok(allowedHosts.has(link.hostname), url)
    }
  }
  assert.deepEqual(requirements.kz_id.sources.map(({ url }) => url), [
    'https://egov.kz/cms/ru/articles/trebovaniya_k_fotografiyam',
    'https://egov.kz/cms/sites/default/files/trebovaniya_k_fotografiyam.pdf',
    'https://egov.kz/cms/ru/services/pass003_mvd',
    'https://www.gov.kz/services/3087?lang=ru',
    'https://adilet.zan.kz/rus/docs/V2000020192',
  ])
  assert.deepEqual(requirements.dv.sources.map(({ url }) => url), [
    'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html',
  ])
})

test('photo guidance is complete in both languages and its digital dimensions match the presets', () => {
  for (const [id, { intro, items, exportItems = [] }] of Object.entries(requirements)) {
    assert.ok(intro.ru.trim() && intro.kz.trim())
    const cards = items.length ? items : exportItems
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length)
    for (const { id: key, title, summary, detail } of [...items, ...exportItems]) {
      assert.ok(key.trim())
      for (const localized of [title, summary, detail]) {
        assert.ok(localized.ru.trim() && localized.kz.trim(), key)
      }
    }
    const { width, height, maxKb, headMinPct, headMaxPct } = presets[id]
    for (const lang of ['ru', 'kz']) {
      for (const [key, value] of [
        ['size', width + ' × ' + height],
        ['weight', maxKb + ' КБ'],
        ['head', headMinPct + '–' + headMaxPct + '%'],
      ]) {
        assert.ok(cards.find(card => card.id === key).summary[lang].includes(value), id + ' ' + lang + ' ' + value)
      }
    }
  }
  for (const lang of ['ru', 'kz']) {
    const dv = Object.fromEntries(requirements.dv.items.map(item => [item.id, item]))
    assert.match(dv.format.summary[lang], /JPEG \(\.jpg\)/)
    assert.match(dv.head.detail[lang], /1 3\/8/)
    assert.match(dv.scan.summary[lang], /2 × 2.*51 × 51/)
    assert.match(dv.scan.detail[lang], /300.*12/)
  }
})

test('the DV warning describes a possible rejection and points to the official requirements', () => {
  assert.doesNotMatch(photoCopy.ru.dvWarning, /запрещают/iu)
  assert.match(photoCopy.ru.dvWarning, /могут привести к отклонению/u)
  assert.match(photoCopy.kz.dvWarning, /қабылданбауына әкелуі мүмкін/u)
  for (const { dvWarning } of Object.values(photoCopy)) assert.match(dvWarning, /travel\.state\.gov/)
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
