import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STUDIO_HEIGHT, STUDIO_WIDTH, evaluateCompliance, quarterTurn, studioDefaults } from '../src/lib/signature-studio.js'
import { studioCopy } from '../src/components/signature/studio-copy.js'

function frame(draw) {
  const data = new Uint8ClampedArray(STUDIO_WIDTH * STUDIO_HEIGHT * 4).fill(255)
  const dot = (x, y) => { const i = (y * STUDIO_WIDTH + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0 }
  draw(dot)
  return data
}

test('a centred signature on white passes every check', () => {
  const data = frame(dot => { for (let x = 100; x < 450; x++) for (let y = 55; y < 60; y++) dot(x, y) })
  assert.deepEqual(evaluateCompliance(data), { hasSignature: true, cleanBackground: true, noBorder: true, margins: true })
})

test('empty page, frame lines on the edge and ink near the edge are reported', () => {
  assert.equal(evaluateCompliance(frame(() => {})).hasSignature, false)
  const border = evaluateCompliance(frame(dot => { for (let x = 0; x < STUDIO_WIDTH; x++) { dot(x, 0); dot(x, 1) } for (let x = 100; x < 450; x++) dot(x, 60) }))
  assert.equal(border.noBorder, false)
  const close = evaluateCompliance(frame(dot => { for (let y = 20; y < 100; y++) for (let x = 5; x < 20; x++) dot(x, y) }))
  assert.equal(close.margins, false)
})

test('quarter turns stay inside -180..180 and return after four turns', () => {
  let angle = 0
  const seen = []
  for (let i = 0; i < 4; i++) { angle = quarterTurn(angle); seen.push(angle) }
  assert.deepEqual(seen, [90, -180, -90, 0])
  assert.equal(studioDefaults.mode, 'bw')
  assert.equal(studioDefaults.thickness, 1)
})

test('RU and KZ studio texts have the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(studioCopy.kz).sort(), Object.keys(studioCopy.ru).sort())
  for (const [key, text] of Object.entries(studioCopy.ru)) {
    if (typeof text !== 'string') continue
    assert.deepEqual(studioCopy.kz[key].match(/\{\w+\}/g) ?? [], text.match(/\{\w+\}/g) ?? [], key)
    assert.ok(studioCopy.kz[key].trim() && studioCopy.kz[key] !== '', key)
  }
  assert.equal(studioCopy.kz.thicknessLabels.length, 4)
})
