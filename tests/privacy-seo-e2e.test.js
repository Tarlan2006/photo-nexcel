import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'
import axe from 'axe-core'
import { translations } from '../src/i18n.js'
import { photoCopy } from '../src/content/photo-copy.js'
import { signatureCopy } from '../src/components/signature/copy.js'
import { releaseCopy } from '../src/content/release-copy.js'
import { requirements } from '../src/content/requirements.js'
import { pageMetadata } from '../src/lib/seo.js'
import { fixturePng, synthSignature } from './helpers/synthSignature.js'

const chrome = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  .find(path => path && existsSync(path))
const review = new URL('../.review/', import.meta.url)

async function storageSnapshot(page, stage) {
  return {
    stage,
    ...await page.evaluate(async () => ({
      localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage },
      indexedDB: (await indexedDB.databases()).map(({ name }) => name), cacheStorage: await caches.keys(),
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).map(({ scope }) => scope),
      history: history.state, storageWrites: window.privacyWrites, cspViolations: window.privacyViolations,
    })),
    cookies: await page.context().cookies(),
  }
}

function assertStorage(snapshot, preference) {
  assert.deepEqual(snapshot.cspViolations, [])
  assert.deepEqual(snapshot.localStorage, preference ? { photo_nexcel_lang: preference } : {})
  for (const key of ['sessionStorage', 'indexedDB', 'cacheStorage', 'serviceWorkers', 'cookies']) {
    assert.deepEqual(snapshot[key], key === 'sessionStorage' ? {} : [], key)
  }
  for (const write of snapshot.storageWrites) {
    assert.deepEqual(Object.keys(write).sort(), ['key', 'storage', 'value'])
    assert.equal(write.storage, 'localStorage')
    assert.equal(write.key, 'photo_nexcel_lang')
    assert.ok(['ru', 'kz'].includes(write.value))
  }
  if (snapshot.history?.photoResult) assert.match(snapshot.history.photoResult, /^[0-9a-f-]{36}$/)
}

async function saveDownload(page, link) {
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  assert.ok((await readFile(await download.path())).length > 0)
}

