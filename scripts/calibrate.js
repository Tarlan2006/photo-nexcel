import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recommendCalibration } from './lib/calibration.js'
import { calibrationReviewPage } from './lib/calibration-review.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const inputIndex = process.argv.indexOf('--input')
if (inputIndex >= 0 && !process.argv[inputIndex + 1]) throw new Error('После --input укажите локальную папку с фото.')
const directory = resolve(root, inputIndex < 0 ? 'tests/fixtures/selfies' : process.argv[inputIndex + 1])
const localDirectory = relative(root, directory).replaceAll('\\', '/')
await mkdir(directory, { recursive: true })
const files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && /\.(jpe?g|png|webp|hei[cf])$/i.test(entry.name)).map(entry => entry.name).sort()
if (!files.length) {
  console.log('Фото не предоставлены. HEAD_TOP_FACTOR не изменён.\nПоложите 5–10 собственных селфи в tests/fixtures/selfies/: светлые и тёмные волосы, густые волосы, очки, разное освещение и расстояния.\nПовторите npm run calibrate. Фото, разметка и отчёты из этой папки исключены из Git. Подробности: README.md.')
  process.exit(0)
}

let annotations = {}
try {
  const document = JSON.parse(await readFile(resolve(directory, 'annotations.json'), 'utf8'))
  if (document.version !== 1 || !document.files || Array.isArray(document.files)) throw new Error('Ожидается { version: 1, files: {...} }')
  annotations = document.files
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Не удалось прочитать annotations.json: ' + error.message)
}
const [{ chromium }, { createServer }] = await Promise.all([import('playwright'), import('vite')])
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path))
if (!executablePath) throw new Error('Для калибровки нужен Chromium: npx playwright install chromium, либо PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
let browser
const rows = [], reviewItems = []
try {
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') && route.request().method() === 'GET' ? route.continue() : route.abort())
  await page.goto(origin + '/signature/')
  for (const file of files) {
    try {
      const bytes = await readFile(resolve(directory, file))
      const result = await page.evaluate(async ({ bytes, file, reference }) => {
        const [{ identifyPhoto, photoFileError, decodePhoto }, { detectFaceInBitmap }, { cropFace }, { presets }, { measureCalibration }] = await Promise.all([
          import('/src/lib/photo.js'), import('/src/lib/detector.js'), import('/src/lib/crop.js'), import('/src/presets.js'), import('/scripts/lib/calibration.js'),
        ])
        const input = new File([Uint8Array.from(atob(bytes), char => char.charCodeAt(0))], file)
        const error = photoFileError(input)
        if (error) throw new Error(error)
        const mime = await identifyPhoto(input)
        if (!mime || mime === 'image/heic') throw new Error(mime ? 'errHeic' : 'errUnsupportedFormat')
        const image = await decodePhoto(input, mime)
        try {
          const face = await detectFaceInBitmap(image, () => false)
          if (!face?.success) throw new Error(face?.error ?? 'DETECTION_FAILED')
          const result = []
          for (const preset of Object.values(presets)) {
            const crop = cropFace(image, face.landmarks, preset)
            try { result.push({ file, doc: preset.id, ...measureCalibration({ landmarks: face.landmarks, image, crop, preset, reference }) }) }
            finally { if (crop.canvas) crop.canvas.width = crop.canvas.height = 1 }
          }
          return { rows: result, chin: { x: face.landmarks[152].x, y: face.landmarks[152].y } }
        } finally { image.close() }
      }, { file, bytes: bytes.toString('base64'), reference: annotations[file] })
      rows.push(...result.rows)
      const mime = /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg'
      reviewItems.push({ file, image: 'data:' + mime + ';base64,' + bytes.toString('base64'), chin: result.chin })
    } catch (error) {
      for (const doc of ['kz_id', 'dv']) rows.push({ file, doc, success: false, measured: false, error: error.message })
    }
  }
} finally { await browser?.close(); await server.close() }
const recommendation = recommendCalibration(rows)
const number = value => Number.isFinite(value) ? value.toFixed(2) : '—'
const flag = value => value == null ? 'не проверено' : value ? 'да' : 'нет'
console.table(rows.map(row => ({ файл: row.file, doc: row.doc, 'head%': number(row.headPct),
  диапазон: row.inRange == null ? 'нет проверенной макушки' : row.inRange ? 'в диапазоне' : 'вне диапазона',
  'ΔX, % ширины': number(row.centerOffsetPct), 'макушка обрезана': flag(row.crownClipped),
  'подбородок обрезан': flag(row.chinClipped), ошибка: row.error ?? '' })))
console.log('HEAD_TOP_FACTOR:', recommendation.currentFactor, '— не изменён.')
if (!recommendation.measuredResults) console.log('Реальная доля головы не измерена: откройте calibration-review.html, отметьте макушку и подтвердите разметку, сохраните annotations.json в папку с фото и повторите запуск.')
else if (!recommendation.majorityOutside) console.log('Большинство измеренных результатов не выходит за диапазоны. Оснований предлагать замену коэффициента по этому критерию нет.')
else {
  console.log('Большинство измеренных результатов вне диапазонов. Предложение для следующего прогона, без правки кода:')
  console.log('Обычные волосы — HEAD_TOP_FACTOR:', number(recommendation.proposedFactor))
  console.log('Густые волосы — отдельный HEAD_TOP_FACTOR:', number(recommendation.denseHairFactor), '; множитель к обычным:', number(recommendation.denseHairMultiplier))
  if (!recommendation.proposedFactor || !recommendation.denseHairFactor) console.log('Для отсутствующей группы волос коэффициент не предложен: нужны проверенные отметки этой группы.')
}
if (recommendation.smallSample) console.log('Проверенных фото меньше пяти. Вывод не считается завершённой калибровкой.')
const report = { inputFiles: files.length, recommendation, rows }
await writeFile(resolve(directory, 'calibration-report.json'), JSON.stringify(report, null, 2) + '\n')
await writeFile(resolve(directory, 'calibration-review.html'), calibrationReviewPage(reviewItems, annotations))
console.log('Локальные файлы: ' + localDirectory + '/calibration-report.json и calibration-review.html. Их нельзя коммитить или публиковать.')
