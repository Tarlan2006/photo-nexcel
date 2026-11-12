import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import axe from 'axe-core'
import { chromium, devices } from 'playwright'
import { preview } from 'vite'
import { translations } from '../src/i18n.js'

const ru = translations.ru
const editor = ru.editor
const fixture = (name) => fileURLToPath(new URL('./fixtures/' + name, import.meta.url))
const portrait = fixture('portrait.jpg')
const astronaut = fixture('astronaut.png')
const chromePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  chromium.executablePath(),
  join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(path => path && existsSync(path))

const editorHeading = (page) => page.getByRole('heading', { name: editor.title, exact: true })
const choose = (page, name) => page.getByRole('button', { name, exact: true })
const next = (page) => choose(page, ru.btnNext)
const editorStage = (page, stage) => choose(page, editor[stage])
const original = (page) => page.getByRole('img', { name: editor.original, exact: true })
const edited = (page) => page.getByRole('img', { name: editor.edited, exact: true })
const detectResource = (path) => /face_landmarker|detector-|\/models\/|\/wasm\//.test(path)
const segmentResource = (path) => /\/models\/selfie-multiclass-v1\.tflite$/.test(path)

async function upload(page, file = portrait) {
  await page.locator('input[type=file]').setInputFiles(file)
  await editorHeading(page).waitFor({ timeout: 20000 })
}

async function heading(page, name) {
  await page.getByRole('heading', { name, exact: true }).waitFor()
}

async function canvasData(locator, region) {
  return locator.evaluate((canvas, [x, y, w, h]) => {
    const context = canvas.getContext('2d')
    return Array.from(context.getImageData(
      Math.round(x * canvas.width), Math.round(y * canvas.height),
      Math.min(canvas.width - Math.round(x * canvas.width), w),
      Math.min(canvas.height - Math.round(y * canvas.height), h)
    ).data)
  }, region)
}

const regionDifference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length

async function waitForPixel(page, rgb, coords = [0, 0]) {
  await page.waitForFunction(({ rgb, coords }) => {
    const canvas = [...document.querySelectorAll('main canvas')].find(element =>
      !element.hidden && element.getAttribute('aria-label') === 'Фото с правками')
    if (!canvas) return false
    const [x, y] = coords
    const pixel = canvas.getContext('2d').getImageData(
      Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1
    ).data
    return rgb.every((value, channel) => Math.abs(value - pixel[channel]) <= 2)
  }, { rgb, coords })
}

async function checkAxe(page) {
  await page.evaluate(axe.source)
  assert.deepEqual(await page.evaluate(async () =>
    (await axe.run()).violations.map(({ id, nodes }) => ({ id, elements: nodes.map(node => node.target) }))
  ), [])
}

async function jpeg(page, width, height, limit) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    choose(page, ru.btnDownloadJpeg).click(),
  ])
  const bytes = await readFile(await download.path())
  assert.ok(bytes.length <= limit, bytes.length + ' bytes')
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
  assert.equal(bytes.subarray(-2).toString('hex'), 'ffd9')
  const dimensions = await page.evaluate(async (encoded) => {
    const blob = new Blob([Uint8Array.from(atob(encoded), letter => letter.charCodeAt(0))], { type: 'image/jpeg' })
    const bitmap = await createImageBitmap(blob)
    const result = [bitmap.width, bitmap.height]
    bitmap.close()
    return result
  }, bytes.toString('base64'))
  assert.deepEqual(dimensions, [width, height])
  return bytes
}

function lumaQuantizer(jpegBytes) {
  for (let i = 2; i < jpegBytes.length - 6;) {
    const marker = jpegBytes.readUInt16BE(i)
    if (marker === 0xffdb && jpegBytes[i + 4] === 0) return jpegBytes[i + 5]
    if (marker === 0xffda) break
    i += 2 + jpegBytes.readUInt16BE(i + 2)
  }
  throw new Error('JPEG luma quantization table missing')
}

