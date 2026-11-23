import { translations } from '../i18n.js'
import { releaseCopy } from '../content/release-copy.js'
import { localizedPath } from './locale.js'
import { pathFor } from './routes.js'

export function pageMetadata(tool, lang, doc = 'kz_id') {
  const signature = tool === 'signature'
  const site = translations[lang].site
  const dv = !signature && doc === 'dv'
  const copy = releaseCopy[lang]
  const title = signature ? site.signatureSeoTitle : dv ? copy.dvSeoTitle : copy.photoSeoTitle
  const description = signature ? site.signatureSeoDescription : dv ? copy.dvSeoDescription : copy.photoSeoDescription
  const url = 'https://photo.nexcel.kz' + localizedPath(pathFor(tool, doc), lang)
  return {
    title, description, url,
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
