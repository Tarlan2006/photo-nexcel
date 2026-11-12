import { LangProvider } from './contexts/LangContext'
import { WizardProvider, useWizard } from './contexts/WizardContext'
import Header from './components/Header'
import StepIndicator from './components/StepIndicator'
import Step1Photo from './components/Step1Photo'
import Step2Document from './components/Step2Document'
import Step3Check from './components/Step3Check'
import Step4Done from './components/Step4Done'
import BottomBar from './components/BottomBar'
import CompactFAQ from './components/CompactFAQ'
import CompactPrivacy from './components/CompactPrivacy'
import Footer from './components/Footer'

function WizardContent() {
  const { step } = useWizard()

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between">
      <div>
        <Header />
        <StepIndicator />

        <main className="min-h-[500px]">
          {step === 1 && <Step1Photo />}
          {step === 2 && <Step2Document />}
          {step === 3 && <Step3Check />}
          {step === 4 && <Step4Done />}
        </main>
      </div>

      <div className={step > 1 ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]' : ''}>
        <CompactFAQ />
        <CompactPrivacy />
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
