import assert from 'node:assert/strict'
import { test } from 'node:test'
import { translations } from '../src/i18n.js'
import { stepCount } from '../src/steps.js'
import { applyBrushStrokes } from '../src/lib/editor/brush.js'
import {
  changeEditHistory, createEditHistory, hasClosedArea, initialEdit, recommendedBackground, redoEdit, undoEdit,
} from '../src/lib/editor/edit-state.js'
import { compositeRows, maskMetrics, refineMask, resizeMask } from '../src/lib/editor/mask.js'
import { estimateExposure, luminance, toneRows } from '../src/lib/editor/pixels.js'
import { findSuitAnchors, suitPlacement } from '../src/lib/editor/suits.js'

const rows = async (height, work) => work(0, height)

test('brush erases and restores alpha with soft edges and without gaps between points', async () => {
  const width = 80
  const height = 100
  const mask = new Uint8Array(width * height).fill(180)
  const points = [[0.25, 0.5], [0.75, 0.5]]
  const erase = { mode: 'erase', size: 20, points }
  await applyBrushStrokes(mask, width, height, [erase], rows)
  const pixel = (x, y) => mask[y * width + x]
  assert.equal(pixel(20, 50), 0)
  assert.equal(pixel(40, 50), 0)
  assert.equal(pixel(59, 50), 0)
  assert.ok(pixel(40, 57) > 0 && pixel(40, 57) < 180)
  assert.equal(pixel(40, 65), 180)

  await applyBrushStrokes(mask, width, height, [{ mode: 'restore', size: 20, points: [[0.5, 0.5]] }], rows)
  assert.equal(pixel(40, 50), 255)
  assert.equal(pixel(20, 50), 0)
  assert.ok(pixel(40, 57) < 255)
})

test('overlapping segments of a single stroke preserve feathering at different resolutions', async () => {
  const line = { mode: 'restore', size: 20, points: [[0.25, 0.5], [0.75, 0.5]] }
  const doubled = { ...line, points: [...line.points, line.points[0]] }
  const base = await applyBrushStrokes(new Uint8Array(10000), 100, 100, [line], rows)
  const retraced = await applyBrushStrokes(new Uint8Array(10000), 100, 100, [doubled], rows)
  assert.deepEqual(retraced, base)
  const large = await applyBrushStrokes(new Uint8Array(90000), 300, 300, [line], rows)
  const x = 50
  const y = 56
  assert.equal(large[(y * 3 + 1) * 300 + x * 3 + 1], base[y * 100 + x])
})

function solid(width, height, color) {
  return Uint8ClampedArray.from({ length: width * height * 4 }, (_, index) => color[index % 4])
}

function tone(source, width, height, edits) {
  const copy = new Uint8ClampedArray(source)
  toneRows(copy, width, 0, height, { ...initialEdit, ...edits })
  return copy
}

function mean(data) {
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += luminance(data[i], data[i + 1], data[i + 2])
  return sum / (data.length / 4)
}

test('neutral tone preserves every byte, brightness and temperature follow the controls', () => {
  const data = solid(2, 2, [115, 125, 136, 255])
  data.set([0, 253, 32, 180], 4)
  assert.deepEqual(tone(data, 2, 2, {}), data)
  assert.ok(mean(tone(data, 2, 2, { brightness: 30 })) > mean(data))
  assert.ok(mean(tone(data, 2, 2, { brightness: -30 })) < mean(data))
  const warm = tone(data, 2, 2, { temperature: 30 })
  assert.ok(warm[0] > data[0] && warm[2] < data[2])
  const cold = tone(data, 2, 2, { temperature: -30 })
  assert.ok(cold[0] < data[0] && cold[2] > data[2])
  const contrast = tone(data, 2, 2, { contrast: 50 })
  assert.equal(contrast[4], 0)
  assert.equal(contrast[5], 255)
  assert.equal(contrast[7], 180)
})

test('auto exposure brings a dark image into range and preserves normal exposure', () => {
  const dark = solid(32, 32, [27, 30, 34, 255])
  for (let i = 0; i < dark.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) dark[i + channel] += (i / 4) % 28
  }
  const corrected = mean(tone(dark, 32, 32, { exposure: estimateExposure(dark) }))
  assert.ok(corrected >= 90 && corrected <= 180, 'Mean brightness: ' + corrected)
  const normal = solid(32, 32, [132, 142, 137, 255])
  assert.ok(Math.abs(mean(tone(normal, 32, 32, { exposure: estimateExposure(normal) })) - mean(normal)) <= 5)
})

test('background compositing keeps the interior, replaces the exterior, and feathers the edge', async () => {
  const size = 41
  const rgb = [85, 53, 36, 255]
  const data = solid(size, size, rgb)
  const mask = Uint8Array.from({ length: size * size }, (_, index) => {
    const x = index % size
    const y = Math.floor(index / size)
    return Math.hypot(x - 20, y - 20) <= 10 ? 255 : 0
  })
  const refined = await refineMask(mask, size, size, -1, 2, rows)
  const output = new Uint8ClampedArray(data)
  compositeRows(output, data, refined, size, size, 0, size, [240, 240, 240])
  const pixel = (x, y) => [...output.slice((y * size + x) * 4, (y * size + x + 1) * 4)]
  assert.deepEqual(pixel(0, 0), [240, 240, 240, 255])
  assert.deepEqual(pixel(20, 20), rgb)
  const edge = [6, 7, 8, 9, 10, 11, 12, 13].map(x => pixel(x, 20)[0])
  assert.ok(edge.some(value => value > rgb[0] && value < 240))
  assert.ok(edge.every((value, index) => !index || value <= edge[index - 1]))
  assert.deepEqual([...await resizeMask(Uint8Array.of(0, 255), 2, 1, 4, 1, rows)], [0, 64, 191, 255])
})

