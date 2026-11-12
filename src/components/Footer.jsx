import { useLang } from '../contexts/LangContext'
import { email, mapUrl, phone, servicePages, siteLinks, socials, whatsAppUrl } from '../siteLinks'
import SiteIcon from './SiteIcon'

const companyPages = ['about', 'news', 'templates', 'partners', 'faq']
const footerLink = 'inline-flex min-h-11 min-w-11 items-center rounded hover:text-emerald-400 lg:min-h-7 lg:min-w-0'
const columnHeading = 'mb-1 text-xs font-extrabold tracking-wide text-white uppercase'

function FooterLinks({ heading, pages, labels }) {
  return (
    <div>
      <h2 className={columnHeading}>{heading}</h2>
      <ul>
        {pages.map((key) => (
          <li key={key}><a href={siteLinks[key]} className={`${footerLink} text-sm`}>{labels[key]}</a></li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  const { t: { site } } = useLang()

  return (
    <footer className="border-t border-slate-800 bg-dark-bg text-xs text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-5 lg:gap-8">
          <div className="col-span-2">
            <p className="font-heading text-lg font-extrabold tracking-tight text-white">
              Nexcel <span className="text-emerald-400">Solutions</span>
            </p>
            <p className="mt-3 max-w-md leading-relaxed">{site.description}</p>
            <a href={siteLinks.about} className={`${footerLink} mt-1 gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300`}>
              {site.learnMore} <span aria-hidden="true">→</span>
            </a>
            <ul className="mt-3 flex flex-wrap gap-2">
              {[site.documentsBadge, 'B2B', site.paymentBadge].map((badge) => (
                <li key={badge} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] leading-relaxed">
                  {badge}
                </li>
              ))}
            </ul>

            <nav aria-label={site.socials} className="mt-6">
              <h2 className={`${columnHeading} mb-2`}>{site.socials}</h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map(([icon, network, href]) => (
                  <li key={network}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={site.socialAccount.replace('{network}', network)}
                      className="grid size-11 place-items-center rounded-lg border border-slate-800 bg-slate-900 hover:border-emerald-400 hover:text-emerald-400 lg:size-10"
                    >
                      <SiteIcon name={icon} className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <FooterLinks heading={site.services} pages={servicePages} labels={{ ...site.links, ...site.footerServices }} />
          <FooterLinks heading={site.company} pages={companyPages} labels={site.links} />

          <div className="col-span-2 md:col-span-1">
            <h2 className={columnHeading}>{site.contacts}</h2>
            <address className="not-italic">
              <p className="flex min-h-7 items-center gap-1.5">
                <SiteIcon name="location" className="size-3.5 shrink-0 text-emerald-400" /> {site.location}
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
                <li><a className={footerLink} href={mapUrl} target="_blank" rel="noopener noreferrer">{site.map}</a></li>
              </ul>
            </address>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-5 leading-relaxed">
          <p className="text-[13px]">
            ТОО «Nexcel Solutions» · БИН 260940035710 · {site.legalAddress} Казахстан, г. Астана, район Нұра, ул. Әбікен Бектұров, д. 19, кв. 15, 010000 · {site.director} Абенов Нурбол Муханулы
          </p>
          <div className="mt-2 flex flex-col gap-x-4 lg:flex-row lg:flex-wrap lg:items-center">
            <p>{site.copyright}</p>
            <a className={`${footerLink} underline underline-offset-2`} href={siteLinks.privacy}>{site.privacy}</a>
            <p className="lg:ml-auto">{site.paymentTerms}</p>
          </div>
          <p className="mt-2">{site.logoRights}</p>
        </div>
      </div>
    </footer>
  )
}
