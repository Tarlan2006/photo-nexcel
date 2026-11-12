import { lazy, Suspense, useEffect, useRef } from 'react'
import { LangProvider, useLang } from './contexts/LangContext'
import { WizardProvider, useWizard } from './contexts/WizardContext'
import Header from './components/Header'
import StepIndicator from './components/StepIndicator'
import Step1Photo from './components/Step1Photo'
import Step3Document from './components/Step3Document'
import Step4Check from './components/Step4Check'
import Step5Done from './components/Step5Done'
import BottomBar from './components/BottomBar'
import Footer from './components/Footer'
import { steps } from './steps'

const Step2Editor = lazy(() => import('./components/Step2Editor'))

function WizardContent() {
  const { step } = useWizard()
  const { t } = useLang()
  const mainRef = useRef(null)
  const lastStep = useRef(step)

  useEffect(() => {
    if (lastStep.current === step) return
    lastStep.current = step
    window.scrollTo(0, 0)
    mainRef.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [step])

  return (
    <div className="min-h-screen bg-paper text-text-main flex flex-col justify-between">
      <Header />
      <div className="pt-16">
        <StepIndicator />

        <main id="wizard-main" tabIndex={-1} ref={mainRef} className="min-h-[500px]">
          {step === steps.PHOTO && <Step1Photo />}
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

export default function App() {
  return (
    <LangProvider>
      <WizardProvider>
        <WizardContent />
      </WizardProvider>
    </LangProvider>
  )
}
