import { useState } from 'react'
import { useLang } from '../contexts/LangContext'

function FAQItem({ q, a, index }) {
  const [open, setOpen] = useState(false)
  const questionId = `faq-q-${index}`
  const answerId = `faq-a-${index}`

  return (
    <div className="border-b border-border/70 last:border-b-0">
      <button
        id={questionId}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={answerId}
        className="w-full flex items-center justify-between py-3.5 text-left cursor-pointer group focus:outline-none focus:ring-2 focus:ring-accent rounded-sm"
      >
        <span className="font-heading font-extrabold text-sm sm:text-base pr-4 text-text group-hover:text-accent transition-colors">
          {q}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`text-[#4B525D] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M5 8L10 13L15 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-40 pb-3.5' : 'max-h-0'
        }`}
      >
        <p className="text-[#4B525D] text-xs sm:text-sm leading-relaxed font-medium">{a}</p>
      </div>
    </div>
  )
}

export default function CompactFAQ() {
  const { t } = useLang()

  return (
    <section className="py-10 border-t border-border" aria-label={t.faqTitle}>
      <div className="max-w-2xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-xs tracking-wider text-[#4B525D] uppercase font-bold" aria-hidden="true">
            {t.faqLabel}
          </span>
        </div>

        <h3 className="font-heading font-extrabold text-xl sm:text-2xl mb-6 text-text">
          {t.faqTitle}
        </h3>

        <div className="border-t border-border/70 bg-card rounded-xl border p-4 sm:p-5">
          {t.faqs.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