test('privacy: real processing sends no images, EXIF or analysis and stores only language', { timeout: 120000 }, async suite => {
  assert.ok(chrome, 'Chromium is required for the privacy audit')
  const server = await preview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4201 } })
  const origin = process.env.PRIVACY_AUDIT_ORIGIN ?? 'http://127.0.0.1:' + server.httpServer.address().port
  const browser = await chromium.launch({ executablePath: chrome, args: ['--enable-unsafe-swiftshader'] })
  const reports = []
  try {
    for (const tool of ['photo', 'signature']) await suite.test(tool, async () => {
      const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 } })
      const requests = [], errors = []
      // Intercept every request, including model/worker requests; do not hide external traffic by mocking it.
      await context.route('**/*', async route => {
        const request = route.request()
        requests.push({ url: request.url(), method: request.method(), type: request.resourceType(),
          bodyBytes: request.postDataBuffer()?.length ?? 0 })
        await route.continue()
      })
      await context.addInitScript(() => {
        window.privacyWrites = []
        window.privacyViolations = []
        const setItem = Storage.prototype.setItem
        Storage.prototype.setItem = function(key, value) {
          window.privacyWrites.push({ storage: this === localStorage ? 'localStorage' : 'sessionStorage', key, value })
          return setItem.call(this, key, value)
        }
        document.addEventListener('securitypolicyviolation', event => privacyViolations.push(event.violatedDirective))
      })
      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      page.on('pageerror', error => errors.push(error.message))
      const path = tool === 'photo' ? '/' : '/signature/'
      const main = page.locator(tool === 'photo' ? '#wizard-main' : '#signature-main')
      const snapshots = []
      try {
        await page.goto(origin + path)
        await main.locator('h1').waitFor()
        snapshots.push(await storageSnapshot(page, 'initial')); assertStorage(snapshots.at(-1))
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await page.waitForURL(origin + '/kk' + path)
        snapshots.push(await storageSnapshot(page, 'language-kz')); assertStorage(snapshots.at(-1), 'kz')
        await page.getByRole('button', { name: 'RU', exact: true }).click()
        await page.waitForURL(origin + path)
        if (tool === 'photo') {
          // A real JPEG carrying an identifiable EXIF Artist value must never be sent back in any request.
          const jpeg = await readFile(new URL('./fixtures/portrait.jpg', import.meta.url))
          const artist = Buffer.from('PRIVACY_EXIF_CANARY_2026\0')
          const exif = Buffer.alloc(6 + 26 + artist.length)
          exif.write('Exif\0\0', 0, 'binary'); exif.write('II', 6); exif.writeUInt16LE(42, 8); exif.writeUInt32LE(8, 10)
          exif.writeUInt16LE(1, 14); exif.writeUInt16LE(0x013b, 16); exif.writeUInt16LE(2, 18)
          exif.writeUInt32LE(artist.length, 20); exif.writeUInt32LE(26, 24); artist.copy(exif, 32)
          const marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1); marker.writeUInt16BE(exif.length + 2, 2)
          await main.locator('input[type=file]').setInputFiles({ name: 'privacy-exif.jpg', mimeType: 'image/jpeg',
            buffer: Buffer.concat([jpeg.subarray(0, 2), marker, exif, jpeg.subarray(2)]) })
          const dialog = page.getByRole('dialog', { name: photoCopy.ru.settings })
          await dialog.locator('[data-photo-preview] canvas').waitFor()
          await dialog.getByRole('button', { name: photoCopy.ru.process, exact: true }).click()
          await main.getByRole('img', { name: photoCopy.ru.readyImage, exact: true }).waitFor()
          snapshots.push(await storageSnapshot(page, 'photo-result')); assertStorage(snapshots.at(-1), 'ru')
          await saveDownload(page, main.getByRole('link', { name: photoCopy.ru.download, exact: true }))
          await main.getByRole('button', { name: translations.ru.btnNewPhoto, exact: true }).click()
        } else {
          await main.locator('.signature-rules-outer').evaluate(details => { details.open = true })
          await saveDownload(page, main.getByRole('button', { name: signatureCopy.ru.templateDownload, exact: true }))
          await main.locator('input[type=file]').setInputFiles({ name: 'privacy-signature.png', mimeType: 'image/png',
            buffer: fixturePng(synthSignature('blue')) })
          await main.locator('canvas[aria-label="' + signatureCopy.ru.result + '"]').waitFor()
          await page.waitForFunction(() => document.querySelector('#signature-main > .signature-status').textContent === '')
          await main.getByRole('button', { name: signatureCopy.ru.finish, exact: true }).click()
          await main.locator('a[download="signature.png"]').waitFor()
          snapshots.push(await storageSnapshot(page, 'signature-result')); assertStorage(snapshots.at(-1), 'ru')
          await saveDownload(page, main.locator('a[download="signature.png"]'))
          await main.getByLabel(signatureCopy.ru.outputFormat).selectOption('egov')
          await saveDownload(page, main.getByRole('link', { name: signatureCopy.ru.downloadEgov, exact: true }))
          await main.getByRole('button', { name: signatureCopy.ru.new, exact: true }).click()
        }
        snapshots.push(await storageSnapshot(page, 'reset-after-download')); assertStorage(snapshots.at(-1), 'ru')
        await page.reload()
        await main.locator('input[type=file]').waitFor({ state: 'attached' })
        assert.equal(await main.locator('a[download], img[src^="blob:"]').count(), 0)
        snapshots.push(await storageSnapshot(page, 'reload')); assertStorage(snapshots.at(-1), 'ru')
        for (const request of requests) {
          const url = new URL(request.url)
          assert.equal(url.origin, origin, JSON.stringify(request))
          assert.equal(request.method, 'GET', JSON.stringify(request))
          assert.equal(request.bodyBytes, 0, JSON.stringify(request))
          assert.equal(url.search, '', JSON.stringify(request))
          assert.equal(url.hash, '', JSON.stringify(request))
          const pathname = decodeURIComponent(url.pathname)
          const deployedAsset = process.env.PRIVACY_AUDIT_ORIGIN && /^\/assets\/[\w-]+-[\w-]{8}\.(?:js|css)$/.test(pathname)
          assert.ok(['/', '/signature/'].includes(pathname) || deployedAsset || existsSync(new URL('../dist' + pathname, import.meta.url)), JSON.stringify(request))
        }
        assert.deepEqual(await page.evaluate(() => privacyViolations), [])
        assert.deepEqual(errors, [])
        reports.push({ tool, requests, snapshots })
      } finally { await context.close() }
    })
    await mkdir(review, { recursive: true })
    const reportName = process.env.PRIVACY_AUDIT_ORIGIN ? 'privacy-production-audit.json' : 'privacy-browser-audit.json'
    await writeFile(new URL(reportName, review), JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), origin, reports }, null, 2))
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
})

