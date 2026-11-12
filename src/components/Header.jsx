import { useLang } from '../contexts/LangContext'

export default function Header() {
  const { lang, setLang } = useLang()

  return (
    <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo / Back */}
        <a
          href="https://nexcel.kz"
          className="flex items-center gap-2.5 text-text hover:text-accent transition-colors"
        >
          <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center">
            <span className="text-white font-heading font-extrabold text-sm">N</span>
          </div>
          <span className="font-heading font-extrabold text-lg">nexcel</span>
          <span className="text-[#4B525D] text-sm font-medium ml-1">/ photo</span>
        </a>

        {/* Lang Switcher: Two Buttons "RU · KZ" without arrow */}
        <div
          role="group"
          aria-label="Выбор языка / Тіл таңдау"
          className="flex items-center gap-1 font-mono text-xs sm:text-sm bg-card border border-border rounded-md px-1.5 py-1"
        >
          <button
            type="button"
            onClick={() => setLang('ru')}
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
              lang === 'ru'
                ? 'font-bold text-text bg-bg border border-border/80 shadow-2xs'
                : 'text-[#4B525D] hover:text-text'
            }`}
            aria-pressed={lang === 'ru'}
          >
            RU
          </button>
          <span className="text-border font-bold select-none px-0.5">·</span>
          <button
            type="button"
            onClick={() => setLang('kz')}
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
              lang === 'kz'
                ? 'font-bold text-text bg-bg border border-border/80 shadow-2xs'
                : 'text-[#4B525D] hover:text-text'
            }`}
            aria-pressed={lang === 'kz'}
          >
            KZ
          </button>
        </div>
      </div>
    </header>
  )
}
