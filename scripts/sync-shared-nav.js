import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { validateSharedNavigation } from '../src/lib/shared-navigation.js'

export const sharedNavUrl = 'https://nexcel.kz/shared/nav.json'
const snapshotFile = new URL('../src/content/shared-nav.json', import.meta.url)
const logoFile = new URL('../src/content/shared-logo.json', import.meta.url)

export async function syncSharedNavigation({ request = fetch, offline = false, snapshot = snapshotFile, logoSnapshot = logoFile } = {}) {
  if (offline) {
    const data = validateSharedNavigation(JSON.parse(await readFile(snapshot, 'utf8')))
    const logo = JSON.parse(await readFile(logoSnapshot, 'utf8'))
    if (logo.sourceUrl !== data.logo.src || !logo.dataUrl?.startsWith('data:image/')) throw new Error('Локальный логотип не соответствует снимку меню.')
    return { offline: true, updatedAt: data.updatedAt }
  }
  const response = await request(sharedNavUrl + '?build=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('Общее меню NEXCEL недоступно: HTTP ' + response.status)
  const data = validateSharedNavigation(await response.json())
  const logoResponse = await request(data.logo.src + (data.logo.src.includes('?') ? '&' : '?') + 'nav=' + encodeURIComponent(data.updatedAt),
    { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!logoResponse.ok) throw new Error('Логотип NEXCEL недоступен: HTTP ' + logoResponse.status)
  const type = logoResponse.headers.get('content-type')?.split(';')[0].trim()
  if (!['image/svg+xml','image/png','image/webp','image/jpeg'].includes(type)) throw new Error('Неподдерживаемый формат логотипа NEXCEL.')
  const logo = Buffer.from(await logoResponse.arrayBuffer())
  if (!logo.length || logo.length > 1024 * 1024) throw new Error('Некорректный размер логотипа NEXCEL.')
  // Only public company navigation and its logo are downloaded at build time.
  // Browser image processing and its network policy are unchanged.
  await writeFile(snapshot, JSON.stringify(data, null, 2) + '\n')
  await writeFile(logoSnapshot, JSON.stringify({ sourceUrl: data.logo.src, dataUrl: 'data:' + type + ';base64,' + logo.toString('base64') }, null, 2) + '\n')
  return { offline: false, updatedAt: data.updatedAt }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  syncSharedNavigation({ offline: process.env.SHARED_NAV_OFFLINE === '1' }).then(result => {
    console.log((result.offline ? 'OFFLINE: используется сохранённый справочник' : 'Общее меню и логотип получены с nexcel.kz') + ', версия от ' + result.updatedAt)
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
