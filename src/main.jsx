import { lazy, StrictMode, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Header from './components/Header'
import { LangProvider, useLang } from './contexts/LangContext'

const PhotoWizard = lazy(() => import('./App.jsx'))
const SignaturePage = lazy(() => import('./components/signature/SignaturePage.jsx'))
const paths = { photo: '/', signature: '/signature/' }
const readTool = () => /^\/signature(?:\/|$)/.test(window.location.pathname) ? 'signature' : 'photo'
const photoMetadata = {
  title: 'Фото на удостоверение РК и Green Card | Nexcel',
  description: 'Подгоним размер и кадр под требования к фото на удостоверение личности РК и Green Card. Бесплатно, фото не покидает ваше устройство.',
  image: '/og-image.png',
  locale: 'ru_RU',
}

function Tools() {
  const { lang, t } = useLang()
  const [tool, setTool] = useState(readTool)
  const [visitedPhoto, setVisitedPhoto] = useState(() => readTool() === 'photo')
  const savedPhotoHistory = useRef(null)

  useEffect(() => {
    function onPopState() {
      const next = readTool()
      setTool(next)
      if (next === 'photo') setVisitedPhoto(true)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const { title, description, image, locale } = tool === 'signature' ? {
      title: t.site.signatureSeoTitle,
      description: t.site.signatureSeoDescription,
      image: '/og-signature.png',
      locale: lang === 'kz' ? 'kk_KZ' : 'ru_RU',
    } : photoMetadata
    const site = 'https://photo.nexcel.kz'
    document.title = title
    document.querySelector('link[rel="canonical"]').href = site + paths[tool]
    const tags = {
      'name="description"': description,
      'property="og:title"': title,
      'property="og:description"': description,
      'property="og:url"': site + paths[tool],
      'property="og:image"': site + image,
      'property="og:locale"': locale,
      'name="twitter:title"': title,
      'name="twitter:description"': description,
      'name="twitter:image"': site + image,
    }
    for (const [selector, content] of Object.entries(tags)) {
      document.querySelector(`meta[${selector}]`)?.setAttribute('content', content)
    }
  }, [lang, t, tool])

  function navigate(event, next) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (next === tool) return
    if (tool === 'photo') savedPhotoHistory.current = window.history.state?.photoWizard
    const saved = savedPhotoHistory.current
    const state = next === 'photo' && saved ? { photoWizard: { step: saved.step, photoId: saved.photoId } } : null
    window.history.pushState(state, '', paths[next])
    window.scrollTo(0, 0)
    if (next === 'photo') setVisitedPhoto(true)
    setTool(next)
  }

  return (
    <>
      <Header tool={tool} />
      <nav aria-label={t.site.toolNavigation} className="mt-16 border-b border-grid-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-5 px-4 sm:gap-7 sm:px-6 lg:px-8">
          {Object.entries({ photo: t.site.photoService, signature: t.site.signatureTab }).map(([key, label]) => (
            <a key={key} href={paths[key]} aria-current={tool === key ? 'page' : undefined}
              onClick={event => navigate(event, key)}
              className="flex min-h-12 items-center border-b-2 border-transparent px-1 text-sm font-semibold text-text-muted hover:text-emerald-accent aria-[current=page]:border-emerald-accent aria-[current=page]:text-emerald-accent">
              {label}
            </a>
          ))}
        </div>
      </nav>
      {visitedPhoto && (
        <div hidden={tool !== 'photo'}>
          <Suspense fallback={<p role="status" className="p-8 text-center">{t.editor.processing}</p>}>
            <PhotoWizard active={tool === 'photo'} />
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
