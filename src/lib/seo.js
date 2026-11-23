import { translations } from '../i18n.js'
import { releaseCopy } from '../content/release-copy.js'
import { localizedPath } from './locale.js'
import { pathFor } from './routes.js'
import { photoPageCopy } from '../content/photo-page-copy.js'

export function pageMetadata(tool, lang, doc = 'kz_id') {
  const signature = tool === 'signature'
  const site = translations[lang].site
  const dv = !signature && doc === 'dv'
  const copy = releaseCopy[lang]
  const title = signature ? site.signatureSeoTitle : dv ? copy.dvSeoTitle : copy.photoSeoTitle
  const description = signature ? site.signatureSeoDescription : dv ? copy.dvSeoDescription : copy.photoSeoDescription
  const url = 'https://photo.nexcel.kz' + localizedPath(pathFor(tool, doc), lang)
  const site0 = 'https://photo.nexcel.kz'
  const crumbs = [{ name: 'Nexcel Solutions', url: 'https://nexcel.kz' }]
  if (signature) crumbs.push({ name: site.signatureTab, url })
  else {
    crumbs.push({ name: site.photoService, url: site0 + localizedPath(pathFor('photo', 'kz_id'), lang) })
    if (dv) crumbs.push({ name: photoPageCopy[lang].docs.dv.pill, url })
  }
  const breadcrumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(({ name, url: item }, index) => ({ '@type': 'ListItem', position: index + 1, name, item })),
  }
  const faq = signature ? null : {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: photoPageCopy[lang].docs[dv ? 'dv' : 'kz_id'].faq.map(([name, text]) => ({
      '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text },
    })),
  }
  return {
    title, description, url, breadcrumbs, faq,
    image: signature ? '/og-signature.png' : '/og-image.png',
    locale: lang === 'kz' ? 'kk_KZ' : 'ru_RU',
    application: {
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: signature ? site.signatureTab : site.photoService, url, description,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', inLanguage: ['ru', 'kk'],
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'KZT' },
      publisher: { '@type': 'Organization', name: 'Nexcel Solutions', url: 'https://nexcel.kz' },
    },
  }
}
