import { useLang } from '../contexts/LangContext'

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="border-t border-border py-10 bg-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
              <span className="text-white font-heading font-extrabold text-xs">N</span>
            </div>
            <span className="font-heading font-extrabold text-base">nexcel</span>
            <span className="text-[#4B525D] text-sm font-medium ml-1">/ photo</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="#privacy"
              className="text-[#4B525D] text-sm font-medium hover:text-text transition-colors"
            >
              {t.footerPrivacy}
            </a>
            <a
              href="https://nexcel.kz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4B525D] text-sm font-medium hover:text-text transition-colors flex items-center gap-1"
            >
              <span>{t.footerContact}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#4B525D]" aria-hidden="true">
                <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-center text-[#4B525D] text-xs sm:text-sm font-medium">{t.footerProduct}</p>
        </div>
      </div>
    </footer>
  )
}
