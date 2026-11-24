import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { chromium, devices } from 'playwright'
import { preview } from 'vite'
import axe from 'axe-core'
import { translations } from '../src/i18n.js'
import { releaseCopy } from '../src/content/release-copy.js'
import { requirements } from '../src/content/requirements.js'
import { signatureCopy } from '../src/components/signature/copy.js'
import sharedNavigation from '../src/content/shared-nav.json' with { type: 'json' }
import { fixturePng, synthSignature } from './helpers/synthSignature.js'
import { pageMetadata } from '../src/lib/seo.js'

const chrome = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path))

test('release metadata, privacy, language addresses and HEIC recovery', { timeout: 120000 }, async suite => {
  if (!chrome) return suite.skip('Chromium unavailable. Run npx playwright install chromium.')
  const server = await preview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4200 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  let browser
  try {
    browser = await chromium.launch({ executablePath: chrome })
    async function withPage(path, run) {
      const { defaultBrowserType, ...mobile } = devices['iPhone 13']
      const context = await browser.newContext({ ...mobile, locale: 'ru-RU' })
      const page = await context.newPage(), errors = []
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        localStorage.setItem('photo_nexcel_lang', 'ru')
        window.releaseViolations = []
        document.addEventListener('securitypolicyviolation', event => releaseViolations.push(event.violatedDirective))
      })
      try {
        const response = await page.goto(origin + path)
        assert.equal(response.status(), 200)
        await page.locator('main h1').waitFor()
        await run(page)
        assert.deepEqual(errors, [])
        assert.deepEqual(await page.evaluate(() => releaseViolations), [])
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      } finally { await context.close() }
    }

    await suite.test('all four addresses have matching static and rendered metadata and readable notices', async () => {
      for (const path of ['/', '/signature/', '/kk/', '/kk/signature/']) {
        await withPage(path, async page => {
          const lang = path.startsWith('/kk/') ? 'kz' : 'ru', signature = path.includes('/signature/')
          const expectedTitle = signature ? translations[lang].site.signatureSeoTitle : releaseCopy[lang].photoSeoTitle
          assert.equal(await page.title(), expectedTitle)
          assert.equal(await page.locator('html').getAttribute('lang'), lang === 'kz' ? 'kk' : 'ru')
          assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://photo.nexcel.kz' + path)
          assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), 'https://photo.nexcel.kz' + path)
          const ru = signature ? '/signature/' : '/', kz = signature ? '/kk/signature/' : '/kk/'
          for (const [code, target] of [['ru',ru], ['kk',kz], ['x-default',ru]]) {
            assert.equal(await page.locator(`link[hreflang="${code}"]`).getAttribute('href'), 'https://photo.nexcel.kz' + target)
          }
          const html = await (await page.request.get(origin + path)).text()
          assert.ok(html.includes('<title>' + expectedTitle + '</title>'))
          assert.ok(!html.includes('__LOCAL_'))
          assert.ok(html.includes('<link rel="canonical" href="https://photo.nexcel.kz' + path + '"'))
          const footer = page.locator('footer:visible')
          await footer.getByText(releaseCopy[lang].privacy, { exact: true }).waitFor()
          await footer.getByText(releaseCopy[lang].unofficial, { exact: true }).waitFor()
          const imageUrl = await page.locator('meta[property="og:image"]').first().getAttribute('content')
          assert.equal(imageUrl, 'https://photo.nexcel.kz/' + (signature ? 'og-signature.png' : 'og-image.png'))
          const image = await page.request.get(origin + new URL(imageUrl).pathname), bytes = await image.body()
          assert.equal(image.status(), 200)
          assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1200,630])
          await page.evaluate(axe.source)
          assert.deepEqual(await page.evaluate(async () => (await axe.run()).violations.map(({ id }) => id)), [])
        })
      }
    })

    await suite.test('language switches update shareable URLs and survive navigation and reload', async () => {
      await withPage('/', async page => {
        await page.getByRole('button', { name: 'KZ', exact: true }).click()
        await page.waitForURL(origin + '/kk/')
        await page.getByRole('navigation', { name: translations.kz.site.toolNavigation }).getByRole('link', { name: translations.kz.site.signatureTab, exact: true }).click()
        await page.waitForURL(origin + '/kk/signature/')
        await page.locator('#signature-main').getByRole('heading', { name: signatureCopy.kz.title, exact: true }).waitFor()
        await page.waitForFunction(expected => JSON.parse(document.getElementById('webapplication-jsonld').textContent).url === expected, pageMetadata('signature', 'kz').url)
        assert.deepEqual(JSON.parse(await page.locator('#webapplication-jsonld').textContent()), pageMetadata('signature', 'kz').application)
        await page.reload()
        await page.locator('#signature-main').getByRole('heading', { name: signatureCopy.kz.title, exact: true }).waitFor()
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://photo.nexcel.kz/kk/signature/')
        await page.getByRole('button', { name: 'RU', exact: true }).click()
        await page.waitForURL(origin + '/signature/')
        await page.locator('#signature-main').getByRole('heading', { name: signatureCopy.ru.title, exact: true }).waitFor()
        await page.waitForFunction(expected => JSON.parse(document.getElementById('webapplication-jsonld').textContent).url === expected, pageMetadata('signature', 'ru').url)
        assert.deepEqual(JSON.parse(await page.locator('#webapplication-jsonld').textContent()), pageMetadata('signature', 'ru').application)
      })
    })

    await suite.test('local footer credit is translated on both tools and wraps within 390 px', async () => {
      for (const path of ['/', '/signature/', '/kk/', '/kk/signature/']) {
        await withPage(path, async page => {
          const lang = path.startsWith('/kk/') ? 'kz' : 'ru'
          const expected = lang === 'kz' ? 'Nexcel Solutions командасы жасаған' : 'Сделано командой Nexcel Solutions'
          const footer = page.locator('footer:visible')
          const credit = footer.getByRole('link', { name: expected, exact: true })
          assert.equal(await credit.count(), 1)
          assert.equal((await credit.innerText()).trim(), expected)
          assert.equal(await credit.getAttribute('href'), 'https://nexcel.kz/free')
          assert.equal(await credit.getAttribute('aria-label'), expected)
          assert.equal(await credit.getAttribute('target'), null)
          assert.equal(await credit.getAttribute('rel'), null)
          const copyright = lang === 'kz' ? sharedNavigation.footer.copyright.kk || translations.kz.site.copyright
            : sharedNavigation.footer.copyright.ru
          assert.equal(await credit.locator('..').getByText(copyright, { exact: true }).count(), 1)
          await credit.scrollIntoViewIfNeeded()
          const bounds = await credit.boundingBox()
          assert.equal(await page.evaluate(() => innerWidth), 390)
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, JSON.stringify(bounds))
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        })
      }
    })

    await suite.test('HEIC and renamed HEIF show useful guidance in RU/KZ on both tools', async () => {
      const heic = Buffer.alloc(24)
      heic.writeUInt32BE(24); heic.write('ftyp',4); heic.write('heic',8); heic.write('mif1',16)
      for (const path of ['/', '/signature/', '/kk/', '/kk/signature/']) {
        await withPage(path, async page => {
          const lang = path.startsWith('/kk/') ? 'kz' : 'ru'
          for (const [name,mimeType] of [['camera.heic','image/heic'], ['renamed.jpg','image/jpeg']]) {
            await page.locator('main input[type=file]').first().setInputFiles({ name, mimeType, buffer: heic })
            await page.getByText(translations[lang].errHeic, { exact: true }).waitFor()
          }
          if (path.includes('/signature/')) {
            await page.locator('main input[type=file]').setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: fixturePng(synthSignature('clean')) })
            await page.locator('main canvas[aria-label="' + signatureCopy[lang].result + '"]').waitFor()
          }
        })
      }
    })

    await suite.test('DV revision notice and static release assets remain available', async () => {
      await withPage('/', async page => {
        await page.locator('label:has(input[name=upload-document][value=dv])').click()
        await page.locator('summary').filter({ hasText: 'Все требования' }).click()
        await page.getByText(requirements.dv.edition.ru, { exact: true }).waitFor()
        for (const asset of ['/favicon.png','/apple-touch-icon.png','/robots.txt','/sitemap.xml','/.well-known/security.txt']) {
          assert.equal((await page.request.get(origin + asset)).status(), 200)
        }
        const sitemap = await (await page.request.get(origin + '/sitemap.xml')).text()
        for (const path of ['/', '/signature/', '/kk/', '/kk/signature/']) assert.ok(sitemap.includes('<loc>https://photo.nexcel.kz' + path + '</loc>'))
        const security = await (await page.request.get(origin + '/.well-known/security.txt')).text()
        assert.match(security, /Contact: mailto:info@nexcel\.kz/)
        assert.ok(Date.parse(security.match(/Expires: (.+)/)[1]) > Date.now())
        assert.match(security, /Canonical: https:\/\/photo.nexcel.kz\/\.well-known\/security.txt/)
        assert.ok((await readFile(new URL('../public/robots.txt', import.meta.url),'utf8')).includes('Allow: /'))
      })
    })

    await suite.test('the shared source drives desktop, mobile and footer links without browser requests to nexcel.kz', async () => {
      await withPage('/', async page => {
        const external = []
        page.on('request', request => { if (request.url().startsWith('https://nexcel.kz/')) external.push(request.url()) })
        const expectedServices = sharedNavigation.footer.columns.slice(0, -1).flatMap(column => column.links).map(item => item.href)
        const expectedServiceMenu = [...expectedServices, ...sharedNavigation.nav.filter(item => item.href.endsWith('/#calculator')).map(item => item.href)]
        const expectedPrimary = sharedNavigation.nav.filter(item => !expectedServices.includes(item.href) && !item.href.endsWith('/#calculator')).map(item => item.href)
        await page.setViewportSize({ width:1280,height:900 })
        await page.locator('header button[aria-controls=site-services]').click()
        assert.deepEqual(await page.locator('#site-services a').evaluateAll(links=>links.map(link=>link.href)),expectedServiceMenu)
        const desktop=await page.locator('header nav').first().locator(':scope > a').evaluateAll(links=>links.map(link=>link.href))
        assert.deepEqual(desktop,expectedPrimary)
        await page.setViewportSize({width:320,height:844})
        await page.locator('header button[aria-controls=site-mobile-menu]').click()
        assert.deepEqual(await page.locator('#site-mobile-menu ul').first().locator('a').evaluateAll(links=>links.map(link=>link.href)),expectedServiceMenu)
        const footer=page.locator('footer:visible')
        for(const item of sharedNavigation.footer.columns.flatMap(column=>column.links))assert.ok(await footer.locator('a[href="'+item.href+'"]').count())
        assert.equal(await footer.getByText(sharedNavigation.footer.legal,{exact:true}).count(),1)
        assert.ok(await page.locator('header img').evaluate(img=>img.complete&&img.naturalWidth>0&&img.src.startsWith('data:image/')))
        assert.deepEqual(external,[])
      })
    })

    await suite.test('calibration CLI runs the real detector and crop on an isolated test fixture without claiming a measurement', async t => {
      const portrait = new URL('./fixtures/portrait.jpg', import.meta.url)
      if (!existsSync(portrait)) return t.skip('Local non-calibration portrait fixture unavailable')
      const directory = new URL('../test-results/calibration-smoke/', import.meta.url)
      await mkdir(directory, { recursive: true })
      await copyFile(portrait, new URL('fixture-portrait.jpg', directory))
      const { stdout } = await promisify(execFile)(process.execPath,
        [fileURLToPath(new URL('../scripts/calibrate.js', import.meta.url)), '--input', fileURLToPath(directory)],
        { timeout: 60000, maxBuffer: 1000000 })
      const report = JSON.parse(await readFile(new URL('calibration-report.json', directory), 'utf8'))
      assert.deepEqual(report.rows.map(row => row.doc).sort(), ['dv','kz_id'])
      assert.ok(report.rows.some(row => row.success), stdout)
      assert.ok(report.rows.every(row => row.measured === false && row.headPct === null), stdout)
      assert.equal(report.recommendation.proposedFactor, null)
      assert.equal(report.recommendation.reviewedFiles, 0)
      assert.match(stdout, /не изменён/)
    })
  } finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
})
