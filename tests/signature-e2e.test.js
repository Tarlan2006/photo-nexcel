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
import { studioCopy } from '../src/components/signature/studio-copy.js'
import { photoCopy } from '../src/content/photo-copy.js'
import { processSignature } from '../src/lib/signature.js'
import { translations } from '../src/i18n.js'
import { fixturePng, fixtureY4m, synthSignature } from './helpers/synthSignature.js'

const ru = signatureCopy.ru
const kz = signatureCopy.kz
const studio = studioCopy.ru
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

async function upload(page, file = png(), format = 'png') {
  await chooseFile(page).setInputFiles(file)
  await canvas(page).waitFor()
  if (format !== 'egov') await main(page).getByLabel(ru.outputFormat).selectOption(format)
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

const studioCanvas = page => main(page).locator('[data-studio-canvas]')
const studioPrint = page => studioCanvas(page).evaluate(element => element.toDataURL())
const studioButton = (page, name) => main(page).getByRole('button', { name, exact: true })
const studioSlider = (page, name) => main(page).getByLabel(name)
async function openStudio(page, file = png()) {
  await chooseFile(page).setInputFiles(file)
  await studioCanvas(page).waitFor()
  await page.waitForFunction(() => document.querySelector('[data-file-size]')?.textContent.includes('КБ'))
}
async function saveStudio(page) {
  const [saved] = await Promise.all([page.waitForEvent('download'), studioButton(page, studio.download).click()])
  return { name: saved.suggestedFilename(), bytes: await readFile(await saved.path()) }
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
        const photoTab = nav.locator('a[data-doc=kz_id]')
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

    await suite.test('rules and local A4 PDF download work in both languages before upload', async () => {
      await withPage(async page => {
        await mkdir('test-results', { recursive: true })
        for (const [lang, copy] of [['ru', ru], ['kz', kz]]) {
          if (lang === 'kz') await page.getByRole('button', { name: 'KZ', exact: true }).click()
          await main(page).getByRole('heading', { name: copy.rulesTitle, exact: true }).waitFor()
          await main(page).locator('.signature-rules-outer, .signature-rules-more').evaluateAll(list => list.forEach(details => { details.open = true }))
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
          await studioCanvas(page).waitFor()
          await camera.waitFor({ state: 'hidden' })
        }, mobile, '/')
      })
    }


    await suite.test('studio opens with legal defaults and downloads a valid eGov JPEG', async () => {
      await withPage(async page => {
        await openStudio(page)
        assert.equal(await main(page).getByLabel(studio.format).inputValue(), 'image/jpeg')
        assert.equal(await main(page).getByLabel(studio.resolution).inputValue(), '550x124')
        assert.equal(await studioButton(page, studio.modeBw).getAttribute('aria-pressed'), 'true')
        assert.equal(await main(page).locator('#studio-checks').evaluate(el => el.closest('section').querySelectorAll('li').length), 4)
        await main(page).getByText(studio.allOk, { exact: true }).waitFor()
        assert.equal(await main(page).locator('li[data-ok=false]').count(), 0)
        assert.equal(await main(page).locator('[data-studio-guides]').count(), 1)
        const { name, bytes } = await saveStudio(page)
        assert.equal(name, 'podpis_egov_550x124.jpg')
        assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff')
        const jpeg = await inspectImage(page, bytes, 'image/jpeg')
        assert.deepEqual([jpeg.width, jpeg.height], [550, 124])
        assert.ok(jpeg.corners.every(pixel => pixel.every(channel => channel >= 253)))
        assert.ok(jpeg.inkWidth > 50 && jpeg.left >= 23 && jpeg.top >= 22 && jpeg.bottom <= 124 - 22)
        await main(page).getByText(ru.saved).first().waitFor()
        await main(page).getByText(studio.fileSaved.replace('{name}', name), { exact: true }).waitFor()
        await accessibility(page)
      })
    })

    await suite.test('PNG and 2x size are available; the small preview and file size follow the choice', async () => {
      await withPage(async page => {
        await openStudio(page)
        const size = () => main(page).locator('[data-file-size]').innerText()
        const jpegSize = await size()
        await main(page).getByLabel(studio.resolution).selectOption('1100x248')
        await main(page).getByLabel(studio.format).selectOption('image/png')
        await main(page).getByText('podpis_egov_1100x248.png', { exact: true }).waitFor()
        await page.waitForFunction(previous => document.querySelector('[data-file-size]').textContent !== previous, jpegSize)
        const { name, bytes } = await saveStudio(page)
        assert.equal(name, 'podpis_egov_1100x248.png')
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
        const png = await inspectImage(page, bytes)
        assert.deepEqual([png.width, png.height], [1100, 248])
        assert.equal(await main(page).getByRole('img', { name: new RegExp(studio.willDownload) }).count(), 1)
      })
    })

    await suite.test('sliders, rotate, auto-centre, original, guides and reset change the picture', async () => {
      await withPage(async page => {
        await openStudio(page)
        const baseline = await studioPrint(page)
        const threshold = studioSlider(page, studio.threshold)
        const thickness = studioSlider(page, studio.thickness)
        const zoom = studioSlider(page, studio.zoom)
        const angle = studioSlider(page, studio.angle)
        await thickness.press('ArrowRight')
        assert.notEqual(await studioPrint(page), baseline)
        await thickness.press('ArrowLeft')
        assert.equal(await studioPrint(page), baseline)
        await threshold.press('Home')
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.reset).first().click()
        assert.equal(await studioPrint(page), baseline)
        await zoom.press('End')
        assert.equal(await zoom.inputValue(), '300')
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.autoCenter).click()
        assert.equal(await studioPrint(page), baseline)
        await angle.press('End')
        assert.equal(await angle.inputValue(), '30')
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.zero).click()
        assert.equal(await angle.inputValue(), '0')
        assert.equal(await studioPrint(page), baseline)
        await studioButton(page, studio.rotateHint).click()
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.rotateHint).click()
        await studioButton(page, studio.rotateHint).click()
        await studioButton(page, studio.rotateHint).click()
        assert.equal(await studioPrint(page), baseline)
        await studioButton(page, studio.modeGray).click()
        assert.equal(await studioButton(page, studio.modeGray).getAttribute('aria-pressed'), 'true')
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.reset).first().click()
        assert.equal(await studioPrint(page), baseline)
        const compare = main(page).getByRole('button', { name: studio.original })
        const box = await compare.boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        assert.notEqual(await studioPrint(page), baseline)
        await page.mouse.up()
        assert.equal(await studioPrint(page), baseline)
        const guides = main(page).locator('[data-studio-guides]')
        assert.equal(await guides.evaluate(el => getComputedStyle(el).opacity), '1')
        await studioButton(page, studio.guides).click()
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-studio-guides]')).opacity === '0')
      })
    })

    await suite.test('drag, wheel, keyboard and eraser edit the signature', async () => {
      await withPage(async page => {
        await openStudio(page)
        const baseline = await studioPrint(page)
        const surface = studioCanvas(page)
        const box = await surface.boundingBox()
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 40, cy + 6, { steps: 4 })
        await page.mouse.up()
        const moved = await studioPrint(page)
        assert.notEqual(moved, baseline)
        await studioButton(page, studio.autoCenter).click()
        assert.equal(await studioPrint(page), baseline)
        const zoomBefore = Number(await studioSlider(page, studio.zoom).inputValue())
        await page.mouse.move(cx, cy)
        await page.mouse.wheel(0, -200)
        await page.waitForFunction(before => Number(document.querySelector('input[type=range][min="20"]').value) > before, zoomBefore)
        await studioButton(page, studio.autoCenter).click()
        await main(page).getByRole('group', { name: studio.canvasLabel }).focus()
        await page.keyboard.press('ArrowRight')
        await page.keyboard.press('+')
        assert.notEqual(await studioPrint(page), baseline)
        await studioButton(page, studio.autoCenter).click()
        assert.equal(await studioPrint(page), baseline)
        assert.equal(await studioButton(page, studio.undo).count(), 0)
        await studioButton(page, studio.eraser).click()
        assert.equal(await studioButton(page, studio.eraserOn).getAttribute('aria-pressed'), 'true')
        await main(page).getByText(studio.hintErase, { exact: true }).waitFor()
        await page.mouse.move(box.x + box.width * 0.25, cy)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.75, cy, { steps: 12 })
        await page.mouse.up()
        const erased = await studioPrint(page)
        assert.notEqual(erased, baseline)
        await studioButton(page, studio.undo).click()
        assert.equal(await studioPrint(page), baseline)
        assert.equal(await studioButton(page, studio.undo).count(), 0)
      })
    })

    await suite.test('bad files, another photo and a very large photo', async () => {
      await withPage(async page => {
        await chooseFile(page).setInputFiles({ name: 'text.txt', mimeType: 'text/plain', buffer: Buffer.from('text') })
        await main(page).getByText(photo.errUnsupportedFormat, { exact: true }).waitFor()
        await chooseFile(page).setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.of(255, 216, 255, 0, 0, 0) })
        await main(page).getByText(photo.errRead, { exact: true }).waitFor()
        await openStudio(page, png('blue', 8000, 1200))
        await main(page).getByText(photo.errRead, { exact: true }).waitFor({ state: 'detached' })
        const { bytes } = await saveStudio(page)
        const jpeg = await inspectImage(page, bytes, 'image/jpeg')
        assert.deepEqual([jpeg.width, jpeg.height], [550, 124])
        await studioButton(page, studio.otherPhoto).click()
        await chooseFile(page).waitFor({ state: 'attached' })
        assert.equal(await studioCanvas(page).count(), 0)
        await main(page).getByRole('heading', { level: 1, name: ru.title }).waitFor()
      })
    })

    await suite.test('mobile and tablet layout, RU and KZ, axe', async () => {
      await withPage(async page => {
        const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        await page.setViewportSize({ width: 390, height: 844 })
        await main(page).getByRole('heading', { name: ru.title }).waitFor()
        await noOverflow()
        await accessibility(page)
        await openStudio(page)
        await noOverflow()
        const order = await page.evaluate(() => ['[data-studio-canvas]', '#studio-clean', '#studio-save', '#studio-checks']
          .map(selector => document.querySelector(selector).getBoundingClientRect().top))
        assert.ok(order[0] < order[1] && order[1] < order[2])
        await accessibility(page)
        await page.setViewportSize({ width: 360, height: 800 })
        await noOverflow()
        await page.setViewportSize({ width: 768, height: 900 })
        await noOverflow()
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await main(page).getByRole('heading', { name: kz.title }).waitFor()
        await main(page).getByRole('button', { name: studioCopy.kz.download, exact: true }).waitFor()
        assert.equal(await page.locator('html').getAttribute('lang'), 'kk')
        await noOverflow()
        await accessibility(page)
      })
    })

    await suite.test('repeated upload, download and reset cycles do not leak blob URLs', async () => {
      await withPage(async page => {
        for (let i = 0; i < 5; i++) {
          await openStudio(page, png(['blue', 'clean'][i % 2]))
          await saveStudio(page)
          await studioButton(page, studio.otherPhoto).click()
          await chooseFile(page).waitFor({ state: 'attached' })
        }
        await page.waitForFunction(() => signatureQA.urls.size === 0, null, { timeout: 5000 })
      })
    })
  } finally {
    await browser?.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})
