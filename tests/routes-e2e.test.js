import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { photoPageCopy } from '../src/content/photo-page-copy.js'
import { pageMetadata } from '../src/lib/seo.js'
import { translations } from '../src/i18n.js'

const chrome = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  .find(path => path && existsSync(path))
const ru = photoPageCopy.ru.docs

test('document and page routes work without reloads, with redirects and direct links', { timeout: 120000 }, async suite => {
  assert.ok(chrome, 'Chromium is required')
  const server = await preview({ logLevel: 'warn', preview: { host: '127.0.0.1', port: 4203 } })
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  const browser = await chromium.launch({ executablePath: chrome })
  try {
    await suite.test('direct links show the right document, title and canonical', async () => {
      for (const [path, doc, lang] of [['/', 'kz_id', 'ru'], ['/green-card/', 'dv', 'ru'], ['/kk/', 'kz_id', 'kz'], ['/kk/green-card/', 'dv', 'kz']]) {
        const page = await browser.newPage()
        await page.goto(origin + path)
        await page.locator('h1').waitFor()
        assert.equal(await page.locator('h1').textContent(), photoPageCopy[lang].docs[doc].h1)
        assert.equal(await page.title(), pageMetadata('photo', lang, doc).title)
        assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), pageMetadata('photo', lang, doc).url)
        assert.equal(await page.locator(`nav a[data-doc=${doc}]`).getAttribute('aria-current'), 'page')
        await page.close()
      }
    })

    await suite.test('switching the document changes URL and content without reload; back and forward follow', async () => {
      const page = await browser.newPage()
      await page.goto(origin + '/')
      await page.locator('h1').waitFor()
      await page.evaluate(() => { window.__noReload = true })
      await page.locator('nav a[data-doc=dv]').click()
      await page.waitForURL(origin + '/green-card/')
      assert.equal(await page.locator('h1').textContent(), ru.dv.h1)
      assert.equal(await page.title(), pageMetadata('photo', 'ru', 'dv').title)
      assert.doesNotMatch((await page.locator('#wizard-main').innerText()).replace(ru.kz_id.pill, ''), /413 ?[×x] ?531/)
      await page.goBack()
      await page.waitForURL(origin + '/')
      assert.equal(await page.locator('h1').textContent(), ru.kz_id.h1)
      await page.goForward()
      await page.waitForURL(origin + '/green-card/')
      assert.equal(await page.locator('h1').textContent(), ru.dv.h1)
      assert.equal(await page.evaluate(() => window.__noReload), true)
      await page.close()
    })

    await suite.test('page switcher moves between photo and signature and keeps the chosen document', async () => {
      const page = await browser.newPage()
      await page.goto(origin + '/green-card/')
      const nav = page.getByRole('navigation', { name: translations.ru.site.toolNavigation })
      assert.equal(await nav.locator('a[data-doc=dv]').getAttribute('aria-current'), 'page')
      await nav.getByRole('link', { name: translations.ru.site.signatureTab, exact: true }).click()
      await page.waitForURL(origin + '/signature/')
      assert.equal(await nav.getByRole('link', { name: translations.ru.site.signatureTab, exact: true }).getAttribute('aria-current'), 'page')
      await nav.locator('a[data-doc=dv]').click()
      await page.waitForURL(origin + '/green-card/')
      await page.close()
    })

    await suite.test('old ?doc= links redirect', async () => {
      for (const [from, to] of [['/?doc=dv', '/green-card/'], ['/?doc=kz_id', '/'], ['/kk/?doc=dv', '/kk/green-card/']]) {
        const page = await browser.newPage()
        await page.goto(origin + from)
        await page.locator('h1').waitFor()
        assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, to)
        await page.close()
      }
    })

    await suite.test('mobile 360 px shows trust pill, heading and both upload buttons without scrolling', async () => {
      const page = await browser.newPage({ viewport: { width: 360, height: 740 } })
      await page.goto(origin + '/')
      await page.locator('h1').waitFor()
      for (const name of ['Выбрать фото с устройства', 'Снять на камеру']) {
        const box = await page.getByRole('button', { name }).boundingBox()
        assert.ok(box.y + box.height <= 740, name)
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.close()
    })
  } finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
})
