const legacyKeys = {
  '/avtomatizaciya-excel': 'excel', '/telegram-boty': 'bots', '/vnedrenie-ii': 'ai',
  '/licensing': 'licensing', '/sozdanie-saitov': 'websites', '/seo': 'seo', '/templates': 'templates',
  '/news': 'news', '/o-kompanii': 'about', '/faq': 'faq', '/privacy': 'privacy',
}

export function validateSharedNavigation(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.nav) || !data.nav.length ||
      !Array.isArray(data.footer?.columns) || data.footer.columns.length !== 2 ||
      !Array.isArray(data.footer.social) || typeof data.logo?.alt !== 'string' || !data.logo.alt ||
      typeof data.footer.legal !== 'string' || !data.footer.legal || !Number.isFinite(Date.parse(data.updatedAt)) ||
      !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data.footer.contacts?.email ?? '') || typeof data.footer.contacts?.phone !== 'string' || !data.footer.contacts.phone) {
    throw new Error('Некорректная версия или структура общего меню NEXCEL.')
  }
  function inspect(value) {
    if (!value || typeof value !== 'object') return
    if ('ru' in value && (typeof value.ru !== 'string' || !value.ru.trim() || typeof value.kk !== 'string')) throw new Error('В общем меню отсутствуют RU/KK поля.')
    for (const [key, child] of Object.entries(value)) {
      if (key === 'href' || key === 'src') {
        let url
        try { url = new URL(child) } catch { throw new Error('В общем меню требуется абсолютный HTTPS URL.') }
        if (typeof child !== 'string' || !child.startsWith('https://') || child !== child.trim() || url.protocol !== 'https:' || url.username || url.password) throw new Error('В общем меню требуется безопасный HTTPS URL.')
      } else inspect(child)
    }
  }
  inspect(data)
  for (const list of [data.nav, ...data.footer.columns.map(column => column.links), data.footer.social]) {
    if (!Array.isArray(list) || !list.length || list.some(item => !item?.href || !item?.label?.ru || typeof item.label.kk !== 'string') || new Set(list.map(item => item.href)).size !== list.length) throw new Error('Некорректный или повторяющийся список общего меню.')
  }
  for (const label of [data.footer.columns[0].title, data.footer.columns[1].title, data.cta?.label, data.footer.contacts.title, data.footer.contacts.location,
    data.footer.description, data.footer.about?.label, data.footer.privacy?.label, data.footer.copyright, data.footer.paymentTerms, data.footer.logoRights, data.footer.socialTitle]) {
    if (!label?.ru || typeof label.kk !== 'string') throw new Error('Отсутствует подпись общего меню.')
  }
  if (!data.logo.href || !data.logo.src || !data.cta.href || !data.footer.contacts.whatsapp?.href || !Array.isArray(data.footer.badges)) throw new Error('Отсутствуют поля общего меню.')
  return data
}

export function navigationText(value, lang, fallback) {
  return (lang === 'kz' ? value?.kk || fallback : value?.ru) || value?.ru || fallback || ''
}

export function navigationKey(href) {
  const url = new URL(href)
  if (url.origin === 'https://photo.nexcel.kz' && url.pathname === '/') return 'photo'
  if (url.origin === 'https://nexcel.kz') {
    if (url.pathname === '/' && url.hash === '#calculator') return 'calculator'
    if (url.pathname === '/licensing' && url.hash === '#partners') return 'partners'
    if (!url.hash && legacyKeys[url.pathname.replace(/\/$/, '')]) return legacyKeys[url.pathname.replace(/\/$/, '')]
  }
  return href
}

export function createSiteNavigation(data) {
  validateSharedNavigation(data)
  const header = Object.fromEntries(data.nav.map(item => [navigationKey(item.href), item]))
  const footer = Object.fromEntries(data.footer.columns.flatMap(column => column.links).map(item => [navigationKey(item.href), item]))
  const all = [...data.nav, ...data.footer.columns.flatMap(column => column.links), data.footer.about, data.footer.privacy]
  const links = Object.fromEntries(all.map(item => [navigationKey(item.href), item.href]))
  const servicePages = data.footer.columns[0].links.map(item => navigationKey(item.href))
  const companyPages = Object.keys(header).filter(key => !servicePages.includes(key) && key !== 'calculator')
  return { data, links, servicePages, companyPages, footerCompanyPages: data.footer.columns[1].links.map(item => navigationKey(item.href)),
    label(key, lang, fallback, inFooter = false) { return navigationText((inFooter ? footer[key] : header[key])?.label, lang, fallback) } }
}
