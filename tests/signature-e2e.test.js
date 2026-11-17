import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import axe from 'axe-core'
import { chromium, devices } from 'playwright'
import { preview as vitePreview } from 'vite'
import { signatureCopy } from '../src/components/signature/copy.js'
import { photoCopy } from '../src/content/photo-copy.js'
import { processSignature } from '../src/lib/signature.js'
import { translations } from '../src/i18n.js'
import { fixturePng, synthSignature } from './helpers/synthSignature.js'

const ru = signatureCopy.ru
const kz = signatureCopy.kz
const photo = translations.ru
const chrome = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(path => path && existsSync(path))
const portrait = fileURLToPath(new URL('./fixtures/portrait.jpg', import.meta.url))
const samples = new Map()
const png = (variant = 'blue', width = 800, height = 600) => {
  const key = [variant, width, height].join('/')
  if (!samples.has(key)) samples.set(key, fixturePng(synthSignature(variant, width, height)))
  return { name: 'synth-signature.png', mimeType: 'image/png', buffer: samples.get(key) }
}
const main = page => page.locator('#signature-main')
const button = (page, name) => main(page).getByRole('button', { name, exact: true })
const chooseFile = page => main(page).locator('input[type=file]')
const canvas = page => main(page).getByRole('img', { name: ru.result, exact: true }).and(page.locator('canvas'))
const downloadLink = (page, white = false) => main(page).locator(`a[download="signature${white ? '-white' : ''}.png"]`)
const fingerprint = page => canvas(page).evaluate(element => element.toDataURL())
const waitUntilIdle = page => page.waitForFunction(() =>
  document.querySelector('#signature-main > .signature-status')?.textContent === '')

async function upload(page, file = png()) {
  await chooseFile(page).setInputFiles(file)
  await canvas(page).waitFor()
  await waitUntilIdle(page)
}

async function download(page, white = false) {
  const link = downloadLink(page, white)
  await link.waitFor()
  const [saved] = await Promise.all([page.waitForEvent('download'), link.click()])
  const bytes = await readFile(await saved.path())
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  return bytes
}

async function inspectImage(page, bytes, type = 'image/png') {
  return page.evaluate(async ({ base64, type }) => {
    const blob = new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type })
    const image = await createImageBitmap(blob)
    try {
      const { width, height } = image
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(
        ([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data))
      const data = ctx.getImageData(0, 0, width, height).data
      let opacity = 0
      let left = width
      let right = -1
      let top = height
      let bottom = -1
      for (let i = 0; i < data.length; i += 4) {
        opacity = Math.max(opacity, data[i + 3])
        if (data[i + 3] < 128 || Math.min(data[i], data[i + 1], data[i + 2]) > 180) continue
        const x = (i / 4) % width
        const y = Math.floor(i / 4 / width)
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
      return { corners, opacity, width, height, inkWidth: right - left + 1, inkHeight: bottom - top + 1 }
    } finally {
      image.close()
    }
  }, { base64: bytes.toString('base64'), type })
}

async function accessibility(page) {
  await page.evaluate(axe.source)
  assert.deepEqual(await page.evaluate(async () =>
    (await axe.run()).violations.map(({ id, nodes }) => [id, nodes.map(node => node.target)])), [])
}

