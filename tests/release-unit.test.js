import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDateFor, datedSitemap } from '../scripts/lib/build-metadata.js'
import { cropFace, HEAD_TOP_FACTOR } from '../src/lib/crop.js'
import { presets } from '../src/presets.js'
import { photoFileError, identifyPhoto } from '../src/lib/photo.js'
import { languageFromSearch, localizedPath } from '../src/lib/locale.js'
import { collectKzReview, csvText, parseCsv } from '../scripts/lib/kz-review.js'
import { measureCalibration, projectPoint, recommendCalibration } from '../scripts/lib/calibration.js'

function face(angle = 0) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: .5, y: .5 }))
  for (const [i, x, y] of [[33,.4,.5], [263,.6,.5], [10,.5,.4], [152,.5,.7], [234,.35,.55], [454,.65,.55]]) {
    landmarks[i] = { x: .5 + (x - .5) * Math.cos(angle) - (y - .5) * Math.sin(angle),
      y: .5 + (x - .5) * Math.sin(angle) + (y - .5) * Math.cos(angle) }
  }
  return landmarks
}

test('build date uses Kazakhstan time and is shared by every sitemap URL', () => {
  const date = buildDateFor(new Date('2026-11-19T19:30:00Z'))
  assert.equal(date, '2026-11-20')
  assert.equal(buildDateFor(new Date('2026-11-19T18:59:59Z')), '2026-11-19')
  assert.equal(datedSitemap('<lastmod>__BUILD_DATE__</lastmod><lastmod>__BUILD_DATE__</lastmod>', date),
    '<lastmod>2026-11-20</lastmod><lastmod>2026-11-20</lastmod>')
})

test('calibration uses an independent reviewed crown, never the factor-derived target percentage', t => {
  const previous = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => ({ translate() {}, scale() {}, rotate() {}, drawImage() {} }) }) }
  t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document })
  const image = { width: 1000, height: 1000 }
  for (const angle of [0, .15, -.15]) for (const preset of Object.values(presets)) {
    const landmarks = face(angle), crop = cropFace(image, landmarks, preset)
    assert.equal(crop.success, true)
    const noReference = measureCalibration({ landmarks, image, crop, preset })
    assert.equal(noReference.measured, false)
    assert.equal(noReference.headPct, null)
    const crown = { x: .5 + .3 * Math.sin(angle), y: .5 - .3 * Math.cos(angle) }
    const measured = measureCalibration({ landmarks, image, crop, preset, reference: { crown, reviewed: true, crownVisible: true, hair: 'regular' } })
    const expected = (preset.headMinPct + preset.headMaxPct) / 2 * (5 / 3) / HEAD_TOP_FACTOR
    assert.ok(Math.abs(measured.headPct - expected) < 1e-8)
    assert.equal(measured.inRange, false)
    assert.ok(Math.abs(measured.referenceFactor - 5 / 3) < 1e-8)
    assert.ok(Math.abs(measured.centerOffsetPct) < 1e-8)
    assert.equal(measured.chinClipped, false)
    const outside = measureCalibration({ landmarks, image, crop, preset,
      reference: { crown: { x: 0, y: .3 }, chin: { x: 1, y: .7 }, reviewed: true, crownVisible: true } })
    assert.equal(outside.crownClipped, true)
    assert.equal(outside.chinClipped, true)
    const eyes = [33, 263].map(i => projectPoint(crop.transform, { x: landmarks[i].x * 1000, y: landmarks[i].y * 1000 }))
    assert.ok(Math.abs(eyes[0].y - eyes[1].y) < 1e-8)
  }
  assert.equal(HEAD_TOP_FACTOR, 1.25)
})

