import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, open, readFile, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import axe from 'axe-core'
import { chromium, devices } from 'playwright'
import { preview } from 'vite'
import { photoCopy } from '../src/content/photo-copy.js'
import { requirements } from '../src/content/requirements.js'
import { translations } from '../src/i18n.js'
import { fixturePng, synthSignature } from './helpers/synthSignature.js'

const ru = translations.ru
const copy = photoCopy.ru
const portrait = fileURLToPath(new URL('./fixtures/portrait.jpg', import.meta.url))
const astronaut = fileURLToPath(new URL('./fixtures/astronaut.png', import.meta.url))
const skipPortrait = existsSync(portrait) ? false : 'Local portrait fixture unavailable'
const chromePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(path => path && existsSync(path))
const main = page => page.locator('#wizard-main')
const dialog = page => page.getByRole('dialog', { name: copy.settings })
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const file = scope => scope.locator('input[type=file]')
const background = (page, value) => dialog(page).locator('input[name=photo-background][value=' + value + ']')
const ready = page => main(page).getByRole('img', { name: copy.readyImage })
const resultTitle = page => main(page).getByRole('heading', { level: 1, name: ru.step5Title })

async function upload(page, path = portrait) {
  await file(main(page)).setInputFiles(path)
  await dialog(page).getByRole('img', { name: ru.editor.original }).waitFor()
}

async function processPhoto(page) {
  await button(dialog(page), copy.process).click()
  const error = dialog(page).getByRole('alert')
  await page.waitForFunction(() => {
    const node = document.querySelector('dialog[open][aria-labelledby=photo-settings-title]')
    return !node || Boolean(node.querySelector('[role=alert]'))
  })
  if (await error.isVisible()) assert.fail(await error.innerText())
  await dialog(page).waitFor({ state: 'hidden' })
  await ready(page).waitFor()
}

async function changeDocument(page, id) {
  const picker = dialog(page).locator('input[name=settings-document][value=' + id + ']')
  if (!await picker.count()) await button(dialog(page), copy.changeDocument).click()
  await picker.click()
}

async function checkAxe(page) {
  await page.evaluate(axe.source)
  assert.deepEqual(await page.evaluate(async () =>
    (await axe.run()).violations.map(({ id, nodes }) => [id, nodes.map(node => node.target)])), [])
}

async function sourceFixture(page, variant) {
  const encoded = (await readFile(portrait)).toString('base64')
  const data = await page.evaluate(async ({ encoded, variant }) => {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
    const canvas = document.createElement('canvas')
    canvas.width = variant === 'large' ? 4000 : variant === 'two' ? 1120 : 600
    canvas.height = variant === 'large' ? 3000 : variant === 'two' ? 580 : 600
    const context = canvas.getContext('2d')
    context.fillStyle = '#376c9e'
    context.fillRect(0, 0, canvas.width, canvas.height)
    try {
      if (variant === 'two') {
        context.drawImage(bitmap, 30, 40, 510, 510)
        context.drawImage(bitmap, 565, 40, 510, 510)
      } else if (variant === 'large') {
        context.drawImage(bitmap, 900, 200, 2550, 2550)
      } else {
        const points = [[84,511],[145,470],[219,408],[220,345],[216,278],[213,209],[211,156],[220,121],[242,106],
          [304,107],[352,123],[373,159],[376,217],[370,276],[364,329],[364,383],[405,442],[467,511]]
        context.beginPath()
        for (const [i, [x, y]] of points.entries()) context[i ? 'lineTo' : 'moveTo'](x + 42, y + 35)
        context.closePath()
        context.clip()
        context.drawImage(bitmap, 42, 35, 512, 512)
      }
      return canvas.toDataURL('image/jpeg', 0.97).split(',')[1]
    } finally { bitmap.close(); canvas.width = canvas.height = 1 }
  }, { encoded, variant })
  return { name: variant + '.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') }
}

async function jpeg(page, width, height, limit) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    main(page).getByRole('link', { name: copy.download, exact: true }).click(),
  ])
  const bytes = await readFile(await download.path())
  assert.ok(bytes.length <= limit, bytes.length + ' bytes')
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
  const info = await page.evaluate(async base64 => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type: 'image/jpeg' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    try {
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const { width, height } = bitmap
      return {
        width, height,
        corners: [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
          .map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3)),
      }
    } finally { bitmap.close(); canvas.width = canvas.height = 1 }
  }, bytes.toString('base64'))
  assert.deepEqual([info.width, info.height], [width, height])
  return { ...info, bytes }
}

