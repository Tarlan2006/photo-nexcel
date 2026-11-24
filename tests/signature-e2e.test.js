import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
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
import { fixturePng, fixtureY4m, synthSignature } from './helpers/synthSignature.js'

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

async function downloadEgov(page, copy = ru) {
  const link = main(page).getByRole('link', { name: copy.downloadEgov, exact: true })
  await link.waitFor()
  const [saved] = await Promise.all([page.waitForEvent('download'), link.click()])
  const bytes = await readFile(await saved.path())
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
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
      let opacity = 0, coloredInk = 0
      let left = width
      let right = -1
      let top = height
      let bottom = -1
      for (let i = 0; i < data.length; i += 4) {
        opacity = Math.max(opacity, data[i + 3])
        if (data[i + 3] < 128 || Math.min(data[i], data[i + 1], data[i + 2]) > 180) continue
        if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 3) coloredInk++
        const x = (i / 4) % width
        const y = Math.floor(i / 4 / width)
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
      return { corners, opacity, width, height, coloredInk, left, right, top, bottom, inkWidth: right - left + 1, inkHeight: bottom - top + 1 }
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

async function checkSignatureCamera(page, lang = 'ru') {
  const labels = translations[lang]
  const camera = page.getByRole('dialog', { name: labels.cameraSignatureTitle })
  const guide = camera.locator('[data-camera-guide="signature"]')
  const error = camera.getByRole('alert')
  await guide.or(error).first().waitFor()
  if (await error.isVisible()) assert.fail(await error.innerText())
  await camera.getByText(signatureCopy[lang].captureTips[1], { exact: true }).waitFor()
  assert.equal(await camera.locator('[data-camera-silhouette], [data-camera-eye-line], [data-camera-outside]').count(), 0)
  assert.equal(await guide.locator('path, ellipse, line').count(), 0)
  assert.equal(await camera.getByText(labels.cameraGuideFace, { exact: true }).count(), 0)
  assert.equal(await camera.getByRole('button', { name: labels.cameraShoot, exact: true }).count(), 0)
  assert.equal(await guide.locator('[data-camera-frame]').count(), 1)
  const frame = await guide.locator('[data-camera-frame]').boundingBox()
  const video = await camera.locator('video').boundingBox()
  const ratio = await guide.locator('[data-camera-frame]').evaluate(el => el.width.baseVal.value / el.height.baseVal.value)
  assert.ok(frame.width > 100 && Math.abs(ratio - 550 / 124) < 1e-6, JSON.stringify({ frame, video }))
  assert.ok(Math.abs(frame.x + frame.width / 2 - video.x - video.width / 2) < 1)
  assert.ok(Math.abs(frame.y + frame.height / 2 - video.y - video.height / 2) < 1)
  assert.ok(frame.width < video.width && frame.height < video.height)
  assert.equal(await camera.locator('[data-signature-safe]').count(), 1)
  assert.equal(await camera.locator('video').evaluate(el => getComputedStyle(el).transform), 'none')
  const toggle = camera.getByRole('button', { name: signatureCopy[lang].contour, exact: true })
  await toggle.click()
  assert.equal(await guide.count(), 0)
  await toggle.click()
  await guide.waitFor()
  assert.equal(await page.evaluate(() => signatureQA.media.at(-1).video.facingMode), 'environment')
  return camera
}

test('signature tool in the production build', { timeout: 240000 }, async suite => {
  if (!chrome) return suite.skip('Chromium unavailable. Run npx playwright install chromium.')
  const server = await vitePreview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4199 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const csp = (await readFile(new URL('../public/_headers', import.meta.url), 'utf8'))
    .match(/^  Content-Security-Policy: (.+)$/m)[1].trim()
  let browser
  try {
    await mkdir(new URL('../test-results/', import.meta.url), { recursive: true })
    const cameraFile = fileURLToPath(new URL('../test-results/signature-camera.y4m', import.meta.url))
    await writeFile(cameraFile, fixtureY4m(synthSignature('clean', 640, 480)))
    browser = await chromium.launch({
      executablePath: chrome,
      args: ['--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${cameraFile}`],
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
        window.signatureQA = { violations: [], tasks: [], workers: 0, exports: 0, urls: new Set(), media: [] }
        if (navigator.mediaDevices) {
          const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
          navigator.mediaDevices.getUserMedia = constraints => { signatureQA.media.push(constraints); return getMedia(constraints) }
        }
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

    await suite.test('eGov mode frames black ink with margins in white JPEG and preserves PNG', async () => {
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
        assert.ok(await main(page).getByText(ru.lowResolution, { exact: true }).first().isVisible())
        assert.equal(await main(page).getByLabel(ru.width, { exact: true }).count(), 0)
        const [saved] = await Promise.all([page.waitForEvent('download'), link.click()])
        assert.equal(saved.suggestedFilename(), 'signature-egov.jpg')
        const bytes = await readFile(await saved.path())
        assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
        const jpeg = await inspectImage(page, bytes, 'image/jpeg')
        assert.ok(jpeg.width >= 550)
        assert.ok(jpeg.height >= 124)
        assert.ok(jpeg.corners.every(pixel => pixel.every(channel => channel >= 253)))
        assert.equal(jpeg.width / jpeg.height, 550 / 124)
        assert.equal(jpeg.coloredInk, 0)
        assert.ok(jpeg.inkWidth / jpeg.width > .25 && jpeg.inkHeight / jpeg.height > .4, JSON.stringify(jpeg))
        assert.ok(jpeg.top / jpeg.height >= .18 && (jpeg.height - jpeg.bottom - 1) / jpeg.height >= .18, JSON.stringify(jpeg))
        await main(page).getByRole('heading', { name: ru.rulesTitle, exact: true }).waitFor()
        await main(page).getByRole('heading', { name: ru.checksTitle, exact: true }).waitFor()
        const adilet = main(page).getByRole('link', { name: ru.adiletSource, exact: true })
        assert.equal(await adilet.getAttribute('href'), 'https://old.adilet.zan.kz/rus/docs/V2000020192')
        assert.equal(await adilet.getAttribute('rel'), 'noopener noreferrer')
        assert.ok(await page.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth))
        await accessibility(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await main(page).getByRole('link', { name: kz.downloadEgov, exact: true }).waitFor()
        assert.ok(await main(page).getByText(kz.lowResolution, { exact: true }).first().isVisible())
        await main(page).getByRole('heading', { name: kz.rulesTitle, exact: true }).waitFor()
        await accessibility(page)
        await main(page).getByLabel(kz.outputFormat).selectOption('png')
        assert.deepEqual(await download(page), original)
      }, mobile)
    })

    await suite.test('rules and local A4 PDF download work in both languages before upload', async () => {
      await withPage(async page => {
        await mkdir('test-results', { recursive: true })
        for (const [lang, copy] of [['ru', ru], ['kz', kz]]) {
          if (lang === 'kz') await page.getByRole('button', { name: 'KZ', exact: true }).click()
          await main(page).getByRole('heading', { name: copy.rulesTitle, exact: true }).waitFor()
          await main(page).locator('.signature-rules-more').evaluate(details => { details.open = true })
          for (const [title, description] of copy.rules) {
            await main(page).getByRole('heading', { name: title, exact: true }).waitFor()
            await main(page).getByText(description, { exact: true }).waitFor()
          }
          assert.match(await main(page).getByText(copy.revisionNote, { exact: true }).innerText(), /30\.06\.2026 № 456/)
          for (const name of [copy.officialSource, copy.adiletSource]) {
            const source = main(page).getByRole('link', { name, exact: true })
            assert.equal(await source.getAttribute('target'), '_blank')
            assert.equal(await source.getAttribute('rel'), 'noopener noreferrer')
          }
          const [pdf] = await Promise.all([page.waitForEvent('download'), button(page, copy.templateDownload).click()])
          assert.equal(pdf.suggestedFilename(), 'signature-template-a4.pdf')
          const bytes = await readFile(await pdf.path())
          assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4')
          assert.match(bytes.toString('latin1'), /\/MediaBox \[0 0 595\.2755905511812 841\.8897637795277\]/)
          assert.ok(bytes.length > 50000)
          await copyFile(await pdf.path(), `test-results/signature-template-${lang}.pdf`)
          await accessibility(page)
        }
      })
    })

    await suite.test('contour toggle, buttons, range, wheel, pan, fit and centre change the exported frame', async () => {
      await withPage(async page => {
        await upload(page)
        const guide = main(page).locator('[data-signature-guide]')
        const ratio = await guide.locator('[data-signature-frame]').evaluate(el => el.width.baseVal.value / el.height.baseVal.value)
        assert.ok(Math.abs(ratio - 550 / 124) < 1e-6)
        assert.equal(await guide.locator('[data-signature-safe]').count(), 1)
        await button(page, ru.contour).click()
        assert.equal(await guide.count(), 0)
        await button(page, ru.contour).click()
        await guide.waitFor()
        await button(page, ru.finish).click()
        const pngBefore = await download(page)
        await main(page).getByLabel(ru.outputFormat).selectOption('egov')
        const baseline = await downloadEgov(page)
        const slider = main(page).getByRole('slider', { name: ru.zoom, exact: true })
        const initial = Number(await slider.inputValue())
        const image = main(page).getByRole('img', { name: ru.framingImage, exact: true })
        const initialPreview = await image.evaluate(el => el.toDataURL())
        await button(page, ru.zoomIn).click()
        assert.equal(Number(await slider.inputValue()), initial + 10)
        assert.notEqual(await image.evaluate(el => el.toDataURL()), initialPreview)
        assert.notDeepEqual(await downloadEgov(page), baseline)
        await button(page, ru.zoomOut).click()
        assert.equal(Number(await slider.inputValue()), initial)
        await slider.press('End')
        assert.equal(await slider.inputValue(), '400')
        assert.notDeepEqual(await downloadEgov(page), baseline)
        await slider.press('Home')
        assert.equal(await slider.inputValue(), '25')
        assert.notDeepEqual(await downloadEgov(page), baseline)
        await button(page, ru.centerSignature).click()
        assert.deepEqual(await downloadEgov(page), baseline)
        const pan = button(page, ru.panImage)
        await pan.scrollIntoViewIfNeeded()
        await pan.hover()
        await page.mouse.wheel(0, -160)
        await page.waitForFunction(({ name, initial }) => Number(document.querySelector(`input[aria-label="${name}"]`).value) > initial, { name: ru.zoom, initial })
        const wheel = await downloadEgov(page)
        assert.notDeepEqual(wheel, baseline)
        await pan.scrollIntoViewIfNeeded()
        const box = await pan.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 5, { steps: 4 }); await page.mouse.up()
        assert.notDeepEqual(await downloadEgov(page), wheel)
        await button(page, ru.fitFrame).click()
        assert.equal(await slider.inputValue(), '100')
        assert.notDeepEqual(await downloadEgov(page), baseline)
        await button(page, ru.centerSignature).click()
        assert.deepEqual(await downloadEgov(page), baseline)
        assert.equal(await main(page).locator('[data-check="format"]').getAttribute('data-status'), 'pass')
        await accessibility(page)
        await page.screenshot({ path: 'test-results/signature-egov-desktop.png', fullPage: true })
        await main(page).getByLabel(ru.outputFormat).selectOption('png')
        assert.deepEqual(await download(page), pngBefore)
      })
    })

    await suite.test('mobile pinch and pan update JPEG; 390 px layout and KZ remain accessible', async () => {
      const { defaultBrowserType, ...mobile } = devices['iPhone 13']
      await withPage(async page => {
        await upload(page)
        assert.equal(await button(page, ru.contour).getAttribute('aria-pressed'), 'true')
        await button(page, ru.finish).click()
        await main(page).getByLabel(ru.outputFormat).selectOption('egov')
        const before = await downloadEgov(page)
        const pan = button(page, ru.panImage)
        await pan.scrollIntoViewIfNeeded()
        let rect = await pan.boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
        const slider = main(page).getByRole('slider', { name: ru.zoom, exact: true })
        const initial = Number(await slider.inputValue())
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 55, y }, { id: 2, x: x + 55, y }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        assert.ok(Number(await slider.inputValue()) > initial)
        const pinched = await downloadEgov(page)
        assert.notDeepEqual(pinched, before)
        await pan.scrollIntoViewIfNeeded()
        rect = await pan.boundingBox(); x = rect.x + rect.width / 2; y = rect.y + rect.height / 2
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 12, y: y + 4 }] })
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        assert.notDeepEqual(await downloadEgov(page), pinched)
        await button(page, ru.centerSignature).click()
        assert.deepEqual(await downloadEgov(page), before)
        await accessibility(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await main(page).getByRole('heading', { name: kz.rulesTitle, exact: true }).waitFor()
        assert.ok(await page.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth))
        await accessibility(page)
        await page.screenshot({ path: 'test-results/signature-egov-mobile-kz.png', fullPage: true })
      }, mobile)
    })

    await suite.test('two edge lines offer a crop; three or four are automatically cropped out of the eGov file', async () => {
      for (const edges of [2, 3, 4]) {
      await withPage(async page => {
        const image = synthSignature('clean', 550, 124)
        for (let y = 0; y < 124; y++) for (let x = 0; x < 550; x++) {
          if (y > 1 && y < 122 && !(edges >= 3 && x < 2) && !(edges === 4 && x > 547)) continue
          image.data.set([0, 0, 0, 255], (y * 550 + x) * 4)
        }
        await upload(page, { name: 'framed.png', mimeType: 'image/png', buffer: fixturePng(image) })
        await button(page, ru.fitFrame).click()
        await button(page, ru.finish).click()
        await main(page).getByLabel(ru.outputFormat).selectOption('egov')
        let bytes = await downloadEgov(page)
        if (edges === 2) {
          assert.equal(await main(page).locator('[data-check="frame"]').getAttribute('data-status'), 'warn')
          await button(page, ru.cropFrame).click()
          bytes = await downloadEgov(page)
        }
        const jpeg = await inspectImage(page, bytes, 'image/jpeg')
        await main(page).getByText(ru.frameRemoved, { exact: true }).waitFor()
        assert.equal(await main(page).locator('[data-check="frame"]').getAttribute('data-status'), 'pass')
        assert.ok(jpeg.corners.every(pixel => pixel.every(channel => channel >= 253)))
        assert.ok(jpeg.inkWidth > 0)
      })
      }
    })

    await suite.test('result crop is reversible and custom dimensions reach both PNGs and eGov JPEG', async () => {
      await withPage(async page => {
        await upload(page)
        await button(page, ru.finish).click()
        const original = await download(page)
        const originalSize = await inspectImage(page, original)
        await button(page, ru.cropResult).click()
        const corner = button(page, ru.corners[0])
        await corner.press('Shift+ArrowRight')
        await button(page, ru.cancelCrop).click()
        assert.deepEqual(await download(page), original)
        await button(page, ru.cropResult).click()
        for (let i = 0; i < 4; i++) await corner.press('Shift+ArrowRight')
        await button(page, ru.corners[2]).press('Shift+ArrowUp')
        await accessibility(page)
        await button(page, ru.applyCrop).click()
        const cropped = await download(page)
        const croppedSize = await inspectImage(page, cropped)
        assert.ok(croppedSize.width < originalSize.width && croppedSize.height < originalSize.height)
        assert.notDeepEqual(cropped, original)
        await button(page, ru.cropResult).click()
        const source = main(page).getByRole('img', { name: ru.cropResult, exact: true })
        assert.deepEqual(await source.evaluate(el => [el.width, el.height]), [originalSize.width, originalSize.height])
        await button(page, ru.cancelCrop).click()

        await main(page).getByLabel(ru.width, { exact: true }).selectOption('custom')
        const width = main(page).getByLabel(ru.pixelWidth, { exact: true })
        const height = main(page).getByLabel(ru.pixelHeight, { exact: true })
        await width.fill('720')
        const resized = await download(page)
        const resizedWhite = await download(page, true)
        const expectedHeight = Math.round(720 * croppedSize.height / croppedSize.width)
        for (const bytes of [resized, resizedWhite]) {
          assert.equal(bytes.readUInt32BE(16), 720)
          assert.equal(bytes.readUInt32BE(20), expectedHeight)
        }
        assert.equal(await height.inputValue(), String(expectedHeight))
        assert.ok((await inspectImage(page, resizedWhite)).corners.every(pixel => pixel[3] === 255))
        const image = main(page).getByRole('img', { name: ru.result, exact: true })
        const box = await image.boundingBox()
        assert.ok(Math.abs(box.width / box.height - 720 / expectedHeight) < 0.02)
        assert.equal(await image.evaluate(el => getComputedStyle(el.parentElement).backgroundImage), 'none')
        await page.screenshot({ path: 'test-results/signature-result-desktop.png', fullPage: true })
        await height.fill('100')
        assert.ok(Math.abs((await download(page)).readUInt32BE(20) - 100) <= 1)
        await width.fill('')
        await main(page).getByText(ru.invalidSize, { exact: true }).waitFor()
        assert.equal(await downloadLink(page).count(), 0)
        await width.fill('4097')
        assert.equal(await downloadLink(page).count(), 0)
        await width.fill('720')
        await main(page).getByLabel(ru.limit, { exact: true }).selectOption('custom')
        await main(page).getByLabel(ru.customLimit, { exact: true }).fill('1')
        assert.equal((await download(page)).readUInt32BE(16), 720)
        await main(page).getByText(ru.tooLarge.replace('{limit}', '1'), { exact: true }).waitFor()

        await main(page).getByLabel(ru.outputFormat).selectOption('egov')
        const link = main(page).getByRole('link', { name: ru.downloadEgov, exact: true })
        const [saved] = await Promise.all([page.waitForEvent('download'), link.click()])
        const jpeg = await inspectImage(page, await readFile(await saved.path()), 'image/jpeg')
        assert.ok(jpeg.width >= 550 && jpeg.height >= 124)
        assert.equal(jpeg.width / jpeg.height, 550 / 124)
        await main(page).getByLabel(ru.outputFormat).selectOption('png')
        await main(page).getByLabel(ru.limit, { exact: true }).selectOption('0')
        await main(page).getByLabel(ru.width, { exact: true }).selectOption('0')
        assert.deepEqual(await download(page), cropped)
        await button(page, ru.resetOutputCrop).click()
        assert.deepEqual(await download(page), original)
        await accessibility(page)
        await button(page, ru.new).click()
        await upload(page)
        await button(page, ru.finish).click()
        assert.equal(await main(page).getByLabel(ru.width, { exact: true }).inputValue(), '0')
        assert.deepEqual(await download(page), original)
      })
    })

    await suite.test('result crop works by touch at 390 px with square exports and RU/KZ accessibility', async () => {
      await withPage(async page => {
        await upload(page)
        await button(page, ru.finish).click()
        const original = await download(page)
        await button(page, ru.cropResult).click()
        await button(page, ru.squareCrop).click()
        const grip = button(page, ru.corners[0])
        await grip.scrollIntoViewIfNeeded()
        const box = await grip.boundingBox()
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        const touch = await page.context().newCDPSession(page)
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 12, y: y + 12 }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await accessibility(page)
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await accessibility(page)
        await button(page, kz.applyCrop).click()
        const cropped = await download(page)
        assert.ok(cropped.readUInt32BE(16) < original.readUInt32BE(20))
        assert.ok(Math.abs(cropped.readUInt32BE(16) - cropped.readUInt32BE(20)) <= 1)
        await main(page).getByLabel(kz.width, { exact: true }).selectOption('custom')
        await main(page).getByLabel(kz.pixelWidth, { exact: true }).fill('340')
        const resized = await download(page)
        assert.equal(resized.readUInt32BE(16), 340)
        assert.ok(Math.abs(resized.readUInt32BE(20) - 340) <= 2)
        assert.ok(await page.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth))
        await page.screenshot({ path: 'test-results/signature-result-mobile-kz.png', fullPage: true })
        await accessibility(page)
      }, { ...devices['iPhone 13'], defaultBrowserType: undefined })
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

    for (const lang of ['ru', 'kz']) {
      await suite.test(`signature camera has a 550:124 contour after leaving the photo camera on mobile (${lang})`, async () => {
        const { defaultBrowserType, ...mobile } = devices['iPhone 13']
        await withPage(async (page, { context }) => {
          await context.grantPermissions(['camera'], { origin })
          if (lang === 'kz') await page.getByRole('button', { name: 'KZ', exact: true }).click()
          const labels = translations[lang]
          await page.locator('#wizard-main').getByRole('button', { name: labels.btnShootCamera, exact: true }).click()
          const portraitCamera = page.getByRole('dialog', { name: labels.cameraModalTitle })
          const error = portraitCamera.getByRole('alert')
          await portraitCamera.locator('[data-camera-silhouette]').or(error).first().waitFor()
          if (await error.isVisible()) assert.fail(await error.innerText())
          await page.keyboard.press('Escape')
          await portraitCamera.waitFor({ state: 'hidden' })
          await page.getByRole('navigation', { name: labels.site.toolNavigation })
            .getByRole('link', { name: labels.site.signatureTab, exact: true }).click()
          await button(page, signatureCopy[lang].camera).click()
          const camera = await checkSignatureCamera(page, lang)
          await accessibility(page)
          await camera.getByRole('button', { name: labels.cameraSignatureShoot, exact: true }).click()
          await main(page).getByRole('heading', { name: signatureCopy[lang].paper }).waitFor()
          await camera.waitFor({ state: 'hidden' })
        }, mobile, '/')
      })
    }

    await suite.test('signature camera uses a 550:124 contour, captures into crop, and processes large uploads', async () => {
      await withPage(async (page, { context }) => {
        await context.grantPermissions(['camera'], { origin })
        await button(page, ru.camera).click()
        const camera = await checkSignatureCamera(page)
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
