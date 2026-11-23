// Single source of truth for the site's pages: /, /green-card/, /signature/ and their /kk/ twins.
export const photoPaths = { kz_id: '/', dv: '/green-card/' }
export const signaturePath = '/signature/'

const plain = pathname => pathname.replace(/^\/kk(?=\/|$)/, '') || '/'

export function routeFromPath(pathname) {
  const path = plain(pathname)
  if (/^\/signature(?:\/|$)/.test(path)) return { tool: 'signature', doc: null }
  if (/^\/green-card(?:\/|$)/.test(path)) return { tool: 'photo', doc: 'dv' }
  return { tool: 'photo', doc: 'kz_id' }
}

export function pathFor(tool, doc) {
  return tool === 'signature' ? signaturePath : photoPaths[doc] ?? photoPaths.kz_id
}

export const isPhotoPath = pathname => routeFromPath(pathname).tool === 'photo'

// Old links used /?doc=kz_id and /?doc=dv. Returns the canonical URL path+search, or null.
export function legacyRedirect(pathname, search) {
  const params = new URLSearchParams(search)
  if (!params.has('doc')) return null
  const doc = params.get('doc')
  params.delete('doc')
  const target = pathFor('photo', doc === 'dv' ? 'dv' : 'kz_id')
  const base = pathname.startsWith('/kk') ? '/kk' + (target === '/' ? '/' : target) : target
  const rest = params.toString()
  return base + (rest ? '?' + rest : '')
}