function closeColor(pixel, rgb) {
  assert.ok(rgb.every((channel, i) => Math.abs(channel - pixel[i]) <= 2), pixel + ' != ' + rgb)
}

test('two-screen photo tool in the production build', { timeout: 240000 }, async suite => {
  if (!chromePath) return suite.skip('Chromium unavailable. Run npx playwright install chromium.')
  const server = await preview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4198 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const csp = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8'))
    .match(/^  Content-Security-Policy: (.+)$/m)[1].trim()
  let browser
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    })
    async function withPage(run, options = {}) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', ...options })
      const page = await context.newPage()
      const requests = []
      const errors = []
      page.setDefaultTimeout(12000)
      page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error' && message.text() !== 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.') {
          errors.push(message.text())
        }
      })
      await page.addInitScript(() => {
        window.photoQA = { violations: [], detections: 0, workers: 0, bitmaps: 0, urls: new Set() }
        document.addEventListener('securitypolicyviolation', event => photoQA.violations.push(event.violatedDirective))
        const mark = performance.mark.bind(performance)
        performance.mark = function (name, ...args) {
          if (name === 'photo:face-detection') photoQA.detections++
          return mark(name, ...args)
        }
        const bitmaps = new WeakSet()
        const create = window.createImageBitmap
        const close = ImageBitmap.prototype.close
        const transfer = Worker.prototype.postMessage
        const terminate = Worker.prototype.terminate
        const NativeWorker = window.Worker
        const workers = new WeakSet()
        window.createImageBitmap = async (...args) => {
          const bitmap = await create(...args)
          bitmaps.add(bitmap)
          photoQA.bitmaps++
          return bitmap
        }
        ImageBitmap.prototype.close = function () {
          if (bitmaps.delete(this)) photoQA.bitmaps--
          return close.call(this)
        }
        Worker.prototype.postMessage = function (data, list) {
          const result = transfer.call(this, data, list)
          if (Array.isArray(list)) for (const item of list) if (bitmaps.delete(item)) photoQA.bitmaps--
          return result
        }
        Worker.prototype.terminate = function () {
          if (workers.delete(this)) photoQA.workers--
          return terminate.call(this)
        }
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args)
            workers.add(this)
            photoQA.workers++
          }
        }
        const url = URL.createObjectURL
        const revoke = URL.revokeObjectURL
        URL.createObjectURL = blob => {
          const next = url(blob)
          photoQA.urls.add(next)
          return next
        }
        URL.revokeObjectURL = value => { photoQA.urls.delete(value); return revoke(value) }
      })
      try {
        const response = await page.goto(origin)
        assert.equal(response.headers()['content-security-policy'], csp)
        await run(page, requests, context)
        assert.deepEqual(errors, [])
        assert.deepEqual(await page.evaluate(() => photoQA.violations), [])
        assert.deepEqual(requests.filter(({ url, method }) =>
          url.startsWith('http') && (!url.startsWith(origin + '/') || method !== 'GET')), [])
      } finally { await context.close() }
    }

    await suite.test('opening shows documents, upload, rules, FAQs and no step UI; models are lazy', async () => {
      await withPage(async (page, requests, context) => {
        await main(page).getByRole('heading', { name: ru.step1Title }).waitFor()
        assert.equal(await main(page).locator('input[name=upload-document]').count(), 2)
        await main(page).getByRole('heading', { name: copy.requirements }).waitFor()
        const panel = main(page).getByRole('tabpanel')
        assert.equal(await panel.getByRole('list').first().getByRole('listitem').count(), 13)
        assert.equal(await panel.getByRole('link', { name: requirements.kz_id.sources.service.label.ru })
          .getAttribute('href'), requirements.kz_id.sources.service.href)
        await main(page).getByRole('tab', { name: 'Green Card (DV)', exact: true }).click()
        await panel.getByText(/ровно 600 × 600/).waitFor()
        assert.equal(await panel.getByRole('list').first().getByRole('listitem').count(), 13)
        assert.equal(await panel.getByRole('link', { name: requirements.dv.sources.photoRules.label.ru })
          .getAttribute('href'), requirements.dv.sources.photoRules.href)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await panel.getByText(/дәл 600 × 600/).waitFor()
        await main(page).getByRole('tab', { name: 'ҚР жеке куәлігі', exact: true }).click()
        await panel.getByText(/Түс тереңдігі — 24 бит/).waitFor()
        assert.equal(await panel.getByRole('link', { name: requirements.kz_id.sources.photoRules.label.kz })
          .getAttribute('href'), requirements.kz_id.sources.photoRules.kazakhHref)
        await page.getByRole('button', { name: 'RU', exact: true }).click()
        assert.doesNotMatch(await main(page).innerText(), /TODO|Шаг 1/)
        assert.equal(await main(page).locator('details').count(), 4)
        assert.ok(!requests.some(({ url }) => /face_landmarker|detector-|\/models\/|\/wasm\//.test(url)))
        await checkAxe(page)
        await context.grantPermissions(['camera'], { origin })
        await button(main(page), ru.btnShootCamera).click()
        await page.getByRole('dialog', { name: ru.cameraModalTitle }).waitFor()
        await page.waitForFunction(() => document.querySelector('dialog video')?.videoWidth > 0 ||
          document.querySelector('dialog [role=alert]'))
        assert.equal(await page.getByRole('dialog').getByRole('alert').count(), 0)
        await page.keyboard.press('Escape')
        await page.getByRole('dialog').waitFor({ state: 'hidden' })
      })
    })

    await suite.test('settings open before detection and restore focus on Escape or backdrop click', { skip: skipPortrait }, async () => {
      await withPage(async page => {
        const trigger = button(main(page), ru.btnChooseFile)
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger.click()])
        await chooser.setFiles(portrait)
        await dialog(page).getByRole('img', { name: ru.editor.original }).waitFor()
        assert.equal(await dialog(page).getAttribute('aria-modal'), 'true')
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab')
          assert.ok(await dialog(page).evaluate(element => element.contains(document.activeElement)))
        }
        assert.equal(await page.evaluate(() => photoQA.detections), 0)
        await page.keyboard.press('Escape')
        await dialog(page).waitFor({ state: 'hidden' })
        assert.ok(await trigger.evaluate(element => element === document.activeElement))
        await upload(page)
        await page.mouse.click(8, 8)
        await dialog(page).waitFor({ state: 'hidden' })
        assert.ok(await trigger.evaluate(element => element === document.activeElement))
      })
    })

    await suite.test('recommended colors, original background, custom JPEG and both document sizes', { skip: skipPortrait }, async () => {
      await withPage(async page => {
        await upload(page, await sourceFixture(page, 'colored'))
        const swatch = () => background(page, 'recommended').locator('..').locator('span[aria-hidden]')
        assert.equal(await swatch().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(240, 240, 240)')
        await changeDocument(page, 'dv')
        assert.equal(await swatch().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)')
        assert.deepEqual(await dialog(page).locator('input[name=photo-background]').evaluateAll(nodes => nodes.map(node => node.value)),
          ['recommended', 'original', 'white', 'natural'])
        await changeDocument(page, 'kz_id')
        await background(page, 'original').check()
        await dialog(page).getByRole('switch', { name: copy.autoExposure }).uncheck()
        await processPhoto(page)
        const original = await jpeg(page, 413, 531, 30000)
        assert.ok(original.corners.some(pixel => [55, 108, 158].every((channel, i) => Math.abs(channel - pixel[i]) <= 2)),
          JSON.stringify(original.corners))
        assert.equal(await page.evaluate(() => photoQA.detections), 1)
        await main(page).getByText(copy.framing, { exact: true }).click()
        await main(page).getByRole('slider', { name: ru.adjustScale, exact: true }).press('Home')
        const shift = main(page).getByRole('slider', { name: ru.adjustShiftY, exact: true })
        for (let i = 0; i < 5; i++) await shift.press('ArrowRight')
        await button(main(page), copy.applyFraming).click()
        await page.waitForFunction(() => document.querySelector('#wizard-main [role=status]')?.textContent === '')
        await button(main(page), copy.editSettings).click()
        assert.ok(await background(page, 'original').isChecked())
        assert.ok(!await dialog(page).getByRole('switch', { name: copy.autoExposure }).isChecked())
        await background(page, 'custom').check()
        await dialog(page).locator('input[type=color]').fill('#c0e0f0')
        await processPhoto(page)
        const custom = await jpeg(page, 413, 531, 30000)
        for (const pixel of custom.corners) closeColor(pixel, [192, 224, 240])
        assert.equal(await page.evaluate(() => photoQA.detections), 1)
        await button(main(page), ru.btnOtherDoc).click()
        await changeDocument(page, 'dv')
        assert.ok(await background(page, 'recommended').isChecked())
        await processPhoto(page)
        await jpeg(page, 600, 600, 240000)
        assert.equal(await page.evaluate(() => photoQA.detections), 1)
        await button(main(page), copy.compare).click()
        await main(page).getByRole('img', { name: ru.editor.original }).waitFor()
        await button(main(page), copy.compare).click()
        await ready(page).waitFor()
      })
    })

    await suite.test('face, multiple faces, broken files, unsupported files and size errors stay in settings', { skip: skipPortrait }, async () => {
      await withPage(async page => {
        const broken = { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.of(255, 216, 255, 0) }
        await file(main(page)).setInputFiles(broken)
        await dialog(page).getByRole('alert').getByText(ru.errRead).waitFor()
        await file(dialog(page)).setInputFiles({ name: 'text.txt', mimeType: 'text/plain', buffer: Buffer.from('text') })
        await dialog(page).getByRole('alert').getByText(ru.errUnsupportedFormat).waitFor()
        const path = await mkdtemp(join(tmpdir(), 'photo-size-test-'))
        const oversized = join(path, 'oversized.jpg')
        try {
          const handle = await open(oversized, 'w')
          try { await handle.truncate(51 * 1024 * 1024) } finally { await handle.close() }
          await file(dialog(page)).setInputFiles(oversized)
          await dialog(page).getByRole('alert').getByText(ru.errUploadTooLarge).waitFor()
        } finally { await unlink(oversized); await rmdir(path) }
        await file(dialog(page)).setInputFiles({
          name: 'blank.png', mimeType: 'image/png', buffer: fixturePng(synthSignature('blank', 400, 300)),
        })
        await button(dialog(page), copy.process).click()
        await dialog(page).getByRole('alert').getByText(ru.errNoFace).waitFor()
        await file(dialog(page)).setInputFiles(await sourceFixture(page, 'two'))
        await button(dialog(page), copy.process).click()
        await dialog(page).getByRole('alert').getByText(ru.errMultipleFaces).waitFor()
      })
    })

    await suite.test('Back and Forward restore the two screens; reload clears photo state', { skip: skipPortrait }, async () => {
      await withPage(async page => {
        await upload(page)
        await background(page, 'original').check()
        await processPhoto(page)
        await page.goBack()
        await main(page).getByRole('heading', { name: ru.step1Title }).waitFor()
        assert.equal(new URL(page.url()).origin, origin)
        await page.goForward()
        await resultTitle(page).waitFor()
        await page.reload()
        await main(page).getByRole('heading', { name: ru.step1Title }).waitFor()
        assert.equal(await page.evaluate(() => history.state?.photoResult), null)
      })
    })

    await suite.test('filters and suits default to off in DV, and the warning is visible when chosen', { skip: skipPortrait }, async () => {
      await withPage(async page => {
        await main(page).locator('input[name=upload-document][value=dv]').check()
        await upload(page)
        await dialog(page).getByText(copy.advanced, { exact: true }).click()
        const filter = dialog(page).getByLabel(ru.editor.filters, { exact: true })
        assert.equal(await filter.inputValue(), 'none')
        assert.equal(await button(dialog(page), ru.editor.skipSuit).getAttribute('aria-pressed'), 'true')
        await filter.selectOption('soft')
        await button(dialog(page), ru.editor.male).click()
        await button(dialog(page), ru.editor.dark).click()
        await dialog(page).getByText(copy.dvWarning, { exact: true }).waitFor()
      })
    })

    await suite.test('framing, background brush, and real suit through the preserved editor modules', {
      skip: existsSync(astronaut) ? skipPortrait : 'Local suit fixture unavailable',
    }, async () => {
      await withPage(async page => {
        await upload(page, astronaut)
        await dialog(page).getByText(copy.advanced, { exact: true }).click()
        await button(dialog(page), ru.editor.female).click()
        await button(dialog(page), ru.editor.dark).click()
        await processPhoto(page)
        const suit = await jpeg(page, 413, 531, 30000)
        await main(page).getByText(copy.framing, { exact: true }).click()
        const scale = main(page).getByRole('slider', { name: ru.adjustScale, exact: true })
        await scale.press('ArrowRight')
        await button(main(page), copy.applyFraming).click()
        await page.waitForFunction(() => document.querySelector('#wizard-main [role=status]')?.textContent === '')
        const framed = await jpeg(page, 413, 531, 30000)
        assert.notDeepEqual(framed.bytes, suit.bytes)
        await button(main(page), copy.refineBackground).click()
        const surface = main(page).getByRole('group', { name: ru.editor.brushCanvas })
        await surface.press('ArrowRight')
        await surface.press('Enter')
        await button(main(page), copy.applyBrush).click()
        await page.waitForFunction(() => document.querySelector('#wizard-main [role=status]')?.textContent === '')
        assert.equal(await page.evaluate(() => photoQA.detections), 1)
      })
    })

    await suite.test('RU/KZ and axe across mobile sheet, result and 768 px tablet', { skip: skipPortrait }, async () => {
      const { defaultBrowserType, ...mobile } = devices['iPhone 13']
      await withPage(async page => {
        const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        await main(page).getByRole('heading', { name: ru.step1Title }).waitFor()
        assert.ok(await noOverflow())
        await upload(page)
        const geometry = await dialog(page).evaluate(node => {
          const rect = node.getBoundingClientRect()
          return { width: rect.width, bottom: rect.bottom, windowWidth: innerWidth, windowHeight: innerHeight, contentWidth: node.scrollWidth }
        })
        assert.equal(geometry.width, geometry.windowWidth)
        assert.equal(geometry.bottom, geometry.windowHeight)
        assert.ok(geometry.contentWidth <= geometry.width)
        await checkAxe(page)
        await background(page, 'original').check()
        await processPhoto(page)
        await checkAxe(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        const kz = translations.kz
        const kazakhCopy = photoCopy.kz
        await main(page).getByRole('heading', { name: kz.step5Title }).waitFor()
        assert.equal(await page.locator('html').getAttribute('lang'), 'kk')
        await button(main(page), kazakhCopy.editSettings).click()
        await page.getByRole('dialog', { name: kazakhCopy.settings }).waitFor()
        await checkAxe(page)
        await page.keyboard.press('Escape')
        await button(main(page), kz.btnNewPhoto).click()
        await main(page).getByRole('heading', { name: kz.step1Title }).waitFor()
        await page.setViewportSize({ width: 360, height: 800 })
        assert.ok(await noOverflow())
        await page.setViewportSize({ width: 768, height: 900 })
        assert.ok(await noOverflow())
        await checkAxe(page)
      }, mobile)
    })

    await suite.test('processing a 12 MP photo completes in five seconds', { skip: skipPortrait }, async t => {
      await withPage(async page => {
        await upload(page, await sourceFixture(page, 'large'))
        const start = performance.now()
        await processPhoto(page)
        const ms = performance.now() - start
        t.diagnostic('12 MP camera-sized JPEG, process to result: ' + ms.toFixed(0) + ' ms')
        assert.ok(ms <= 5000, ms + ' ms')
        await jpeg(page, 413, 531, 30000)
      })
    })

    await suite.test('ten cycles release photo memory, workers and download URLs', { skip: skipPortrait }, async t => {
      await withPage(async page => {
        const cdp = await page.context().newCDPSession(page)
        const heap = async () => {
          await cdp.send('HeapProfiler.collectGarbage')
          return (await cdp.send('Runtime.getHeapUsage')).usedSize
        }
        async function cycle() {
          await upload(page)
          await processPhoto(page)
          await button(main(page), ru.btnNewPhoto).click()
          await page.waitForFunction(() => photoQA.workers === 0 && photoQA.bitmaps === 0 && photoQA.urls.size === 0)
        }
        for (let i = 0; i < 2; i++) await cycle()
        const start = await heap()
        for (let i = 0; i < 10; i++) await cycle()
        const end = await heap()
        t.diagnostic('Retained JS heap ' + start + ' → ' + end + ' bytes')
        assert.ok(end <= start * 1.3, start + ' → ' + end)
      })
    })
  } finally {
    await browser?.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})
