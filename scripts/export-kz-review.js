import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { collectKzReview, csvText, parseCsv } from './lib/kz-review.js'

const target = new URL('../docs/kz-review.csv', import.meta.url)
try {
  const previous = parseCsv(await readFile(target, 'utf8'))
  if (previous.slice(1).some(row => row[3] || row[4]) && !process.argv.includes('--replace')) {
    throw new Error('CSV уже содержит отметки носителя. Сохраните их отдельно; для явной замены используйте --replace.')
  }
} catch (error) { if (error.code !== 'ENOENT') throw error }
const rows = collectKzReview()
await mkdir(new URL('../docs/', import.meta.url), { recursive: true })
await writeFile(target, csvText(rows), 'utf8')
console.log(`docs/kz-review.csv: ${rows.length} пар RU/KZ. Статус и комментарий пусты. Все переводы остаются на проверку носителем.`)
