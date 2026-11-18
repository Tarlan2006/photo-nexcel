import snapshot from './content/shared-nav.json' with { type: 'json' }
import { createSiteNavigation } from './lib/shared-navigation.js'

const navigation = createSiteNavigation(snapshot)
export const sharedNavigation = navigation.data
export const siteHome = snapshot.logo.href
export const email = snapshot.footer.contacts.email
export const phone = snapshot.footer.contacts.phone
export const whatsAppUrl = snapshot.footer.contacts.whatsapp.href
export const ctaUrl = snapshot.cta.href
export const mapUrl = snapshot.footer.contacts.map?.href
export const siteLinks = navigation.links
export const servicePages = navigation.servicePages
export const companyPages = navigation.companyPages
export const footerCompanyPages = navigation.footerCompanyPages
export const siteLabel = navigation.label
const networkNames = { telegram: 'Telegram', linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads' }
export const socials = snapshot.footer.social.map(item => [item.id, networkNames[item.id] || item.title.ru, item.href, item.label])
export const [brandFirst, ...brandWords] = snapshot.logo.alt.split(' ')
export const brandRest = brandWords.join(' ')
