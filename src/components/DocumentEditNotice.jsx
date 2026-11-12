import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'

export default function DocumentEditNotice() {
  const { t: { editor } } = useLang()
  const { selectedPresetId, appliedEdit } = useWizard()
  if (selectedPresetId !== 'dv') return null

  const warnings = [
    appliedEdit.filter !== 'none' && editor.dvFilterWarning,
    appliedEdit.bg.enabled && editor.dvBackgroundWarning,
    appliedEdit.suit.enabled && editor.dvSuitWarning,
  ].filter(Boolean)

  if (!warnings.length) return null
  return (
    <ul className="mb-5 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" aria-live="polite">
      {warnings.map((warning) => <li key={warning}>{warning}</li>)}
    </ul>
  )
}