test('decontamination reduces color spill at the feathered edge', () => {
  const mask = Uint8Array.of(0, 0, 0, 125, 255, 255, 255, 255)
  const data = solid(8, 1, [70, 79, 65, 255])
  data.set([24, 216, 57, 255], 3 * 4)
  const output = new Uint8ClampedArray(data)
  compositeRows(output, data, mask, 8, 1, 0, 1, [240, 240, 240])
  const greenWithoutCleanup = 216 * 125 / 255 + 240 * (1 - 125 / 255)
  const redWithoutCleanup = 24 * 125 / 255 + 240 * (1 - 125 / 255)
  assert.ok(output[13] - output[12] < greenWithoutCleanup - redWithoutCleanup)
  assert.deepEqual([...output.slice(4 * 4, 5 * 4)], [70, 79, 65, 255])
})

test('mask reliability rejects tiny, frame-filling and low contrast subjects', () => {
  const pixels = solid(10, 10, [200, 200, 200, 255])
  const good = new Uint8Array(100)
  for (let i = 0; i < 50; i++) {
    good[i] = 255
    pixels.set([50, 70, 90, 255], i * 4)
  }
  assert.equal(maskMetrics(good, pixels).reliable, true)
  assert.equal(maskMetrics(good, solid(10, 10, [100, 100, 100, 255])).reliable, false)
  assert.equal(maskMetrics(new Uint8Array(100).fill(255, 0, 5), pixels).reliable, false)
  assert.equal(maskMetrics(new Uint8Array(100).fill(255), pixels).reliable, false)
  assert.ok(hasClosedArea([[0.2, 0.2], [0.8, 0.2], [0.7, 0.9]]))
  assert.ok(!hasClosedArea([[0.2, 0.2], [0.4, 0.4], [0.8, 0.8]]))
})

test('editor history preserves more than ten edits, groups drag events, and supports redo and reset', () => {
  let history = createEditHistory()
  for (let i = 1; i <= 15; i++) {
    history = changeEditHistory(history, (state) => ({ ...state, brightness: i }))
  }
  assert.equal(history.past.length, 15)
  for (let i = 0; i < 10; i++) history = undoEdit(history)
  assert.equal(history.present.brightness, 5)
  assert.equal(redoEdit(history).present.brightness, 6)
  history = changeEditHistory(history, (state) => ({ ...state, contrast: 10 }), 'drag')
  const count = history.past.length
  history = changeEditHistory(history, (state) => ({ ...state, contrast: 20 }), 'drag')
  assert.equal(history.past.length, count)
  assert.equal(history.future.length, 0)
  assert.equal(undoEdit(history).present.contrast, 0)
  const reset = changeEditHistory(history, initialEdit)
  assert.deepEqual(JSON.parse(JSON.stringify(reset.present)), initialEdit)
  assert.deepEqual(undoEdit(reset).present, history.present)
  assert.equal(recommendedBackground.kz_id, '#f0f0f0')
  assert.equal(recommendedBackground.dv, '#ffffff')
  assert.equal(initialEdit.bg.enabled, false)
  assert.equal(initialEdit.suit.enabled, false)
})

test('suit collar stays below the chin and scales with visible shoulders', () => {
  const size = 200
  const categories = new Uint8Array(size * size)
  const landmarks = []
  landmarks[152] = {x:0.5,y:0.51}
  landmarks[33] = {x:0.43,y:0.38}
  landmarks[263] = {x:0.57,y:0.38}
  landmarks[234] = {x:0.4,y:0.43}
  landmarks[454] = {x:0.6,y:0.43}
  for (let y = 105; y < 145; y++) categories.fill(4, y * size + 45, y * size + 155)
  const anchor = findSuitAnchors(landmarks, categories, size, size)
  assert.ok(anchor)
  const placement = suitPlacement(anchor, size, size, 0, -10)
  assert.ok(placement.y > landmarks[152].y * size)
  assert.ok(suitPlacement(anchor, size, size, 20, 0).width > placement.width)
  assert.ok(suitPlacement({...anchor, shoulderWidth:anchor.shoulderWidth / 2}, size, size, 0, 0).width < placement.width)
  landmarks[33] = {x:0.43,y:0.27}
  assert.equal(findSuitAnchors(landmarks, categories, size, size), null)
})

test('RU and KZ editor keys and placeholders agree', () => {
  const { ru, kz } = translations
  const placeholders = (value) => (value.match(/\{\w+\}/g) ?? []).sort()
  assert.deepEqual(Object.keys(ru.editor).sort(), Object.keys(kz.editor).sort())
  for (const [key, text] of Object.entries(ru.editor)) {
    assert.ok(text && kz.editor[key], key)
    assert.deepEqual(placeholders(text), placeholders(kz.editor[key]), key)
  }
  assert.deepEqual(placeholders(ru.stepProgress), placeholders(kz.stepProgress))
  assert.equal(ru.stepLabels.length, stepCount)
  assert.equal(kz.stepLabels.length, stepCount)
})
