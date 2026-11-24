import { lazy, StrictMode, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Header from './components/Header'
import { LangProvider, useLang } from './contexts/LangContext'
import { pageMetadata } from './lib/seo'
import { localizedPath } from './lib/locale'
import { legacyRedirect, pathFor, routeFromPath } from './lib/routes'

const PhotoWizard = lazy(() => import('./App.jsx'))
const SignaturePage = lazy(() => import('./components/signature/SignaturePage.jsx'))
const readRoute = () => routeFromPath(window.location.pathname)
const legacy = legacyRedirect(window.location.pathname, window.location.search)
if (legacy) window.history.replaceState(window.history.state, '', legacy)

function Tools() {
  const { lang, t } = useLang()
  const [route, setRoute] = useState(readRoute)
  const [photoDoc, setPhotoDoc] = useState(() => readRoute().doc ?? 'kz_id')
  const [visitedPhoto, setVisitedPhoto] = useState(() => readRoute().tool === 'photo')
  const { tool } = route
  const path = pathFor(tool, tool === 'photo' ? route.doc : photoDoc)
  const savedPhotoHistory = useRef(null)

  useEffect(() => {
    function onPopState() {
      const next = readRoute()
      setRoute(next)
      if (next.tool === 'photo') { setVisitedPhoto(true); setPhotoDoc(next.doc) }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const { title, description, image, locale, application, faq, breadcrumbs } = pageMetadata(tool, lang, photoDoc)
    const site = 'https://photo.nexcel.kz'
    document.title = title
    const canonical = site + localizedPath(path, lang)
    document.querySelector('link[rel="canonical"]').href = canonical
    for (const [code, language] of [['ru', 'ru'], ['kk', 'kz'], ['x-default', 'ru']]) {
      document.querySelector(`link[rel="alternate"][hreflang="${code}"]`)?.setAttribute('href', site + localizedPath(path, language))
    }
    const tags = {
      'name="description"': description,
      'property="og:title"': title,
      'property="og:description"': description,
      'property="og:url"': canonical,
      'property="og:image"': site + image,
      'property="og:locale"': locale,
      'property="og:locale:alternate"': lang === 'kz' ? 'ru_RU' : 'kk_KZ',
      'name="twitter:title"': title,
      'name="twitter:description"': description,
      'name="twitter:image"': site + image,
    }
    for (const [selector, content] of Object.entries(tags)) {
      document.querySelector(`meta[${selector}]`)?.setAttribute('content', content)
    }
    const writeLd = (id, data) => {
      let node = document.getElementById(id)
      if (!data) return node?.remove()
      if (!node) {
        node = document.createElement('script')
        node.type = 'application/ld+json'
        node.id = id
        document.head.append(node)
      }
      node.textContent = JSON.stringify(data)
    }
    writeLd('webapplication-jsonld', application)
    writeLd('breadcrumb-jsonld', breadcrumbs)
    writeLd('faq-jsonld', faq)
  }, [lang, t, tool, photoDoc, path])

  function navigate(event, next, doc = photoDoc) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (next === tool) return
    if (tool === 'photo') savedPhotoHistory.current = window.history.state?.photoResult
    const saved = savedPhotoHistory.current
    const state = next === 'photo' && saved && doc === photoDoc ? { photoResult: saved } : null
    window.history.pushState(state, '', localizedPath(pathFor(next, doc), lang))
    window.scrollTo(0, 0)
    if (next === 'photo') setVisitedPhoto(true)
    setRoute({ tool: next, doc: next === 'photo' ? doc : null })
  }

  function changeDocument(doc) {
    if (doc === photoDoc) return
    window.history.pushState(null, '', localizedPath(pathFor('photo', doc), lang))
    setPhotoDoc(doc)
    setRoute({ tool: 'photo', doc })
  }

  return (
    <>
      <Header tool={tool} />
      <nav aria-label={t.site.toolNavigation} className="mt-16 border-b border-grid-border bg-white">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:flex-nowrap sm:gap-3 sm:px-6">
          <div className="grid w-full min-w-0 grid-cols-3 gap-1 rounded-xl bg-paper p-1 ring-1 ring-grid-border sm:inline-grid sm:w-auto">
            {[['kz_id', t.site.idTab], ['dv', t.site.greenCardTab], ['signature', t.site.signatureTab]].map(([key, label]) => {
              const current = tool === 'signature' ? key === 'signature' : key === photoDoc
              return (
                <a key={key} href={localizedPath(key === 'signature' ? pathFor('signature') : pathFor('photo', key), lang)}
                  aria-current={current ? 'page' : undefined} data-tab={key === 'signature' ? 'signature' : 'photo'} data-doc={key === 'signature' ? undefined : key}
                  onClick={event => {
                    if (key === 'signature') return navigate(event, 'signature')
                    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    if (tool === 'signature') { setPhotoDoc(key); navigate(event, 'photo', key) } else changeDocument(key)
                  }}
                  className="flex min-h-12 min-w-0 items-center justify-center rounded-lg px-1.5 text-center text-sm leading-tight font-semibold break-words hyphens-auto text-text-muted hover:text-emerald-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-accent aria-[current=page]:bg-emerald-accent aria-[current=page]:text-white aria-[current=page]:hover:text-white sm:px-4 sm:text-base">
                  {label}
                </a>
              )
            })}
          </div>
          <div id="tool-nav-actions" data-tool={tool} className="ml-auto shrink-0 empty:hidden data-[tool=signature]:[&>[data-for=photo]]:hidden data-[tool=photo]:[&>[data-for=signature]]:hidden" />
        </div>
      </nav>
      {visitedPhoto && (
        <div hidden={tool !== 'photo'}>
          <Suspense fallback={<p role="status" className="p-8 text-center">{t.editor.processing}</p>}>
            <PhotoWizard active={tool === 'photo'} doc={photoDoc} onDocument={changeDocument} />
          </Suspense>
        </div>
      )}
      {tool === 'signature' && (
        <Suspense fallback={<p role="status" className="p-8 text-center">{t.editor.processing}</p>}>
          <SignaturePage />
        </Suspense>
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider><Tools /></LangProvider>
  </StrictMode>,
)
