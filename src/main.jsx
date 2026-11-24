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

  function navigate(event, next) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (next === tool) return
    if (tool === 'photo') savedPhotoHistory.current = window.history.state?.photoResult
    const saved = savedPhotoHistory.current
    const state = next === 'photo' && saved ? { photoResult: saved } : null
    window.history.pushState(state, '', localizedPath(pathFor(next, photoDoc), lang))
    window.scrollTo(0, 0)
    if (next === 'photo') setVisitedPhoto(true)
    setRoute({ tool: next, doc: next === 'photo' ? photoDoc : null })
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
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl bg-paper p-1 ring-1 ring-grid-border sm:inline-grid sm:w-auto">
            {Object.entries({ photo: t.site.photoService, signature: t.site.signatureTab }).map(([key, label]) => (
              <a key={key} href={localizedPath(pathFor(key, photoDoc), lang)} aria-current={tool === key ? 'page' : undefined}
                onClick={event => navigate(event, key)}
                className="flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-sm font-semibold text-text-muted hover:text-emerald-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-accent aria-[current=page]:bg-emerald-accent aria-[current=page]:text-white aria-[current=page]:hover:text-white">
                {label}
              </a>
            ))}
          </div>
          <div id="tool-nav-actions" hidden={tool !== 'photo'} className="shrink-0 empty:hidden" />
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
