import { useLang } from '../contexts/LangContext'

export default function CompactPrivacy() {
  const { t } = useLang()

  return (
    <section aria-label={t.compactPrivacyText} id="privacy" className="py-6 border-t border-border bg-bg/50">
      <div className="max-w-2xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 text-xs sm:text-sm text-[#4B525D] text-center">
          <div className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-accent shrink-0"
              aria-hidden="true"
            >
              <path
                d="M12 2L4 6V12C4 17.5228 7.41828 22.5085 12 23.9545C16.5817 22.5085 20 17.5228 20 12V6L12 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-semibold text-[#2D3139]">
              {t.compactPrivacyText}
            </span>
          </div>
          <span className="hidden sm:inline text-border font-bold">·</span>
          <span className="text-[#4B525D]">
            {t.compactPrivacyCamera}
          </span>
        </div>
      </div>
    </section>
  )
}
