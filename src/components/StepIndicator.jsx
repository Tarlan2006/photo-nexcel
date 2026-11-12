import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'

export default function StepIndicator() {
  const { t } = useLang()
  const { step, goToStep, originalImage } = useWizard()

  const steps = [
    { num: 1, label: t.stepLabel1 },
    { num: 2, label: t.stepLabel2 },
    { num: 3, label: t.stepLabel3 },
    { num: 4, label: t.stepLabel4 },
  ]

  return (
    <nav aria-label={t.stepNavigation} className="w-full bg-card border-b border-border py-1 px-3 sm:py-3 sm:px-4">
      <ol className="max-w-2xl mx-auto flex items-center justify-between text-xs sm:text-sm list-none p-0 m-0">
        {steps.map((s, index) => {
          const isActive = s.num === step
          const isDone = s.num < step
          const isAccessible = !isActive && (isDone || (s.num === 2 && Boolean(originalImage)))

          return (
            <li key={s.num} className="flex min-w-0 items-center">
              <button
                type="button"
                onClick={() => goToStep(s.num)}
                disabled={!isAccessible}
                aria-current={isActive ? 'step' : undefined}
                className={`flex min-h-11 min-w-11 items-center gap-1 sm:gap-1.5 transition-colors rounded-sm ${
                  isAccessible ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isActive
                    ? 'font-heading font-extrabold text-accent'
                    : isDone
                    ? 'font-medium text-text hover:text-accent'
                    : 'text-[#4B525D]'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center size-5 shrink-0 rounded-full text-xs font-mono font-bold transition-colors ${
                    isActive
                      ? 'bg-accent text-white'
                      : isDone
                      ? 'bg-text/10 text-text'
                      : 'bg-[#E5E7EB] text-[#2D3139]'
                  }`}
                >
                  {isDone ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    s.num
                  )}
                </span>
                <span className="break-words text-left">{s.label}</span>
              </button>

              {index < steps.length - 1 && (
                <span className="mx-1 sm:mx-3 text-[#9CA3AF] font-bold select-none" aria-hidden="true">
                  ·
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
