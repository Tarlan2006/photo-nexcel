export function languageFromSearch(search, pathname = '') {
  const value = new URLSearchParams(search).get('lang')
  return value === 'kk' || value === 'kz' ? 'kz' : value === 'ru' ? 'ru' : pathname === '/kk' || pathname.startsWith('/kk/') ? 'kz' : null
}

export function localizedPath(path, lang) {
  const plain = path === '/kk' ? '/' : path.startsWith('/kk/') ? path.slice(3) : path
  return (lang === 'kz' ? '/kk' : '') + plain
}

export function updateLanguageUrl(lang) {
  const url = new URL(window.location.href)
  url.pathname = localizedPath(url.pathname, lang)
  url.searchParams.delete('lang')
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
}
