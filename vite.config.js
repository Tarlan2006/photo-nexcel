import { createReadStream, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

export default defineConfig({
  plugins: [react(), tailwindcss(), mediaPipeAssets],
  define: { __MEDIAPIPE_WASM_PATH__: JSON.stringify(visionWasmPath) },
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
  },
})
