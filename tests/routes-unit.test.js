import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { legacyRedirect, pathFor, routeFromPath } from '../src/lib/routes.js'
import { localizedPath } from '../src/lib/locale.js'
import { pageMetadata } from '../src/lib/seo.js'
import { photoPageCopy } from '../src/content/photo-page-copy.js'

const pages = [['photo', 'kz_id', '/'], ['photo', 'dv', '/green-card/'], ['signature', null, '/signature/']]

test('routes map paths to tool and document in both languages', () => {
  for (const [tool, doc, path] of pages) for (const prefix of ['', '/kk']) {
    const url = prefix ? localizedPath(path, 'kz') : path
    assert.deepEqual(routeFromPath(url), { tool, doc })
    assert.equal(pathFor(tool, doc), path)
  }
  assert.deepEqual(routeFromPath('/kk'), { tool: 'photo', doc: 'kz_id' })
})

test('old ?doc= links redirect to the new addresses', () => {
  assert.equal(legacyRedirect('/', '?doc=kz_id'), '/')
  assert.equal(legacyRedirect('/', '?doc=dv'), '/green-card/')
  assert.equal(legacyRedirect('/kk/', '?doc=dv'), '/kk/green-card/')
  assert.equal(legacyRedirect('/', '?doc=dv&lang=kk'), '/green-card/?lang=kk')
  assert.equal(legacyRedirect('/', '?doc=unknown'), '/')
  assert.equal(legacyRedirect('/', ''), null)
})

test('documents never mix: RK page has no DV rules and Green Card page has no RK rules', () => {
  for (const lang of ['ru', 'kz']) {
    const { kz_id, dv } = photoPageCopy[lang].docs
    const text = doc => JSON.stringify([doc.h1, doc.lead, doc.cards, doc.base, doc.faq])
    assert.doesNotMatch(text(kz_id), /600|240|Green Card|travel\.state/)
    assert.doesNotMatch(text(dv), /413|531|30 КБ|267|egov/)
  }
})

test('every page has a unique title (<= 60) and description, matching canonical and hreflang pairs', () => {
  const titles = new Set()
  for (const lang of ['ru', 'kz']) for (const [tool, doc, path] of pages) {
    const meta = pageMetadata(tool, lang, doc ?? 'kz_id')
    assert.ok(meta.title.endsWith(' | Nexcel Solutions') && meta.title.length <= 60, meta.title)
    assert.ok(!titles.has(meta.title), 'duplicate title ' + meta.title)
    titles.add(meta.title)
    assert.equal(meta.url, 'https://photo.nexcel.kz' + localizedPath(path, lang))
    assert.equal(meta.application['@type'], 'WebApplication')
    assert.equal(meta.breadcrumbs['@type'], 'BreadcrumbList')
    assert.equal(Boolean(meta.faq), tool === 'photo')
    if (meta.faq) {
      assert.equal(meta.faq['@type'], 'FAQPage')
      assert.ok(meta.faq.mainEntity.length >= 4 && meta.faq.mainEntity.length <= 6)
    }
  }
})

test('sitemap template lists all six URLs with consistent hreflang pairs and static entries exist', () => {
  const xml = readFileSync(new URL('../scripts/templates/sitemap.xml', import.meta.url), 'utf8')
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
  assert.equal(locs.length, 6)
  for (const [, , path] of pages) for (const lang of ['ru', 'kz']) {
    assert.ok(locs.includes('https://photo.nexcel.kz' + localizedPath(path, lang)), path + lang)
  }
  for (const [, , path] of pages) for (const lang of ['ru', 'kz']) {
    const file = (lang === 'kz' ? 'kk' : '') + path + 'index.html'
    const html = readFileSync(new URL('../' + (file === 'index.html' ? 'index.html' : file.replace(/^\//, '')), import.meta.url), 'utf8')
    assert.match(html, new RegExp('rel="canonical" href="https://photo.nexcel.kz' + localizedPath(path, lang).replace(/[/]/g, '\\/') + '"'))
    assert.match(html, new RegExp('hreflang="ru" href="https://photo.nexcel.kz' + path.replace(/[/]/g, '\\/') + '"'))
  }
})

test('RU and KZ page copy have the same keys', () => {
  const shape = value => Array.isArray(value) ? value.map(shape) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)])) : typeof value
  assert.deepEqual(shape(photoPageCopy.kz), shape(photoPageCopy.ru))
})
