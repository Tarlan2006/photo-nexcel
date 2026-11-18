import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../i18n'
import { languageFromSearch, updateLanguageUrl } from '../lib/locale'

const LangContext = createContext(null)

const STORAGE_KEY = 'photo_nexcel_lang'

function getInitialLang() {
  const explicit = languageFromSearch(window.location.search, window.location.pathname)
  if (explicit) return explicit
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ru' || saved === 'kz') {
      return saved
    }
  } catch {
    // localStorage might be unavailable or disabled
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const nav = navigator.language.toLowerCase()
      if (nav.startsWith('kk') || nav.startsWith('kz')) {
        return 'kz'
      }
    }
  } catch {
    // ignore
  }

  return 'ru'
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang)
  const t = translations[lang] || translations.ru

  const setLang = (newLang) => {
    if (newLang !== 'ru' && newLang !== 'kz') return
    setLangState(newLang)
    updateLanguageUrl(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      // ignore
    }
  }

  // Update html lang attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru'
      updateLanguageUrl(lang)
    }
  }, [lang])

  useEffect(() => {
    const restore = () => {
      const next = languageFromSearch(window.location.search, window.location.pathname) ?? 'ru'
      setLangState(next)
      try { localStorage.setItem(STORAGE_KEY, next) } catch { /* Storage can be disabled. */ }
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const context = useContext(LangContext)
  if (!context) {
    throw new Error('useLang must be used within a LangProvider')
  }
  return context
}
