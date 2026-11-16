import { requirements } from '../src/content/requirements.js'

const urls = new Set(Object.values(requirements).flatMap(({ sources }) => sources.map(({ url }) => url)))

await Promise.all([...urls].map(async url => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const finalUrl = new URL(response.url)
    await response.body?.cancel()
    if (!response.ok) {
      console.warn(`Warning: HTTP ${response.status} for ${url}`)
    } else if (response.redirected && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/i.test(finalUrl.pathname)) {
      console.warn(`Warning: ${url} redirects to the homepage (${finalUrl.href})`)
    } else if (new URL(url).pathname.endsWith('.pdf') && response.headers.get('content-type')?.includes('text/html')) {
      console.warn(`Warning: expected a PDF at ${url}, received HTML (${finalUrl.href})`)
    } else {
      console.log(`OK: ${url}${response.redirected ? ' → ' + finalUrl.href : ''}`)
    }
  } catch (error) {
    console.warn(`Warning: could not check ${url} (${error.cause?.code ?? error.message})`)
  }
}))
