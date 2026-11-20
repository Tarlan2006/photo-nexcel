import { useLang } from '../contexts/LangContext'
import { releaseCopy } from '../content/release-copy'
import { secondaryButton } from './editor/EditorControls'

export function ResultDisclaimer({ children }) {
  const { lang } = useLang()
  return (
    <div data-result-disclaimer="" className="mt-3 space-y-2 text-xs leading-relaxed text-text-muted">
      <p>{releaseCopy[lang].resultDisclaimer.replace('{date}', __BUILD_DATE__)}</p>
      {children}
    </div>
  )
}

export function BusinessCta() {
  const { lang } = useLang()
  const copy = releaseCopy[lang]
  return (
    <details data-business-cta="" className="mt-3 rounded-lg border border-grid-border px-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-medium leading-relaxed">{copy.businessCta}</summary>
      <div className="flex flex-wrap gap-2 pb-3">
        <a className={secondaryButton} href="https://wa.me/77711369095" aria-label={copy.businessWhatsApp}>WhatsApp</a>
        <a className={secondaryButton} href="https://t.me/nexcel_kz" aria-label={copy.businessTelegram}>Telegram</a>
      </div>
    </details>
  )
}
