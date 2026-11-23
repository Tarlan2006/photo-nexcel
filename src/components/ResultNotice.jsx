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

export function BusinessCta({ inline = false }) {
  const { lang } = useLang()
  const copy = releaseCopy[lang]
  if (inline) {
    return (
      <div data-business-cta="" className="mt-3 rounded-lg border border-grid-border p-3 text-sm">
        <p className="font-medium leading-relaxed">{copy.businessCta}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a className={secondaryButton + ' inline-flex items-center justify-center'} href="https://wa.me/77711369095" target="_blank" rel="noopener noreferrer" aria-label={copy.businessWhatsApp}>WhatsApp</a>
          <a className={secondaryButton + ' inline-flex items-center justify-center'} href="https://t.me/nexcel_kz" target="_blank" rel="noopener noreferrer" aria-label={copy.businessTelegram}>Telegram</a>
        </div>
      </div>
    )
  }
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
