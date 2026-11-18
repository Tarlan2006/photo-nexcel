import { mkdir, writeFile } from 'node:fs/promises'
import { build } from 'vite'

const flagged = ['picomatch', 'fdir', 'tinyglobby', 'vite', '@vitejs/plugin-react']
const modules = new Set()
const bundles = []
const auditPlugin = target => ({
  name: 'audit-browser-modules-' + target,
  generateBundle(_options, bundle) {
    const ids = new Set(), chunks = []
    for (const entry of Object.values(bundle)) if (entry.type === 'chunk') {
      chunks.push(entry.fileName)
      for (const id of Object.keys(entry.modules)) {
        const normalized = id.replaceAll('\\', '/')
        ids.add(normalized)
        modules.add(normalized)
      }
    }
    bundles.push({ target, chunks, moduleCount: ids.size })
  },
})
await build({ logLevel: 'warn', build: { write: false }, plugins: [auditPlugin('page')],
  worker: { plugins: () => [auditPlugin('worker')] } })
if (!modules.size) throw new Error('Список модулей пуст: отсутствие уязвимых пакетов не подтверждено.')
for (const target of ['page', 'worker']) {
  if (!bundles.some(bundle => bundle.target === target && bundle.moduleCount > 0)) {
    throw new Error('Не проверен граф модулей: ' + target)
  }
}
const packages = [...modules].filter(id => id.includes('/node_modules/')).map(id => id.split('/node_modules/').at(-1))
const results = flagged.map(name => ({ package: name, inBrowserBundle: packages.some(path => path.startsWith(name + '/')) }))
const report = { moduleCount: modules.size, bundles, results,
  runtimePackages: [...new Set(packages.map(path => path.startsWith('@') ? path.split('/').slice(0, 2).join('/') : path.split('/')[0]))].sort() }
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true })
await writeFile(new URL('../test-results/production-module-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (results.some(row => row.inBrowserBundle)) process.exitCode = 1
