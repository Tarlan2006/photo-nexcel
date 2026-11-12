import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { steps } from '../steps'

export default function StepIndicator() {
  const { t } = useLang()
  const { step, goToStep, originalImage } = useWizard()

  return (
    <nav aria-label={t.stepNavigation} className="w-full border-b border-grid-border bg-white px-2 py-1 sm:px-4 sm:py-3">
      <ol className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-[10px] sm:gap-3 sm:text-sm">
        {t.stepLabels.map((label, index) => {
          const number = index + 1
          const active = number === step
          const done = number < step
          const accessible = !active && (done || (number === steps.EDITOR && Boolean(originalImage)))
          return (
            <li key={number} className="min-w-0">
              <button
                type="button"
                onClick={() => goToStep(number)}
                disabled={!accessible}
                aria-current={active ? 'step' : undefined}
                className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-sm px-0.5 sm:flex-row sm:gap-2 ${
                  active ? 'font-heading font-extrabold text-emerald-accent' : 'text-text-muted'
                } ${accessible ? 'cursor-pointer hover:text-emerald-accent' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded-full font-mono text-xs font-bold ${
                    active ? 'bg-emerald-accent text-white' : 'bg-grid-border text-text-main'
                  }`}
                >
                  {done ? '✓' : number}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