test('signature tool in the production build', { timeout: 240000 }, async suite => {
  if (!chrome) return suite.skip('Chromium unavailable. Run npx playwright install chromium.')
  const server = await vitePreview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4199 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const csp = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8'))
    .match(/^  Content-Security-Policy: (.+)$/m)[1].trim()
  let browser
  try {
    browser = await chromium.launch({
      executablePath: chrome,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    })
    async function withPage(run, options = {}, path = '/signature') {
      const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1366, height: 900 }, ...options })
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      const errors = []
      const requests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        // MediaPipe writes a CPU-init info message to stderr in the photo wizard.
        if (message.type() === 'error' && message.text() !== 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.') {
          errors.push(message.text())
        }
      })
      page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
      await page.addInitScript(() => {
        window.signatureQA = { violations: [], tasks: [], workers: 0, exports: 0, urls: new Set() }
        document.addEventListener('securitypolicyviolation', event => signatureQA.violations.push(event.violatedDirective))
        new PerformanceObserver(list => signatureQA.tasks.push(...list.getEntries().map(task => task.duration)))
          .observe({ type: 'longtask', buffered: true })
        const NativeWorker = window.Worker
        const terminate = NativeWorker.prototype.terminate
        const post = NativeWorker.prototype.postMessage
        NativeWorker.prototype.postMessage = function (message, ...options) {
          if (message?.action === 'export') signatureQA.exports++
          return post.call(this, message, ...options)
        }
        const active = new WeakSet()
        NativeWorker.prototype.terminate = function () {
          if (active.delete(this)) signatureQA.workers--
          return terminate.call(this)
        }
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args)
            active.add(this)
            signatureQA.workers++
          }
        }
        const create = URL.createObjectURL
        const revoke = URL.revokeObjectURL
        URL.createObjectURL = blob => {
          const url = create(blob)
          signatureQA.urls.add(url)
          return url
        }
        URL.revokeObjectURL = url => {
          signatureQA.urls.delete(url)
          return revoke(url)
        }
      })
      try {
        const response = await page.goto(origin + path)
        assert.equal(response.status(), 200)
        assert.equal(response.headers()['content-security-policy'], csp)
        await run(page, { response, requests, context })
        assert.deepEqual(await page.evaluate(() => signatureQA.violations), [])
        assert.deepEqual(errors, [])
        assert.deepEqual(requests.filter(({ url, method }) => url.startsWith('http') &&
          (!url.startsWith(origin + '/') || method !== 'GET')), [])
      } finally {
        await context.close()
      }
    }

    await suite.test('direct route, metadata, sitemap, and real 404', async () => {
      await withPage(async (page, { response }) => {
        assert.equal(response.request().redirectedFrom(), null)
        assert.match(await page.title(), /Подпись из фото в PNG/)
        await main(page).getByRole('heading', { level: 1, name: ru.title }).waitFor()
        const canonical = 'https://photo.nexcel.kz/signature/'
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), canonical)
        assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical)
        assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title())
        assert.match(await page.locator('meta[name=description]').getAttribute('content'), /рукописной подписи/)
        assert.match(await (await page.request.get(origin + '/sitemap.xml')).text(), /<loc>https:\/\/photo\.nexcel\.kz\/signature\/<\/loc>/)
        assert.equal((await page.request.get(origin + '/og-signature.png')).status(), 200)
        assert.equal((await page.request.get(origin + '/missing-tool')).status(), 404)
      })
    })

    await suite.test('tabs load signature lazily and keep the photo result', async t => {
      await withPage(async (page, { requests }) => {
        const photoMain = page.locator('#wizard-main')
        await photoMain.getByRole('heading', { level: 1 }).waitFor()
        assert.ok(!requests.some(({ url }) => /SignaturePage-|signature-worker-/.test(url)))
        const hasPortrait = existsSync(portrait)
        const labels = photoCopy.ru
        if (hasPortrait) {
          await photoMain.locator('input[type=file]').setInputFiles(portrait)
          const settings = page.getByRole('dialog', { name: labels.settings })
          await settings.locator('input[name=photo-background][value=original]').check()
          await settings.getByRole('button', { name: labels.process, exact: true }).click()
          await photoMain.getByRole('heading', { name: photo.step5Title }).waitFor({ timeout: 20000 })
        } else {
          t.diagnostic('Portrait fixture unavailable; checked tab and history navigation from the first photo step.')
        }
        const nav = page.getByRole('navigation', { name: photo.site.toolNavigation })
        const photoTab = nav.getByRole('link', { name: photo.site.photoService })
        const signatureTab = nav.getByRole('link', { name: photo.site.signatureTab })
        await signatureTab.click()
        await main(page).getByRole('heading', { level: 1 }).waitFor()
        assert.equal(await signatureTab.getAttribute('aria-current'), 'page')
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://photo.nexcel.kz/signature/')
        assert.equal(await photoMain.isVisible(), false)
        await photoTab.click()
        assert.equal(await photoTab.getAttribute('aria-current'), 'page')
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://photo.nexcel.kz/')
        const name = hasPortrait ? photo.step5Title : photo.step1Title
        await photoMain.getByRole('heading', { name, exact: true }).waitFor()
        if (hasPortrait) await photoMain.getByRole('link', { name: labels.download, exact: true }).waitFor()
        await page.goBack()
        await main(page).getByRole('heading', { level: 1 }).waitFor()
        await page.goBack()
        await photoMain.getByRole('heading', { name, exact: true }).waitFor()
        if (hasPortrait) await photoMain.getByRole('link', { name: labels.download, exact: true }).waitFor()
      }, {}, '/')
    })

    await suite.test('transparent RGBA, padded bounds, white output, and copying PNG', async () => {
      await withPage(async (page, { context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await upload(page)
        await button(page, ru.finish).click()
        const transparent = await download(page)
        const white = await download(page, true)
        assert.equal(transparent[25], 6)
        const source = synthSignature('blue')
        const expected = processSignature(source.data, source.width, source.height)
        const result = await inspectImage(page, transparent)
        assert.equal(result.width, expected.width)
        assert.equal(result.height, expected.height)
        assert.equal(result.opacity, 255)
        assert.ok(result.corners.every(pixel => pixel[3] === 0))
        assert.ok((await inspectImage(page, white)).corners.every(pixel => pixel.every(channel => channel === 255)))
        await button(page, ru.copy).click()
        await main(page).getByText(ru.copied, { exact: true }).waitFor()
        assert.ok(await page.evaluate(async () => (await navigator.clipboard.read())[0].types.includes('image/png')))
      })
    })

    await suite.test('eGov mode fills the white JPEG with the signature and preserves PNG', async () => {
      const { defaultBrowserType, ...mobile } = devices['iPhone 13']
      await withPage(async page => {
        await upload(page, png('blue', 360, 260))
        await button(page, ru.finish).click()
        const original = await download(page)
        await main(page).getByLabel(ru.outputFormat).selectOption({ label: ru.egovMode })
        const link = main(page).getByRole('link', { name: ru.downloadEgov, exact: true })
        await link.waitFor()
        const source = main(page).getByRole('link', { name: /Образцы фотографий и подписей/ })
        assert.equal(await source.getAttribute('href'), 'https://zan.gov.kz/client/#!/doc/140840/rus/158')
        assert.equal(await source.getAttribute('target'), '_blank')
        assert.equal(await source.getAttribute('rel'), 'noopener noreferrer')
        assert.ok(await main(page).getByText(ru.egovSmall, { exact: true }).isVisible())
        assert.equal(await main(page).getByLabel(ru.width, { exact: true }).count(), 0)
        const [saved] = await Promise.all([page.waitForEvent('download'), link.click()])
        assert.equal(saved.suggestedFilename(), 'signature-egov.jpg')
        const bytes = await readFile(await saved.path())
        assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
        const jpeg = await inspectImage(page, bytes, 'image/jpeg')
        assert.ok(jpeg.width >= 550)
        assert.ok(jpeg.height >= 124)
        assert.ok(jpeg.corners.every(pixel => pixel.every(channel => channel >= 253)))
        assert.ok(jpeg.inkWidth / jpeg.width > 0.85 && jpeg.inkHeight / jpeg.height > 0.55, JSON.stringify(jpeg))
        assert.ok(await page.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth))
        await accessibility(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await main(page).getByRole('link', { name: kz.downloadEgov, exact: true }).waitFor()
        assert.ok(await main(page).getByText(kz.egovSmall, { exact: true }).isVisible())
        await accessibility(page)
        await main(page).getByLabel(kz.outputFormat).selectOption('png')
        assert.deepEqual(await download(page), original)
      }, mobile)
    })

    await suite.test('crop, keyboard sliders, brush erase and restore, before/after, and reset', async () => {
      await withPage(async page => {
        await upload(page)
        const baseline = await fingerprint(page)
        const thickness = main(page).getByRole('slider', { name: ru.thickness, exact: true })
        await thickness.press('ArrowRight')
        await waitUntilIdle(page)
        assert.equal(await thickness.inputValue(), '1')
        assert.notEqual(await fingerprint(page), baseline)
        await thickness.press('ArrowLeft')
        await waitUntilIdle(page)
        assert.equal(await fingerprint(page), baseline)
        const corner = main(page).getByRole('button', { name: ru.corners[0] })
        await corner.press('ArrowRight')
        await waitUntilIdle(page)
        const mark = await corner.locator('.signature-grip-mark').boundingBox()
        await page.mouse.move(mark.x + mark.width / 2, mark.y + mark.height / 2)
        await page.mouse.down()
        await page.mouse.move(mark.x + 52, mark.y + 22, { steps: 5 })
        await page.mouse.up()
        await waitUntilIdle(page)
        await button(page, ru.reset).click()
        await waitUntilIdle(page)
        assert.equal(await fingerprint(page), baseline)
        await button(page, ru.compare).click()
        assert.equal(await canvas(page).count(), 0)
        await button(page, ru.compare).click()
        assert.equal(await fingerprint(page), baseline)
        const target = await canvas(page).evaluate(element => {
          const { width, left, height, top } = element.getBoundingClientRect()
          const ctx = element.getContext('2d')
          const pixels = ctx.getImageData(0, 0, element.width, element.height).data
          for (let y = Math.floor(element.height * 0.35); y < element.height * 0.65; y++) {
            for (let x = Math.floor(element.width * 0.25); x < element.width * 0.75; x++) {
              if (pixels[(y * element.width + x) * 4 + 3] === 255) {
                return [left + (x + .5) / element.width * width, top + (y + .5) / element.height * height]
              }
            }
          }
          return null
        })
        assert.ok(target)
        await button(page, ru.erase).click()
        await page.mouse.click(...target)
        await waitUntilIdle(page)
        const erased = await fingerprint(page)
        assert.notEqual(erased, baseline)
        await button(page, ru.restore).click()
        await page.mouse.click(...target)
        await waitUntilIdle(page)
        assert.notEqual(await fingerprint(page), erased)
        await button(page, ru.reset).click()
        await waitUntilIdle(page)
        assert.equal(await fingerprint(page), baseline)
      })
    })

    await suite.test('12 MP file, 100 KB and 50 KB limits, fixed width, custom warning', async t => {
      await withPage(async page => {
        await upload(page, png('textured', 4000, 3000))
        await button(page, ru.finish).click()
        const limit = main(page).getByLabel(ru.limit, { exact: true })
        await limit.selectOption('100')
        const hundred = await download(page)
        assert.ok(hundred.length <= 100000)
        assert.ok(hundred.readUInt32BE(16) >= 300)
        assert.ok((await download(page, true)).length <= 100000)
        await limit.selectOption('50')
        const fifty = await download(page)
        assert.ok(fifty.length <= 50000)
        assert.ok(fifty.readUInt32BE(16) >= 300)
        assert.equal((await inspectImage(page, fifty)).opacity, 255)
        t.diagnostic('12 MP, transparent PNG: ' + hundred.length + ' bytes at 100 KB; ' + fifty.length + ' bytes at 50 KB')
        await limit.selectOption('0')
        await main(page).getByLabel(ru.width, { exact: true }).selectOption('600')
        assert.equal((await download(page)).readUInt32BE(16), 600)
        await limit.selectOption('custom')
        const custom = main(page).getByLabel(ru.customLimit, { exact: true })
        await custom.fill('0')
        await main(page).getByText(ru.invalidLimit).waitFor()
        await custom.fill('1')
        await main(page).getByRole('alert').waitFor()
        assert.equal((await download(page)).readUInt32BE(16), 300)
      })
    })

    await suite.test('blank, dark, non-image and corrupt inputs have specific messages', async () => {
      await withPage(async page => {
        await chooseFile(page).setInputFiles({ name: 'text.txt', mimeType: 'text/plain', buffer: Buffer.from('text') })
        await main(page).getByText(photo.errUnsupportedFormat, { exact: true }).waitFor()
        await chooseFile(page).setInputFiles({
          name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.of(255, 216, 255, 0, 0, 0),
        })
        await main(page).getByText(photo.errRead, { exact: true }).waitFor()
        await chooseFile(page).setInputFiles(png('blank'))
        await main(page).getByText(ru.noInk, { exact: true }).waitFor()
        assert.equal(await button(page, ru.finish).isEnabled(), false)
        await button(page, ru.new).click()
        await chooseFile(page).setInputFiles(png('dark'))
        await main(page).getByText(ru.dark, { exact: true }).waitFor()
      })
    })

    await suite.test('background swatches change the preview surface without changing PNG bytes', async () => {
      await withPage(async page => {
        await upload(page)
        const baseline = await fingerprint(page)
        await button(page, ru.finish).click()
        const first = await download(page)
        await button(page, ru.edit).click()
        await canvas(page).waitFor()
        for (const [i, name] of ['checker', 'white', 'gray', 'dark'].entries()) {
          const swatch = button(page, ru.backgrounds[i])
          await swatch.click()
          assert.equal(await swatch.getAttribute('aria-pressed'), 'true')
          assert.equal(await main(page).locator('.signature-bg-' + name).count(), 1)
          assert.equal(await fingerprint(page), baseline)
        }
        await button(page, ru.finish).click()
        assert.deepEqual(await download(page), first)
        assert.equal(await page.evaluate(() => signatureQA.exports), 1)
      })
    })

    await suite.test('mobile and tablet sizing, touch crop, and axe in RU and KZ', async () => {
      await withPage(async page => {
        const noOverflow = async () => assert.ok(await page.evaluate(() =>
          document.documentElement.scrollWidth <= window.innerWidth))
        await main(page).getByRole('heading', { name: ru.title }).waitFor()
        await noOverflow()
        await accessibility(page)
        await upload(page)
        await noOverflow()
        await button(page, ru.squareCrop).click()
        const frame = main(page).getByRole('button', { name: ru.moveCrop, exact: true })
        const square = await frame.boundingBox()
        assert.ok(Math.abs(square.width - square.height) < 1)
        const touch = await page.context().newCDPSession(page)
        const grip = await main(page).locator('.signature-grip-mark').first().boundingBox()
        const x = grip.x + grip.width / 2
        const y = grip.y + grip.height / 2
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 36, y: y + 18 }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await waitUntilIdle(page)
        await frame.scrollIntoViewIfNeeded()
        const resized = await frame.boundingBox()
        assert.ok(resized.width < square.width && Math.abs(resized.width - resized.height) < 1)
        const centerX = resized.x + resized.width / 2
        const centerY = resized.y + resized.height / 2
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centerX, y: centerY }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centerX - 24, y: centerY + 5 }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await waitUntilIdle(page)
        const moved = await frame.boundingBox()
        assert.ok(moved.x < resized.x && Math.abs(moved.width - resized.width) < 1)
        await frame.press('ArrowLeft')
        await waitUntilIdle(page)
        assert.ok((await frame.boundingBox()).x < moved.x)
        await accessibility(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await main(page).getByRole('heading', { name: kz.title }).waitFor()
        assert.equal(await page.locator('html').getAttribute('lang'), 'kk')
        assert.equal(await page.title(), translations.kz.site.signatureSeoTitle)
        await page.setViewportSize({ width: 360, height: 800 })
        await noOverflow()
        await page.setViewportSize({ width: 768, height: 900 })
        await noOverflow()
        await button(page, kz.finish).click()
        await downloadLink(page).waitFor()
        await accessibility(page)
      }, { ...devices['iPhone 13'], defaultBrowserType: undefined })
    })

    await suite.test('worker stays off the main thread during preview slider updates', async t => {
      await withPage(async page => {
        await upload(page, png('textured', 1600, 1200))
        const slider = main(page).getByRole('slider', { name: ru.sensitivity, exact: true })
        await slider.focus()
        await page.evaluate(() => { signatureQA.tasks.length = 0 })
        for (let i = 0; i < 16; i++) await slider.press('ArrowRight')
        await waitUntilIdle(page)
        const longest = Math.max(0, ...await page.evaluate(() => signatureQA.tasks))
        t.diagnostic('Longest observed main-thread task: ' + longest + ' ms')
        assert.ok(longest <= 100)
      })
    })

    await suite.test('signature camera uses a paper guide, captures into crop, and processes large uploads', async () => {
      await withPage(async (page, { context }) => {
        await context.grantPermissions(['camera'], { origin })
        await button(page, ru.camera).click()
        const camera = page.getByRole('dialog', { name: photo.cameraSignatureTitle })
        const guide = camera.locator('[data-camera-guide="signature"]')
        await guide.waitFor()
        await camera.getByText(photo.cameraSignatureGuide, { exact: true }).waitFor()
        assert.equal(await guide.locator('[data-camera-silhouette], [data-camera-eye-line]').count(), 0)
        assert.equal(await guide.locator('[data-camera-frame]').count(), 1)
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden')
        await accessibility(page)
        await page.keyboard.press('Escape')
        await camera.waitFor({ state: 'hidden' })
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden')
        await button(page, ru.camera).click()
        const shoot = camera.getByRole('button', { name: photo.cameraSignatureShoot, exact: true })
        await shoot.click()
        await main(page).getByRole('heading', { name: ru.paper }).waitFor()
        await camera.waitFor({ state: 'hidden' })
        await button(page, ru.new).click()
        await upload(page, png('blue', 8000, 1200))
        assert.ok(await canvas(page).evaluate(element => element.width <= 800))
        await button(page, ru.finish).click()
        assert.ok((await download(page)).readUInt32BE(16) <= 1600)
      })
    })

    await suite.test('ten upload, process, export and reset cycles release workers and blob URLs', async t => {
      await withPage(async page => {
        const cdp = await page.context().newCDPSession(page)
        const heap = async () => {
          await cdp.send('HeapProfiler.collectGarbage')
          return (await cdp.send('Runtime.getHeapUsage')).usedSize
        }
        const cycle = async () => {
          await upload(page)
          await button(page, ru.finish).click()
          await downloadLink(page).waitFor()
          await button(page, ru.new).click()
          await button(page, ru.upload).waitFor()
          assert.deepEqual(await page.evaluate(() => [signatureQA.workers, signatureQA.urls.size]), [0, 0])
        }
        for (let i = 0; i < 2; i++) await cycle()
        const initial = await heap()
        for (let i = 0; i < 10; i++) await cycle()
        const end = await heap()
        t.diagnostic('Retained JS heap: ' + initial + ' → ' + end + ' bytes')
        assert.ok(end <= initial * 1.3, initial + ' → ' + end)
      })
    })
  } finally {
    await browser?.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})