async function coloredPortrait(page) {
  const base64 = (await readFile(portrait)).toString('base64')
  const data = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), letter => letter.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 600
      const context = canvas.getContext('2d')
      context.fillStyle = '#376c9e'
      context.fillRect(0, 0, 600, 600)
      context.beginPath()
      const points = [[84,511],[94,450],[136,387],[170,345],[184,286],[165,209],[160,156],[188,121],[238,106],[304,107],[352,123],[389,159],[403,217],[394,276],[369,329],[364,383],[416,431],[467,511]]
      for (const [index, [x, y]] of points.entries()) context[index ? 'lineTo' : 'moveTo'](42 + x, 35 + y)
      context.closePath()
      context.clip()
      context.drawImage(bitmap, 42, 35)
      return canvas.toDataURL('image/jpeg', 0.96).split(',')[1]
    } finally { bitmap.close() }
  }, base64)
  return { name: 'colored.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') }
}

async function tinyPortrait(page) {
  const source = (await readFile(portrait)).toString('base64')
  const encoded = await page.evaluate(async (source) => {
    const bytes = Uint8Array.from(atob(source), letter => letter.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 600
      const context = canvas.getContext('2d')
      context.fillStyle = 'white'
      context.fillRect(0, 0, 600, 600)
      context.drawImage(bitmap, 260, 260, 80, 80)
      return canvas.toDataURL('image/jpeg').split(',')[1]
    } finally { bitmap.close() }
  }, source)
  return { name: 'tiny.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(encoded, 'base64') }
}

test('photo editor in the production build', { timeout: 240000 }, async (suite) => {
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
      page.setDefaultTimeout(9000)
      page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }))
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript(() => {
        window.editorQA = { violations: [], longTasks: [], liveWorkers: 0, activeBitmaps: 0 }
        document.addEventListener('securitypolicyviolation', event => editorQA.violations.push(event.violatedDirective))
        new PerformanceObserver(list => {
          editorQA.longTasks.push(...list.getEntries().map(entry => [entry.startTime, entry.duration]))
        }).observe({ type: 'longtask', buffered: true })

        const activeBitmaps = new WeakSet()
        const create = window.createImageBitmap
        const close = ImageBitmap.prototype.close
        const transfer = Worker.prototype.postMessage
        const terminate = Worker.prototype.terminate
        const NativeWorker = window.Worker
        const workers = new WeakSet()
        window.createImageBitmap = async (...args) => {
          const bitmap = await create(...args)
          activeBitmaps.add(bitmap)
          editorQA.activeBitmaps++
          return bitmap
        }
        ImageBitmap.prototype.close = function () {
          if (activeBitmaps.delete(this)) editorQA.activeBitmaps--
          return close.call(this)
        }
        Worker.prototype.postMessage = function (data, list) {
          const result = transfer.call(this, data, list)
          if (Array.isArray(list)) {
            for (const item of list) if (activeBitmaps.delete(item)) editorQA.activeBitmaps--
          }
          return result
        }
        Worker.prototype.terminate = function () {
          if (workers.delete(this)) editorQA.liveWorkers--
          return terminate.call(this)
        }
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args)
            workers.add(this)
            editorQA.liveWorkers++
          }
        }
      })

      try {
        const response = await page.goto(origin)
        assert.equal(response.headers()['content-security-policy'], csp)
        await run(page, requests, context)
        assert.deepEqual(errors, [])
        assert.deepEqual(await page.evaluate(() => editorQA.violations), [])
        assert.deepEqual(requests.filter(request =>
          request.url.startsWith('http') && (!request.url.startsWith(origin + '/') || request.method !== 'GET')
        ), [])
      } finally {
        await context.close()
      }
    }

    await suite.test('five steps are visible, model is lazy, and fake camera stops on Escape', async () => {
      await withPage(async (page, requests) => {
        await heading(page, ru.step1Title)
        const nav = page.getByRole('navigation', { name: ru.stepNavigation })
        assert.deepEqual((await nav.getByRole('button').allTextContents()).map(text => text.replace(/^\d/, '')), ru.stepLabels)
        assert.ok(!requests.some(request => detectResource(request.url)))
        await page.evaluate(() => {
          window.cameraTracks = []
          const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
          navigator.mediaDevices.getUserMedia = async (...args) => {
            const stream = await native(...args)
            cameraTracks.push(...stream.getTracks())
            return stream
          }
        })
        await choose(page, ru.btnShootCamera).click()
        await page.waitForFunction(() => cameraTracks.some(track => track.readyState === 'live'))
        await page.keyboard.press('Escape')
        await page.getByRole('dialog').waitFor({ state: 'hidden' })
        await page.waitForFunction(() => cameraTracks.every(track => track.readyState === 'ended'))
      }, { viewport: { width: 390, height: 844 } })
    })

    const noPortrait = !existsSync(portrait) && 'tests/fixtures/portrait.jpg отсутствует'
    const noAstronaut = !existsSync(astronaut) && 'tests/fixtures/astronaut.png отсутствует'
    await suite.test('upload, skip, document, check, download, browser history and reload', { skip: noPortrait }, async () => {
      await withPage(async (page, requests) => {
        await upload(page)
        assert.ok(!requests.some(request => segmentResource(request.url)))
        await choose(page, editor.skip).click()
        await heading(page, ru.step3Title)
        await page.goBack()
        await editorHeading(page).waitFor()
        await page.goForward()
        await heading(page, ru.step3Title)
        await next(page).click()
        await heading(page, ru.step4Title)
        await page.getByText(ru.checkBgWarn, { exact: true }).waitFor()
        await next(page).click()
        await heading(page, ru.step5Title)
        const skipped = await jpeg(page, 413, 531, 30000)
        await page.getByRole('navigation', { name: ru.stepNavigation }).getByRole('button', { name: ru.stepLabels[1], exact: true }).click()
        await editorHeading(page).waitFor()
        await next(page).click()
        await next(page).click()
        await next(page).click()
        assert.deepEqual(await jpeg(page, 413, 531, 30000), skipped)
        await page.reload()
        await heading(page, ru.step1Title)
      })
    })

    await suite.test('tone, keyboard and double-click reset, undo/redo, monochrome and RU/KZ', { skip: noPortrait }, async () => {
      await withPage(async (page) => {
        await upload(page)
        await editorStage(page, 'tone').click()
        const range = page.getByRole('slider', { name: editor.brightness, exact: true })
        const baseline = await canvasData(original(page), [0.57, 0.55, 20, 20])
        await range.focus()
        for (let i = 0; i < 30; i++) await range.press('ArrowRight')
        assert.equal(await range.inputValue(), '30')
        assert.match(await range.getAttribute('aria-valuetext'), /\+30/)
        await edited(page).waitFor()
        assert.ok(regionDifference(baseline, await canvasData(edited(page), [0.57, 0.55, 20, 20])) > 15)
        await choose(page, 'KZ').click()
        assert.equal(await page.getByRole('slider', { name: translations.kz.editor.brightness }).inputValue(), '30')
        await choose(page, 'RU').click()
        await range.dispatchEvent('dblclick')
        assert.equal(await range.inputValue(), '0')
        await edited(page).waitFor({ state: 'hidden' })
        await choose(page, editor.undo).click()
        assert.equal(await range.inputValue(), '30')
        await choose(page, editor.redo).click()
        assert.equal(await range.inputValue(), '0')
        await editorStage(page, 'filters').click()
        await choose(page, editor.mono).click()
        await edited(page).waitFor()
        assert.ok(!(await next(page).isEnabled()))
        assert.ok(await page.getByText(editor.monoWarning).isVisible())
        const mono = await canvasData(edited(page), [0.57, 0.55, 1, 1])
        assert.equal(mono[0], mono[1])
        assert.equal(mono[0], mono[2])
        await choose(page, editor.reset).click()
        assert.ok(await next(page).isEnabled())
      })
    })

    await suite.test('pencil accepts a freehand outline, applies color, and works without segmentation', { skip: noPortrait }, async () => {
      await withPage(async (page, requests) => {
        await upload(page)
        await choose(page, editor.pencil).click()
        const area = page.getByRole('group', { name: editor.drawCanvas })
        const rect = await area.boundingBox()
        assert.ok(rect && !(await next(page).isEnabled()))
        const draw = async (x, y, steps) => page.mouse.move(rect.x + rect.width * x, rect.y + rect.height * y, { steps })
        await draw(0.19, 0.18, 1)
        await page.mouse.down()
        await draw(0.82, 0.19, 12)
        await draw(0.86, 0.95, 12)
        await draw(0.18, 0.95, 12)
        await page.mouse.up()
        await choose(page, editor.applyOutline).click()
        await waitForPixel(page, [255, 255, 255])
        await next(page).click()
        await heading(page, ru.step3Title)
        await choose(page, ru.btnBack).click()
        await editorHeading(page).waitFor()
        await waitForPixel(page, [255, 255, 255])
        assert.ok(!requests.some(request => segmentResource(request.url)))
      }, { viewport: { width: 390, height: 844 } })
    })

    await suite.test('automatic mask, colors, edge preview, cached offline recolor, and performance', { skip: noPortrait }, async (t) => {
      await withPage(async (page, requests, context) => {
        const colored = await coloredPortrait(page)
        await upload(page, colored)
        await page.getByText(editor.backgroundSuggestion).waitFor()
        const faceBefore = await canvasData(original(page), [0.57, 0.52, 20, 20])
        const start = await page.evaluate(() => performance.now())
        const requested = performance.now()
        await choose(page, editor.automatic).click()
        await waitForPixel(page, [255, 255, 255])
        const elapsed = performance.now() - requested
        const worker = page.workers().find(item => item.url().includes('editor-worker'))
        const inference = await worker?.evaluate(() => performance.getEntriesByName('photo-editor-segmentation').at(-1)?.duration)
        t.diagnostic('Cold model and preview: ' + Math.round(elapsed) + ' ms. Inference and mask: ' + Math.round(inference) + ' ms.')
        assert.ok(inference < 6000, 'Segmentation: ' + inference + ' ms')
        const longest = await page.evaluate((start) => Math.max(0, ...editorQA.longTasks.filter(([time]) => time >= start).map(([, duration]) => duration)), start)
        t.diagnostic('Longest main-thread task in editor: ' + Math.round(longest) + ' ms.')
        assert.ok(longest <= 100, 'Main-thread task: ' + longest + ' ms')
        for (const point of [[0,0],[0.96,0],[0,0.96],[0.96,0.96]]) {
          const corners = await canvasData(edited(page), [...point, 20, 20])
          assert.ok(corners.every(value => value >= 253))
        }
        const faceAfter = await canvasData(edited(page), [0.57, 0.52, 20, 20])
        assert.ok(regionDifference(faceBefore, faceAfter) < 3)
        await edited(page).evaluate(canvas => {
          window.compositeForEdgeTest = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        })
        await page.getByRole('checkbox', { name: editor.showMask }).check()
        const mask = page.getByRole('img', { name: editor.mask })
        await mask.waitFor()
        await page.waitForFunction(() => {
          const canvas = document.querySelector('canvas[aria-label="Маска человека"]')
          return canvas && canvas.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 0
        })
        const edge = await mask.evaluate(canvas => {
          const { width, height } = canvas
          const image = document.querySelector('canvas[aria-label="Исходное фото"]')
          const original = image.getContext('2d').getImageData(0, 0, width, height).data
          const matte = canvas.getContext('2d').getImageData(0, 0, width, height).data
          const composite = window.compositeForEdgeTest
          delete window.compositeForEdgeTest
          let before = 0
          let after = 0
          let count = 0
          for (let i = 0; i < Math.floor(height * 0.55) * width * 4; i += 4) {
            if (matte[i] < 10 || matte[i] > 75) continue
            count++
            for (let c = 0; c < 3; c++) {
              before += 255 - original[i + c]
              after += 255 - composite[i + c]
            }
          }
          return { before, after, count }
        })
        assert.ok(edge.count > 10 && edge.after < edge.before * 0.5, JSON.stringify(edge))
        await page.getByRole('checkbox', { name: editor.showMask }).uncheck()
        await context.setOffline(true)
        await choose(page, editor.gray).click()
        await waitForPixel(page, [240, 240, 240])
        await choose(page, editor.blue).click()
        await waitForPixel(page, [220, 233, 245])
        assert.equal(requests.filter(request => segmentResource(request.url)).length, 1)
        await context.setOffline(false)
        await next(page).click()
        await heading(page, ru.step3Title)
        await choose(page, editor.applyColor).click()
        await next(page).click()
        await heading(page, ru.step4Title)
        assert.equal(requests.filter(request => segmentResource(request.url)).length, 1)
        await page.getByText(ru.checkBgOk, { exact: true }).waitFor()
      })
    })

    await suite.test('bad input and failed model are reported; manual editing remains available', { skip: noPortrait }, async () => {
      await withPage(async (page, requests, context) => {
        await page.locator('input[type=file]').setInputFiles({
          name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0),
        })
        await page.getByText(ru.errRead).waitFor()
        await page.locator('input[type=file]').setInputFiles(await tinyPortrait(page))
        await page.getByText(ru.errNoFace, { exact: true }).or(page.getByText(ru.errSmallFace, { exact: true })).waitFor()
        assert.ok(!requests.some(request => segmentResource(request.url)))
        await upload(page)
        await context.route('**/models/*.tflite', route => route.abort())
        await choose(page, editor.automatic).click()
        await page.getByText(editor.modelError).waitFor({ timeout: 20000 })
        assert.ok(!(await next(page).isEnabled()))
        await choose(page, editor.pencil).click()
        const area = page.getByRole('group', { name: editor.drawCanvas })
        await area.press('Shift+ArrowUp')
        await area.press('Enter')
        for (let i = 0; i < 3; i++) await area.press('Shift+ArrowRight')
        await area.press('Enter')
        for (let i = 0; i < 4; i++) await area.press('Shift+ArrowDown')
        await area.press('Enter')
        assert.ok(await choose(page, editor.applyOutline).isEnabled())
        await choose(page, editor.applyOutline).click()
        await waitForPixel(page, [255, 255, 255])
      })
    })

    await suite.test('edited JPEG meets both document limits and DV shows the filter warning', { skip: noPortrait }, async (t) => {
      await withPage(async (page) => {
        await upload(page, await coloredPortrait(page))
        await choose(page, editor.automatic).click()
        await waitForPixel(page, [255, 255, 255])
        await editorStage(page, 'filters').click()
        await choose(page, editor.soft).click()
        await next(page).click()
        await heading(page, ru.step3Title)
        assert.equal(await page.getByText(editor.dvFilterWarning).count(), 0)
        await next(page).click()
        await next(page).click()
        const kz = await jpeg(page, 413, 531, 30000)
        t.diagnostic('KZ JPEG: ' + kz.length + ' bytes, first luma quantizer ' + lumaQuantizer(kz))
        assert.ok(lumaQuantizer(kz) <= 13)
        await choose(page, ru.btnOtherDoc).click()
        await page.locator('#dv').check()
        await page.getByText(editor.dvFilterWarning).waitFor()
        await page.getByText(editor.dvBackgroundWarning).waitFor()
        await next(page).click()
        await next(page).click()
        const dv = await jpeg(page, 600, 600, 240000)
        t.diagnostic('DV JPEG: ' + dv.length + ' bytes, first luma quantizer ' + lumaQuantizer(dv))
        assert.ok(lumaQuantizer(dv) <= 13)
      })
    })

    await suite.test('both suit styles preserve the face and can be removed', { skip: noAstronaut }, async () => {
      await withPage(async (page) => {
        await upload(page, astronaut)
        await editorStage(page, 'suit').click()
        assert.equal(await choose(page, editor.dark).count(), 0)
        const faceBefore = await canvasData(original(page), [0.42, 0.22, 20, 20])
        const neckBefore = await canvasData(original(page), [0.42, 0.36, 20, 10])
        const clothesBefore = await canvasData(original(page), [0.32, 0.52, 50, 50])
        for (const gender of [editor.male, editor.female]) {
          await choose(page, gender).click()
          await choose(page, editor.dark).click()
          await edited(page).waitFor({ timeout: 20000 })
          const faceAfter = await canvasData(edited(page), [0.42, 0.22, 20, 20])
          const neckAfter = await canvasData(edited(page), [0.42, 0.36, 20, 10])
          const clothesAfter = await canvasData(edited(page), [0.32, 0.52, 50, 50])
          assert.equal(regionDifference(faceBefore, faceAfter), 0)
          assert.equal(regionDifference(neckBefore, neckAfter), 0)
          assert.ok(regionDifference(clothesBefore, clothesAfter) > 4)
          await choose(page, editor.removeSuit).click()
          await edited(page).waitFor({ state: 'hidden' })
        }
        await choose(page, editor.skipSuit).click()
        assert.equal(await choose(page, editor.dark).count(), 0)
        await choose(page, editor.female).click()
        await choose(page, editor.light).click()
        await edited(page).waitFor()
        await next(page).click()
        await page.locator('#dv').check()
        await page.getByText(editor.dvSuitWarning).waitFor()
      })
    })

    await suite.test('mobile and tablet editor layout, touch contour and axe', { skip: noPortrait }, async () => {
      await withPage(async (page) => {
        await upload(page)
        const checkLayout = async () => assert.ok(await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ))
        await checkLayout()
        await checkAxe(page)
        await choose(page, editor.pencil).click()
        const area = page.getByRole('group', { name: editor.drawCanvas })
        const box = await area.boundingBox()
        const client = await page.context().newCDPSession(page)
        const positions = [[0.2,0.2],[0.8,0.2],[0.85,0.88],[0.18,0.88]]
        for (const [index, [x, y]] of positions.entries()) {
          await client.send('Input.dispatchTouchEvent', {
            type: index ? 'touchMove' : 'touchStart',
            touchPoints: [{ x: box.x + x * box.width, y: box.y + y * box.height }],
          })
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await choose(page, editor.applyOutline).click()
        await waitForPixel(page, [255,255,255])
        await checkAxe(page)
        await page.setViewportSize({ width: 768, height: 1000 })
        await checkLayout()
        await checkAxe(page)
      }, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })
    })

    await suite.test('phone and laptop show only one settings section and keep the photo on the left', { skip: noPortrait }, async () => {
      for (const viewport of [{ width: 360, height: 740 }, { width: 1280, height: 720 }]) {
        await withPage(async (page) => {
          await upload(page)
          const stages = ['background', 'tone', 'filters', 'suit']
          const stage = key => editorStage(page, key)
          const checkExpanded = async (selected) => {
            for (const key of stages) {
              const header = stage(key)
              assert.equal(await header.getAttribute('aria-expanded'), String(key === selected))
              const panel = page.locator('#' + await header.getAttribute('aria-controls'))
              assert.equal(await panel.isVisible(), key === selected)
              assert.ok(await header.isVisible())
            }
          }
          const actions = page.getByRole('group', { name: editor.stagePicker, exact: true })
          const done = () => actions.getByRole('button', { name: editor.stageDone, exact: true }).click()
          const preview = await original(page).boundingBox()
          const picker = await stage('background').boundingBox()
          assert.ok(preview.x + preview.width <= picker.x)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
          const bottomBar = await page.locator('#wizard-bottom-bar').boundingBox()
          const stageActions = await actions.boundingBox()
          assert.ok(stageActions.y + stageActions.height <= bottomBar.y)
          assert.ok(preview.y + preview.height <= bottomBar.y)

          await checkExpanded('background')
          assert.equal(await page.getByRole('slider', { name: editor.brightness }).count(), 0)
          const beforeScroll = await original(page).boundingBox()
          const filtersHeader = await stage('filters').boundingBox()
          const scrollTop = await page.getByRole('region', { name: editor.background, exact: true }).evaluate(element => {
            element.scrollTop = element.scrollHeight
            return element.scrollTop
          })
          if (viewport.width === 360) assert.ok(scrollTop > 0)
          assert.deepEqual(await original(page).boundingBox(), beforeScroll)
          assert.deepEqual(await stage('filters').boundingBox(), filtersHeader)
          await choose(page, editor.gray).click()
          await done()

          await checkExpanded('tone')
          assert.equal(await choose(page, editor.automatic).count(), 0)
          await page.getByRole('slider', { name: editor.brightness }).press('ArrowRight')
          await stage('filters').press('Enter')
          await checkExpanded('filters')
          assert.equal(await page.getByRole('slider', { name: editor.brightness }).count(), 0)
          await choose(page, editor.soft).click()
          await actions.getByRole('button', { name: editor.previousStage, exact: true }).click()
          await checkExpanded('tone')
          assert.equal(await page.getByRole('slider', { name: editor.brightness }).inputValue(), '1')
          await stage('background').click()
          await checkExpanded('background')
          assert.equal(await choose(page, editor.gray).getAttribute('aria-pressed'), 'true')
          await stage('background').click()
          await checkExpanded(null)
          await stage('filters').click()
          assert.equal(await choose(page, editor.soft).getAttribute('aria-pressed'), 'true')
          await done()
          await checkExpanded('suit')
          await checkAxe(page)
          await done()
          await heading(page, ru.step3Title)
        }, viewport.width === 360 ? { ...devices['Pixel 7'], viewport } : { viewport })
      }
    })

    await suite.test('mobile pinch and pan leave no brush marks, and intentional strokes still reach JPEG', { skip: noPortrait }, async () => {
      await withPage(async (page, requests, context) => {
        await upload(page, await coloredPortrait(page))
        assert.equal(await choose(page, editor.brush).count(), 0)
        await choose(page, editor.automatic).click()
        await waitForPixel(page, [255, 255, 255])

        const point = [0.57, 0.52]
        const getPixel = (locator, coords = point) => locator.evaluate((canvas, [x, y]) => Array.from(canvas.getContext('2d')
          .getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data.slice(0, 3)), coords)
        const before = await getPixel(edited(page))
        assert.notDeepEqual(before, [255, 255, 255])
        await choose(page, editor.brush).click()
        const area = page.getByRole('group', { name: editor.brushCanvas })
        const tools = page.getByRole('group', { name: editor.brush, exact: true })
        const client = await context.newCDPSession(page)
        const imageBytes = () => edited(page).evaluate(canvas => canvas.toDataURL())
        const initial = await imageBytes()
        await area.evaluate(element => element.scrollIntoView({ block: 'center' }))
        const surface = await area.boundingBox()
        const touch = (type, positions) => client.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: positions.map(([id, x, y]) => ({ id, x: surface.x + x * surface.width, y: surface.y + y * surface.height })),
        })
        await touch('touchStart', [[1, 0.57, 0.52]])
        await touch('touchMove', [[1, 0.54, 0.52]])
        await touch('touchStart', [[1, 0.54, 0.52], [2, 0.81, 0.52]])
        await touch('touchMove', [[1, 0.38, 0.52], [2, 0.95, 0.52]])
        await page.waitForFunction(width => {
          const image = document.querySelector('canvas[aria-label="Фото с правками"]')
          return image?.getBoundingClientRect().width > width * 1.5
        }, surface.width)
        const zoomed = await edited(page).boundingBox()
        await touch('touchMove', [[1, 0.32, 0.47], [2, 0.89, 0.47]])
        await page.waitForFunction(({ x, y }) => {
          const image = document.querySelector('canvas[aria-label="Фото с правками"]')
          const rect = image?.getBoundingClientRect()
          return rect && rect.left < x - 5 && rect.top < y - 5
        }, zoomed)
        const panned = await edited(page).boundingBox()
        await touch('touchEnd', [[1, 0.32, 0.47]])
        await touch('touchMove', [[2, 0.57, 0.47]])
        await touch('touchEnd', [])
        assert.equal(await area.locator('path').count(), 0)
        assert.deepEqual(await edited(page).boundingBox(), panned)
        assert.equal(await imageBytes(), initial)

        const paint = async ([x, y], finish = 'touchEnd') => {
          await area.evaluate(element => element.scrollIntoView({ block: 'center' }))
          const canvas = page.locator('canvas[aria-label="' + editor.original + '"]')
          const box = await canvas.evaluate(element => {
            const rect = element.getBoundingClientRect()
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
          })
          for (const [index, offset] of [-0.02, 0, 0.02].entries()) {
            await client.send('Input.dispatchTouchEvent', {
              type: index ? 'touchMove' : 'touchStart',
              touchPoints: [{ x: box.x + (x + offset) * box.width, y: box.y + y * box.height }],
            })
          }
          await client.send('Input.dispatchTouchEvent', { type: finish, touchPoints: [] })
        }
        await paint(point, 'touchCancel')
        assert.deepEqual(await getPixel(edited(page)), before)
        await paint(point)
        await waitForPixel(page, [255, 255, 255], point)
        await tools.getByRole('button', { name: editor.undo, exact: true }).click()
        await waitForPixel(page, before, point)
        assert.equal(await imageBytes(), initial)
        await tools.getByRole('button', { name: editor.redo, exact: true }).click()
        await waitForPixel(page, [255, 255, 255], point)
        await checkAxe(page)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth))

        const exportKz = async () => {
          await tools.getByRole('button', { name: editor.brushDone, exact: true }).click()
          await next(page).click()
          await heading(page, ru.step3Title)
          await next(page).click()
          await heading(page, ru.step4Title)
          await next(page).click()
          return jpeg(page, 413, 531, 30000)
        }
        const erased = await exportKz()
        await page.getByRole('navigation', { name: ru.stepNavigation }).getByRole('button', { name: ru.stepLabels[1] }).click()
        await editorHeading(page).waitFor()
        await waitForPixel(page, [255, 255, 255], point)
        await choose(page, editor.brush).click()
        await tools.getByRole('button', { name: editor.brushRestore }).click()
        const showOriginal = tools.getByRole('button', { name: editor.brushOriginal })
        const missed = [0.57, 0.18]
        await waitForPixel(page, [255, 255, 255], missed)
        await showOriginal.click()
        const originalRgb = await getPixel(original(page))
        const missedRgb = await getPixel(original(page), missed)
        await paint(point)
        await paint(missed)
        await showOriginal.click()
        await waitForPixel(page, originalRgb, point)
        await waitForPixel(page, missedRgb, missed)
        const restored = await exportKz()
        assert.notDeepEqual(restored, erased)
        assert.equal(requests.filter(request => segmentResource(request.url)).length, 1)
      }, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } })
    })

    await suite.test('ten edit/reset cycles release image resources and do not retain heap', { skip: noPortrait }, async (t) => {
      await withPage(async (page, requests, context) => {
        const client = await context.newCDPSession(page)
        await client.send('Performance.enable')
        const heap = async () => {
          await client.send('HeapProfiler.collectGarbage')
          return (await client.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize').value
        }
        let warmed
        for (let cycle = 0; cycle < 10; cycle++) {
          await upload(page)
          if (cycle < 2 || cycle === 9) {
            await choose(page, editor.automatic).click()
          } else {
            await editorStage(page, 'tone').click()
            await page.getByRole('slider', { name: editor.brightness }).press('ArrowRight')
          }
          await edited(page).waitFor()
          await choose(page, editor.reset).click()
          await next(page).click()
          await next(page).click()
          await next(page).click()
          await choose(page, ru.btnNewPhoto).click()
          await heading(page, ru.step1Title)
          await page.waitForFunction(() => editorQA.liveWorkers === 0 && editorQA.activeBitmaps === 0)
          if (cycle === 1) warmed = await heap()
        }
        const final = await heap()
        t.diagnostic('Retained JS heap after warm-up and final cycle: ' + warmed + ' → ' + final + ' bytes.')
        assert.ok(final <= warmed * 1.3)
        assert.equal(requests.filter(request => segmentResource(request.url)).length, 3)
      })
    })
  } finally {
    await browser?.close()
    await server.close()
  }
})