test('SEO, privacy and result notices work in RU/KZ at 360, 390 and 1440 px with CSP and axe', { timeout: 240000 }, async suite => {
  assert.ok(chrome, 'Chromium is required')
  const server = await preview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4202 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const browser = await chromium.launch({ executablePath: chrome, args: ['--enable-unsafe-swiftshader'] })
  await mkdir(review, { recursive: true })
  try {
    const xml = await (await fetch(origin + '/sitemap.xml')).text()
    const datedUrls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
      loc: body.match(/<loc>(.*?)<\/loc>/)[1], lastmod: body.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    }))
    assert.deepEqual(datedUrls.map(({ loc }) => loc).sort(), ['/', '/green-card/', '/signature/', '/kk/', '/kk/green-card/', '/kk/signature/'].map(path => 'https://photo.nexcel.kz' + path).sort())
    const date = datedUrls[0].lastmod
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(Number.isFinite(Date.parse(date)))
    assert.ok(datedUrls.every(({ lastmod }) => lastmod === date))

    for (const width of [360, 390, 1440]) for (const tool of ['photo', 'signature']) for (const lang of ['ru', 'kz']) {
      await suite.test(`${tool} ${lang} ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ru-RU' })
        const page = await context.newPage(), errors = [], violations = []
        page.setDefaultTimeout(30000)
        page.on('pageerror', error => errors.push(error.message))
        await context.exposeBinding('reportCspViolation', (_source, directive) => violations.push(directive))
        await context.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.reportCspViolation(event.violatedDirective)))
        const metadata = pageMetadata(tool, lang), copy = releaseCopy[lang]
        const path = new URL(metadata.url).pathname
        const main = page.locator(tool === 'photo' ? '#wizard-main' : '#signature-main')
        const screenshot = name => page.screenshot({ path: fileURLToPath(new URL(`${tool}-${lang}-${width}-${name}.png`, review)) })
        async function checkLayoutAndAxe() {
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow')
          await page.evaluate(axe.source)
          assert.deepEqual(await page.evaluate(async () => (await axe.run()).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))), [])
          assert.deepEqual(violations, [])
          assert.deepEqual(errors, [])
        }
        try {
          const response = await page.goto(origin + path)
          assert.equal(response.status(), 200)
          assert.ok(response.headers()['content-security-policy'].includes("script-src 'self' 'wasm-unsafe-eval'"))
          await main.locator('h1').waitFor()
          assert.equal(await page.title(), metadata.title)
          assert.ok(metadata.title.endsWith(' | Nexcel Solutions') && metadata.title.length <= 60, metadata.title)
          for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) assert.equal(await page.locator(selector).getAttribute('content'), metadata.title)
          assert.equal(await page.locator('meta[name=description]').getAttribute('content'), metadata.description)
          assert.equal(await page.locator('meta[name=build-date]').getAttribute('content'), date)
          const scripts = page.locator('head script[type="application/ld+json"]')
          assert.equal(await scripts.count(), tool === 'photo' ? 3 : 2)
          const ld = id => page.locator('#' + id).textContent().then(JSON.parse)
          assert.deepEqual(await ld('webapplication-jsonld'), metadata.application)
          assert.deepEqual(await ld('breadcrumb-jsonld'), metadata.breadcrumbs)
          if (tool === 'photo') assert.deepEqual(await ld('faq-jsonld'), metadata.faq)
          const staticHtml = await response.text()
          const staticMetadata = await page.evaluate(html => {
            const head = new DOMParser().parseFromString(html, 'text/html').head
            return { title: head.querySelector('title').textContent,
              description: head.querySelector('meta[name=description]').content,
              json: JSON.parse(head.querySelector('#webapplication-jsonld').textContent),
              breadcrumbs: JSON.parse(head.querySelector('#breadcrumb-jsonld').textContent),
              faq: head.querySelector('#faq-jsonld') ? JSON.parse(head.querySelector('#faq-jsonld').textContent) : null }
          }, staticHtml)
          assert.deepEqual(staticMetadata, { title: metadata.title, description: metadata.description, json: metadata.application, breadcrumbs: metadata.breadcrumbs, faq: metadata.faq })
          const footer = page.locator('footer:visible')
          for (const key of ['privacy', 'privacyStorage', 'privacyTracking', 'privacySession', 'privacyHosting']) await footer.getByText(copy[key], { exact: true }).waitFor()
          assert.equal(await footer.getByRole('link', { name: copy.privacyMore, exact: true }).getAttribute('href'), 'https://nexcel.kz/privacy')
          await main.getByText(copy.privacyShort, { exact: true }).waitFor()
          assert.equal(await main.locator('[data-business-cta], [data-result-disclaimer]').count(), 0)
          await checkLayoutAndAxe()
          await screenshot('upload')
          let download
          if (tool === 'photo') {
            await main.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('./fixtures/portrait.jpg', import.meta.url)))
            const dialog = page.getByRole('dialog', { name: photoCopy[lang].settings })
            await dialog.getByText(copy.privacyShort, { exact: true }).waitFor()
            await dialog.locator('[data-photo-preview] canvas').waitFor()
            await dialog.locator('input[name=photo-background][value=original]').check()
            await dialog.getByRole('button', { name: photoCopy[lang].process, exact: true }).click()
            download = main.getByRole('link', { name: photoCopy[lang].download, exact: true })
            await download.waitFor()
            assert.equal(await main.locator('[data-result-disclaimer] a').getAttribute('href'), requirements.kz_id.sources[0].url)
          } else {
            await main.locator('input[type=file]').setInputFiles({ name: 'result-signature.png', mimeType: 'image/png', buffer: fixturePng(synthSignature('blue')) })
            await main.locator('canvas[aria-label="' + signatureCopy[lang].result + '"]').waitFor()
            await page.waitForFunction(() => document.querySelector('#signature-main > .signature-status').textContent === '')
            await main.getByRole('button', { name: signatureCopy[lang].finish, exact: true }).click()
            download = main.locator('a[download="signature.png"]')
            await download.waitFor()
            assert.ok(await main.locator('a[href="https://zan.gov.kz/client/#!/doc/140840/rus/158"]').count())
          }
          const notice = main.locator('[data-result-disclaimer]')
          await notice.getByText(copy.resultDisclaimer.replace('{date}', date), { exact: true }).waitFor()
          const cta = main.locator('[data-business-cta]')
          assert.equal(await cta.count(), 1)
          const collapsible = await cta.locator('summary').count() > 0
          if (collapsible) assert.equal(await cta.getAttribute('open'), null)
          assert.ok(await cta.evaluate((element, download) => Boolean(element.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_PRECEDING), await download.elementHandle()))
          const before = await download.evaluate(element => element.getBoundingClientRect().top + scrollY)
          if (collapsible) await cta.locator('summary').click()
          for (const [label, href] of [[copy.businessWhatsApp, 'https://wa.me/77711369095'], [copy.businessTelegram, 'https://t.me/nexcel_kz']]) {
            const link = cta.getByRole('link', { name: label, exact: true })
            assert.equal(await link.getAttribute('href'), href)
            assert.equal(await link.getAttribute('target'), collapsible ? null : '_blank')
            const bounds = await link.boundingBox()
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width)
          }
          const after = await download.evaluate(element => element.getBoundingClientRect().top + scrollY)
          // Scrolling to the disclosure may move the viewport; document position of the primary action stays fixed.
          assert.equal(Math.round(before), Math.round(after))
          await checkLayoutAndAxe()
          await download.scrollIntoViewIfNeeded()
          await screenshot('result')
          if (collapsible) await cta.locator('summary').click()
          await screenshot('result-collapsed')
        } finally { await context.close() }
      })
    }
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
})
