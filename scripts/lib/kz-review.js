import { translations } from '../../src/i18n.js'
import { photoPageCopy } from '../../src/content/photo-page-copy.js'
import { photoCopy } from '../../src/content/photo-copy.js'
import { requirements } from '../../src/content/requirements.js'
import { presets } from '../../src/presets.js'
import { signatureCopy } from '../../src/components/signature/copy.js'
import { studioCopy } from '../../src/components/signature/studio-copy.js'
import { releaseCopy } from '../../src/content/release-copy.js'

export function collectKzReview() {
  const rows = []
  function paired(ru, kz, path) {
    if (typeof kz === 'string') {
      if (typeof ru !== 'string') throw new Error('Нет русского текста: ' + path)
      rows.push([path, ru, kz, '', ''])
    } else if (kz && typeof kz === 'object') {
      for (const key of Object.keys(kz)) paired(ru?.[key], kz[key], path ? path + '.' + key : key)
    }
  }
  function scan(value, path) {
    if (!value || typeof value !== 'object') return
    if (Object.hasOwn(value, 'ru') && Object.hasOwn(value, 'kz')) paired(value.ru, value.kz, path)
    else for (const [key, child] of Object.entries(value)) scan(child, path + '.' + key)
  }
  for (const [name, value] of Object.entries({ translations, photoCopy, photoPageCopy, requirements, presets, signatureCopy, studioCopy, releaseCopy })) scan(value, name)
  return rows.sort((a, b) => a[0].localeCompare(b[0], 'en'))
}

export function csvText(rows) {
  return '\uFEFF' + [['ключ', 'русский текст', 'казахский текст', 'статус', 'комментарий'], ...rows]
    .map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n'
}

export function parseCsv(text) {
  const rows = [], row = []
  let field = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field); field = ''
      if (char === '\n') { rows.push([...row]); row.length = 0 }
    } else if (char !== '\r' || quoted) field += char
  }
  if (quoted) throw new Error('Незакрытые кавычки в CSV')
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