test('calibration proposals require a measured majority and separate reviewed hair groups', () => {
  assert.equal(recommendCalibration([]).proposedFactor, null)
  const unreviewed = [{ file: 'unreviewed', success: true, measured: false, inRange: false, referenceFactor: 9, hair: 'regular' }]
  assert.equal(recommendCalibration(unreviewed).measuredResults, 0)
  const rows = ['one','two','three'].flatMap(file => ['kz_id','dv'].map(doc => ({ file, doc, success: true, measured: true, inRange: false, referenceFactor: 1.6, hair: 'regular' })))
  rows.push({ file: 'dense', success: true, measured: true, inRange: false, referenceFactor: 2, hair: 'dense' })
  const result = recommendCalibration(rows)
  assert.equal(result.majorityOutside, true)
  assert.equal(result.proposedFactor, 1.6)
  assert.equal(result.denseHairFactor, 2)
  assert.equal(result.denseHairMultiplier, 1.25)
  assert.equal(result.reviewedFiles, 4)
  assert.equal(result.smallSample, true)
  assert.equal(recommendCalibration(rows.map(row => ({ ...row, inRange: true }))).proposedFactor, null)
})

test('KZ review covers every copy group, keeps source text and leaves all human fields empty', () => {
  const rows = collectKzReview(), parsed = parseCsv(csvText(rows))
  assert.equal(parsed.length, rows.length + 1)
  assert.deepEqual(parsed.slice(1), rows)
  assert.equal(new Set(rows.map(row => row[0])).size, rows.length)
  for (const prefix of ['translations.', 'photoCopy.questions.', 'requirements.kz_id.', 'requirements.dv.', 'signatureCopy.rules.', 'releaseCopy.']) {
    assert.ok(rows.some(row => row[0].startsWith(prefix)), prefix)
  }
  assert.ok(rows.every(row => row[1] && row[2] && row[3] === '' && row[4] === ''))
  assert.deepEqual(parseCsv(csvText([['key', 'строка, "кавычки"\nещё', 'мәтін', '', '']])).at(-1), ['key', 'строка, "кавычки"\nещё', 'мәтін', '', ''])
})

const ftyp = (...brands) => {
  const bytes = Buffer.alloc(16 + Math.max(0, brands.length - 1) * 4)
  bytes.writeUInt32BE(bytes.length); bytes.write('ftyp', 4); bytes.write(brands[0], 8)
  brands.slice(1).forEach((brand, i) => bytes.write(brand, 16 + i * 4))
  return bytes
}

test('HEIC fails clearly by MIME, extension and container even after renaming; converted JPEG stays accepted', async () => {
  for (const type of ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']) {
    assert.equal(photoFileError(new File([ftyp('heic')], 'camera.heic', { type })), 'errHeic')
  }
  assert.equal(photoFileError(new File([ftyp('heic')], 'photo.HEIC')), 'errHeic')
  assert.equal(await identifyPhoto(new File([ftyp('mif1','heic')], 'renamed.jpg', { type: 'image/jpeg' })), 'image/heic')
  assert.equal(await identifyPhoto(new File([ftyp('avif','mif1')], 'photo.jpg', { type: 'image/jpeg' })), null)
  const converted = new File([Uint8Array.of(255,216,255,0)], 'converted.heic', { type: 'image/jpeg' })
  assert.equal(photoFileError(converted), null)
  assert.equal(await identifyPhoto(converted), 'image/jpeg')
  assert.equal(await identifyPhoto(new File([Buffer.from('RIFF0000WEBPmore-image-data')], 'valid.webp')), 'image/webp')
})

test('language URLs use the kk language code and keep a stable Russian default', () => {
  assert.equal(languageFromSearch('?lang=kk'), 'kz')
  assert.equal(languageFromSearch('?lang=kz'), 'kz')
  assert.equal(languageFromSearch('?lang=ru'), 'ru')
  assert.equal(languageFromSearch('?lang=invalid'), null)
  assert.equal(languageFromSearch('', '/kk/'), 'kz')
  assert.equal(localizedPath('/', 'kz'), '/kk/')
  assert.equal(localizedPath('/kk/signature/', 'ru'), '/signature/')
  assert.equal(localizedPath('/signature/', 'ru'), '/signature/')
})
