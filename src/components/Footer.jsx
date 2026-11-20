import { useLang } from '../contexts/LangContext'
import { brandFirst, brandRest, email, footerCompanyPages, mapUrl, phone, servicePages, sharedNavigation, siteLabel, siteLinks, socials, whatsAppUrl } from '../siteLinks'
import { navigationText } from '../lib/shared-navigation'
import SiteIcon from './SiteIcon'
import { releaseCopy } from '../content/release-copy'

const footerLink = 'inline-flex min-h-11 min-w-11 items-center rounded hover:text-emerald-400 lg:min-h-7 lg:min-w-0'
const columnHeading = 'mb-1 text-xs font-extrabold tracking-wide text-white uppercase'

function FooterLinks({ heading, pages, labels }) {
  const { lang, t: { site } } = useLang()
  return (
    <div>
      <h2 className={columnHeading}>{heading}</h2>
      <ul>
        {pages.map((key) => (
          <li key={key}><a href={siteLinks[key]} className={`${footerLink} text-sm`}>{siteLabel(key, lang, key === 'photo' ? site.photoService : labels[key], true)}</a></li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  const { lang, t: { site } } = useLang()
  const copy = releaseCopy[lang]
  const footer = sharedNavigation.footer
  const text = (value, fallback) => navigationText(value, lang, fallback)
  const badgeFallback = { 'ЭСФ / АВР': site.documentsBadge, B2B: 'B2B', 'Оплата в ₸': site.paymentBadge }

  return (
    <footer className="border-t border-slate-800 bg-dark-bg text-xs text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-5 lg:gap-8">
          <div className="col-span-2">
            <p className="font-heading text-lg font-extrabold tracking-tight text-white">
              {brandFirst} <span className="text-emerald-400">{brandRest}</span>
            </p>
            <p className="mt-3 max-w-md leading-relaxed">{text(footer.description, site.description)}</p>
            <a href={footer.about.href} className={`${footerLink} mt-1 gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300`}>
              {text(footer.about.label, site.learnMore)} <span aria-hidden="true">→</span>
            </a>
            <ul className="mt-3 flex flex-wrap gap-2">
              {footer.badges.map(value => text(value, badgeFallback[value.ru])).map((badge) => (
                <li key={badge} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] leading-relaxed">
                  {badge}
                </li>
              ))}
            </ul>

            <nav aria-label={text(footer.socialTitle, site.socials)} className="mt-6">
              <h2 className={`${columnHeading} mb-2`}>{text(footer.socialTitle, site.socials)}</h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map(([icon, network, href, label]) => (
                  <li key={network}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={text(label, site.socialAccount.replace('{network}', network))}
                      className="grid size-11 place-items-center rounded-lg border border-slate-800 bg-slate-900 hover:border-emerald-400 hover:text-emerald-400 lg:size-10"
                    >
                      <SiteIcon name={icon} className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <FooterLinks heading={text(footer.columns[0].title, site.services)} pages={servicePages} labels={{ ...site.links, ...site.footerServices }} />
          <FooterLinks heading={text(footer.columns[1].title, site.company)} pages={footerCompanyPages} labels={site.links} />

          <div className="col-span-2 md:col-span-1">
            <h2 className={columnHeading}>{text(footer.contacts.title, site.contacts)}</h2>
            <address className="not-italic">
              <p className="flex min-h-7 items-center gap-1.5">
                <SiteIcon name="location" className="size-3.5 shrink-0 text-emerald-400" /> {text(footer.contacts.location, site.location)}
              </p>
              <ul>
                <li>
                  <a className={`${footerLink} gap-1.5`} href={`mailto:${email}`}>
                    <SiteIcon name="email" className="size-3.5 shrink-0 text-emerald-400" /> {email}
                  </a>
                </li>
                <li>
                  <a className={`${footerLink} gap-1.5`} href={whatsAppUrl} target="_blank" rel="noopener noreferrer" aria-label={site.writeWhatsApp.replace('{phone}', phone)}>
                    <SiteIcon name="message" className="size-3.5 shrink-0 text-emerald-400" /> {phone}
                  </a>
                </li>
                {mapUrl && <li><a className={footerLink} href={mapUrl} target="_blank" rel="noopener noreferrer">{text(footer.contacts.map.label, site.map)}</a></li>}
              </ul>
            </address>
          </div>
        </div>

        <section className="mt-8 border-t border-slate-800 pt-5 leading-relaxed text-slate-300">
          <h2 className={columnHeading}>{copy.privacyTitle}</h2>
          <p>{copy.privacy}</p>
          <p className="mt-2">{copy.privacyStorage}</p>
          <p className="mt-2">{copy.privacyTracking}</p>
          <p className="mt-2">{copy.privacySession}</p>
          <p className="mt-2">{copy.privacyHosting}</p>
          <a href="https://nexcel.kz/privacy" className={`${footerLink} mt-1 underline underline-offset-2`}>{copy.privacyMore}</a>
          <p className="mt-2">{copy.unofficial}</p>
        </section>
        <div className="mt-5 border-t border-slate-800 pt-5 leading-relaxed">
          <p className="text-[13px]">
            {footer.legal}
          </p>
          <div className="mt-2 flex flex-col gap-x-4 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <p>{text(footer.copyright, site.copyright)}</p>
              <a href="https://nexcel.kz/free" aria-label={copy.madeBy}
                className={`${footerLink} max-w-full whitespace-normal underline underline-offset-2`}>{copy.madeBy}</a>
            </div>
            <a className={`${footerLink} underline underline-offset-2`} href={footer.privacy.href}>{text(footer.privacy.label, site.privacy)}</a>
            <p className="lg:ml-auto">{text(footer.paymentTerms, site.paymentTerms)}</p>
          </div>
          <p className="mt-2">{text(footer.logoRights, site.logoRights)}</p>
        </div>
      </div>
    </footer>
  )
}
