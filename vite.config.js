import { createReadStream, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { pageMetadata } from './src/lib/seo.js'
import { routeFromPath } from './src/lib/routes.js'
import { buildDateFor, datedSitemap } from './scripts/lib/build-metadata.js'

const buildDate = buildDateFor(new Date())
const sitemap = datedSitemap(readFileSync(new URL('./scripts/templates/sitemap.xml', import.meta.url), 'utf8'), buildDate)

const require = createRequire(import.meta.url)
const visionPackage = '@mediapipe/tasks-vision'
const wasmLoader = require.resolve(`${visionPackage}/vision_wasm_internal.js`)
const { version: visionVersion } = JSON.parse(readFileSync(resolve(dirname(wasmLoader), '..', 'package.json'), 'utf8'))
const visionWasmPath = `/wasm/${visionVersion}`
const visionFiles = new Map([
  [`${visionWasmPath}/vision_wasm_internal.js`, { source: wasmLoader, type: 'text/javascript' }],
  [`${visionWasmPath}/vision_wasm_internal.wasm`, {
    source: require.resolve(`${visionPackage}/vision_wasm_internal.wasm`),
    type: 'application/wasm',
  }],
])

const mediaPipeAssets = {
  name: 'mediapipe-vision-assets',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const file = visionFiles.get(request.url?.split('?')[0])
      if (!file || (request.method !== 'GET' && request.method !== 'HEAD')) return next()
      response.setHeader('Content-Type', file.type)
      if (request.method === 'HEAD') return response.end()
      createReadStream(file.source).on('error', next).pipe(response)
    })
  },
  async generateBundle() {
    for (const [url, { source }] of visionFiles) {
      this.emitFile({ type: 'asset', fileName: url.slice(1), source: await readFile(source) })
    }
  },
}

function serveSignatureEntry(server) {
  server.middlewares.use((request, _response, next) => {
    const match = (request.method === 'GET' || request.method === 'HEAD') && /^(\/(?:kk\/)?(?:signature|green-card))(?:\?|$)/.exec(request.url)
    if (match) request.url = request.url.replace(match[1], match[1] + '/')
    next()
  })
}

export default defineConfig({
  appType: 'mpa',
  plugins: [
    react(), tailwindcss(), mediaPipeAssets,
    { name: 'release-metadata', transformIndexHtml(html, context) {
      const lang = context.path.startsWith('/kk/') ? 'kz' : 'ru'
      const { tool, doc } = routeFromPath(context.path)
      const { title, description, application } = pageMetadata(tool, lang, doc ?? 'kz_id')
      const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
      return {
        html: html.replaceAll('__LOCAL_TITLE__', escape(title)).replaceAll('__LOCAL_DESCRIPTION__', escape(description)),
        tags: [
          { tag: 'script', attrs: { type: 'application/ld+json', id: 'webapplication-jsonld' },
            children: JSON.stringify(application).replaceAll('<', '\\u003c'), injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'build-date', content: buildDate }, injectTo: 'head' },
        ],
      }
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap }) },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/sitemap.xml') return next()
        response.setHeader('Content-Type', 'application/xml; charset=utf-8')
        response.end(sitemap)
      })
    } },
    { name: 'signature-entry', configureServer: serveSignatureEntry, configurePreviewServer: serveSignatureEntry },
  ],
  define: { __MEDIAPIPE_WASM_PATH__: JSON.stringify(visionWasmPath), __BUILD_DATE__: JSON.stringify(buildDate) },
  preview: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none';",
    },
  },
  build: {
    outDir: 'dist',
    rolldownOptions: {
      input: {
        photo: fileURLToPath(new URL('./index.html', import.meta.url)),
        signature: fileURLToPath(new URL('./signature/index.html', import.meta.url)),
        greenCard: fileURLToPath(new URL('./green-card/index.html', import.meta.url)),
        photoKz: fileURLToPath(new URL('./kk/index.html', import.meta.url)),
        greenCardKz: fileURLToPath(new URL('./kk/green-card/index.html', import.meta.url)),
        signatureKz: fileURLToPath(new URL('./kk/signature/index.html', import.meta.url)),
      },
    },
  },
})
