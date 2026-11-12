import { useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { companyPages, email, phone, servicePages, siteHome, siteLinks, whatsAppUrl } from '../siteLinks'
import SiteIcon from './SiteIcon'

const serviceMenuPages = [...servicePages, 'calculator']
const menuLink = 'flex min-h-11 items-center rounded px-3 py-2 text-sm hover:bg-paper hover:text-emerald-accent'

export default function Header() {
  const { lang, setLang, t: { site } } = useLang()
  const [openPanel, setOpenPanel] = useState(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const serviceGroup = useRef(null)
  const serviceToggle = useRef(null)
  const mobileGroup = useRef(null)
  const mobileToggle = useRef(null)

  const servicesOpen = openPanel === 'services'
  const mobileOpen = openPanel === 'mobile'

  useEffect(() => {
    if (!openPanel) return
    const group = openPanel === 'mobile' ? mobileGroup.current : serviceGroup.current
    const toggle = openPanel === 'mobile' ? mobileToggle.current : serviceToggle.current
    group.querySelector('a')?.focus()

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      toggle.focus()
      setOpenPanel(null)
    }
    const handleOutside = (event) => {
      if (!group.contains(event.target)) setOpenPanel(null)
    }
    const desktop = window.matchMedia('(min-width: 64rem)')
    const closePanel = () => setOpenPanel(null)

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handleOutside)
    desktop.addEventListener('change', closePanel)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handleOutside)
      desktop.removeEventListener('change', closePanel)
    }
  }, [openPanel])

  const closeOnBlur = (event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpenPanel(null)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-grid-border bg-paper/90 backdrop-blur-md">
      <a
        href="#wizard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-2 focus:z-10 focus:rounded focus:bg-white focus:px-4 focus:py-3"
      >
        {site.skipToWizard}
      </a>
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-2 lg:px-8 xl:gap-5">
        <div className="flex shrink-0 items-center gap-3">
          <a href={siteHome} className="flex min-h-11 items-center gap-2 rounded sm:gap-3">
            <span className="size-8 shrink-0 sm:size-9" aria-hidden="true">
              {logoFailed ? (
                <span className="grid size-full place-items-center rounded bg-dark-bg font-heading text-base font-extrabold text-white shadow-sm">N</span>
              ) : (
                <img
                  src="/logo-1024.png"
                  alt=""
                  width="36"
                  height="36"
                  className="size-full object-contain drop-shadow-xs"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="whitespace-nowrap font-heading text-sm font-extrabold tracking-tight sm:text-base">
                Nexcel <span className="text-emerald-accent">Solutions</span>
              </span>
              <span className="mt-0.5 hidden whitespace-nowrap text-[10px] tracking-wide text-text-muted uppercase sm:block">
                Engineering &amp; Solutions
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[10px] text-text-muted xl:hidden">/ {site.photoService}</span>
            </span>
          </a>
          <span className="hidden whitespace-nowrap text-xs text-text-muted xl:inline">/ {site.photoService}</span>
        </div>

        <nav aria-label={site.navigation} className="hidden items-center gap-0.5 text-xs font-medium lg:flex xl:gap-2 xl:text-sm">
          <div ref={serviceGroup} onBlur={closeOnBlur} className="relative">
            <button
              ref={serviceToggle}
              type="button"
              aria-expanded={servicesOpen}
              aria-controls="site-services"
              onClick={() => setOpenPanel(servicesOpen ? null : 'services')}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-2 hover:text-emerald-accent xl:px-2.5"
            >
              {site.services}
              <SiteIcon name="chevron" className={`size-3.5 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
            </button>
            <ul
              id="site-services"
              hidden={!servicesOpen}
              className="absolute top-full left-0 mt-2 w-max max-w-xs rounded-lg border border-grid-border bg-white p-1.5 shadow-lg"
            >
              {serviceMenuPages.map((key) => (
                <li key={key}><a href={siteLinks[key]} className={menuLink}>{site.links[key]}</a></li>
              ))}
            </ul>
          </div>
          {companyPages.map((key) => (
            <a key={key} href={siteLinks[key]} className="flex min-h-11 items-center whitespace-nowrap rounded px-2 hover:text-emerald-accent xl:px-2.5">
              {key === 'faq' ? 'FAQ' : site.links[key]}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-2 xl:gap-3">
          <div role="group" aria-label={site.languages} className="flex rounded border border-grid-border bg-white text-xs font-semibold">
            {['ru', 'kz'].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={lang === option}
                onClick={() => setLang(option)}
                className={`min-h-11 min-w-11 cursor-pointer rounded-sm lg:min-h-8 lg:min-w-8 ${
                  lang === option ? 'bg-emerald-accent/10 text-emerald-accent' : 'text-text-muted hover:text-emerald-accent'
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <a
            href={`mailto:${email}`}
            className="hidden min-h-8 items-center gap-1.5 rounded border border-grid-border bg-white px-2 text-xs text-text-muted hover:text-emerald-accent lg:inline-flex xl:px-2.5"
          >
            <SiteIcon name="email" className="size-3.5 text-emerald-accent" /> {email}
          </a>
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={site.writeWhatsApp.replace('{phone}', phone)}
            className="hidden size-11 place-items-center rounded-[35%] bg-emerald-accent text-white shadow-sm hover:bg-emerald-accent-hover lg:grid"
          >
            <SiteIcon name="whatsapp" className="size-6" />
          </a>

          <div ref={mobileGroup} onBlur={closeOnBlur} className="lg:hidden">
            <button
              ref={mobileToggle}
              type="button"
              aria-label={mobileOpen ? site.closeMenu : site.openMenu}
              aria-expanded={mobileOpen}
              aria-controls="site-mobile-menu"
              onClick={() => setOpenPanel(mobileOpen ? null : 'mobile')}
              className="grid size-11 cursor-pointer place-items-center rounded border border-grid-border bg-white text-text-main hover:text-emerald-accent"
            >
              <SiteIcon name={mobileOpen ? 'close' : 'menu'} className="size-5" />
            </button>
            <nav
              id="site-mobile-menu"
              aria-label={site.navigation}
              hidden={!mobileOpen}
              className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-y border-grid-border bg-white p-4 shadow-lg"
            >
              <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase">{site.services}</p>
              <ul>
                {serviceMenuPages.map((key) => (
                  <li key={key}><a href={siteLinks[key]} className={menuLink}>{site.links[key]}</a></li>
                ))}
              </ul>
              <ul className="my-2 border-y border-grid-border py-2">
                {companyPages.map((key) => (
                  <li key={key}><a href={siteLinks[key]} className={menuLink}>{site.links[key]}</a></li>
                ))}
              </ul>
              <a href={`mailto:${email}`} className={`${menuLink} gap-2`}>
                <SiteIcon name="email" className="size-4 text-emerald-accent" /> {email}
              </a>
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={site.writeWhatsApp.replace('{phone}', phone)}
                className={`${menuLink} gap-2`}
              >
                <SiteIcon name="whatsapp" className="size-4 text-emerald-accent" /> WhatsApp
              </a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
