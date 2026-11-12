import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'

export default function BottomBar() {
  const { t } = useLang()
  const { step, goBack, goToStep, activeCropState } = useWizard()

  if (step === 1) {
    return null
  }

  const isNextDisabled = step === 3 && (!activeCropState || !activeCropState.success)

  const handleNext = () => {
    if (step === 2) {
      goToStep(3)
    } else if (step === 3) {
      if (activeCropState?.success) {
        goToStep(4)
      }
    }
  }

  return (
    <aside
      aria-label={t.stepNavigation}
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] px-6 shadow-sm"
    >
      <div className="max-w-xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Back Button */}
        <button
          type="button"
          onClick={goBack}
          className="min-h-[44px] min-w-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded border border-border text-text font-semibold text-sm hover:bg-bg hover:border-text/30 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t.btnBack}</span>
        </button>

        {/* Step progress label for mobile */}
        <span className="font-mono text-xs text-[#4B525D] font-bold" aria-label={t.stepProgress.replace('{step}', step)}>
          {step} / 4
        </span>

        {/* Next Button (for steps 2 and 3) */}
        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={isNextDisabled}
            className={`min-h-[44px] min-w-[44px] inline-flex items-center gap-1.5 px-3 sm:px-6 py-2.5 rounded font-semibold text-sm transition-colors ${
              isNextDisabled
                ? 'bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-white cursor-pointer shadow-2xs'
            }`}
          >
            <span>{t.btnNext}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className="w-16" aria-hidden="true" />
        )}
      </div>
    </aside>
  )
}
