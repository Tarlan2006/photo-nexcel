import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLang } from './contexts/LangContext'
import { WizardProvider, useWizard } from './contexts/WizardContext'
import StepIndicator from './components/StepIndicator'
import Step1Photo from './components/Step1Photo'
import Step3Document from './components/Step3Document'
import Step4Check from './components/Step4Check'
import Step5Done from './components/Step5Done'
import BottomBar from './components/BottomBar'
import Footer from './components/Footer'
import { steps } from './steps'

const Step2Editor = lazy(() => import('./components/Step2Editor'))

function WizardContent({ active }) {
  const { step, originalImage } = useWizard()
  const { t } = useLang()
  const mainRef = useRef(null)
  const lastStep = useRef(step)

  useEffect(() => {
    if (active && originalImage && window.history.state?.photoWizard?.step !== step) {
      window.history.replaceState({ photoWizard: { step, photoId: originalImage.id } }, '')
    }
    if (!active || lastStep.current === step) return
    lastStep.current = step
    window.scrollTo(0, 0)
    mainRef.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [step, active, originalImage])

  return (
    <div className="min-h-[calc(100dvh-7rem)] bg-paper text-text-main flex flex-col justify-between">
      <div>
        <StepIndicator />

        <main id="wizard-main" tabIndex={-1} ref={mainRef} className="min-h-[500px]">
          {step === steps.PHOTO && <Step1Photo active={active} />}
          {step === steps.EDITOR && (
            <Suspense fallback={<p role="status" className="p-8 text-center">{t.editor.processing}</p>}>
              <Step2Editor />
            </Suspense>
          )}
          {step === steps.DOCUMENT && <Step3Document />}
          {step === steps.CHECK && <Step4Check />}
          {step === steps.DONE && <Step5Done />}
        </main>
      </div>

      <div className={step > steps.PHOTO ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]' : ''}>
        <Footer />
      </div>

      <BottomBar />
    </div>
  )
}

export default function App({ active }) {
  return (
    <WizardProvider>
      <WizardContent active={active} />
    </WizardProvider>
  )
}
