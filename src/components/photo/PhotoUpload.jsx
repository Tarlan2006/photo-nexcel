import { useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { photoCopy } from '../../content/photo-copy'
import { requirements } from '../../content/requirements'
import { presetList } from '../../presets'
import { photoMimeTypes } from '../../lib/photo'
import { primaryButton, secondaryButton } from '../editor/EditorControls'

export function DocumentPicker({ value, onChange, name, disabled }) {
  const { lang } = useLang()
  const copy = photoCopy[lang]
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-sm font-bold">{copy.document}</legend>
      <div className="grid grid-cols-2 gap-2">
        {presetList.map(preset => (
          <label key={preset.id} className="flex min-h-16 cursor-pointer items-center gap-2 rounded-lg border border-grid-border bg-white p-2.5 text-sm has-checked:border-emerald-accent has-checked:bg-emerald-accent/5 sm:p-3">
            <input type="radio" name={name} value={preset.id} checked={value === preset.id}
              onChange={() => onChange(preset.id)} className="size-4 shrink-0 accent-emerald-accent" />
            <span className="min-w-0 font-semibold">
              {preset.id === 'kz_id' ? copy.idCard : preset.name[lang]}
              <span className="block font-mono text-xs font-medium text-text-muted">{preset.width}×{preset.height}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const symbols = {
  size: 'M8 4H4v4m12-4h4v4m0 8v4h-4m-8 0H4v-4M8 12h8',
  weight: 'M7 7h10l3 13H4L7 7Zm3 0V5a2 2 0 1 1 4 0v2',
  head: 'M8 20v-2a4 4 0 0 1 8 0v2M16 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  format: 'M6 3h8l4 4v14H6V3Zm8 0v5h4m-9 7h6m-6 3h6',
  background: 'M4 4h16v16H4V4Zm3 10 3-3 3 3 2-2 2 2m-1-6h.01',
  position: 'M12 3v5m0 8v5M3 12h5m8 0h5m-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  expression: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 10h.01M15 10h.01M9 15h6',
  glasses: 'M10 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-10 0h4m-13-1h3m16 0h3',
  headwear: 'M6 15v-4a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v4m-14 0h16a2 2 0 1 1 0 4H4a2 2 0 0 1 0-4Z',
  lighting: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5m-3 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  retouch: 'm4 20 11-11 4 4-7 7H4Zm11-11 2-2 4 4-2 2M4 4l16 16',
  age: 'M5 4h14v16H5V4Zm0 5h14M9 2v4m6-4v4m-6 8h3v3',
  clothing: 'M9 4a3 3 0 0 0 6 0l5 2 2 5-4 2v7H6v-7l-4-2 2-5 5-2Z',
}

function Requirements({ initialDocument }) {
  const { lang } = useLang()
  const copy = photoCopy[lang]
  const [override, setOverride] = useState(null)
  const current = override ?? initialDocument
  const { intro, sources, items } = requirements[current]

  return (
    <section className="rounded-xl border border-grid-border bg-white p-4 sm:p-6">
      <h2 id="photo-requirements-label" className="text-lg">{copy.requirements}</h2>
      <div role="tablist" aria-labelledby="photo-requirements-label" className="mt-3 flex flex-wrap gap-2">
        {presetList.map(preset => (
          <button key={preset.id} id={'rule-tab-' + preset.id} role="tab" type="button" aria-selected={current === preset.id}
            tabIndex={current === preset.id ? 0 : -1} aria-controls="photo-rule-panel"
            className={current === preset.id ? primaryButton : secondaryButton}
            onClick={() => setOverride(preset.id)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 'kz_id' : event.key === 'End' ? 'dv' : preset.id === 'dv' ? 'kz_id' : 'dv'
              setOverride(next)
              document.getElementById('rule-tab-' + next)?.focus()
            }}>{preset.name[lang]}</button>
        ))}
      </div>
      <div id="photo-rule-panel" role="tabpanel" aria-labelledby={'rule-tab-' + current} tabIndex={0} className="mt-4">
        <p className="text-sm text-text-muted">{intro[lang]}</p>
        <ul className="my-3 grid gap-2 sm:grid-cols-3">
          {items.map(item => (
            <li key={item.id} className="rounded-lg border border-grid-border bg-paper p-3">
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-emerald-accent"><path d={symbols[item.id]} /></svg>
                <h3 className="text-sm">{item.title[lang]}</h3>
              </div>
              <p className="mt-1 text-sm text-text-muted">{item.detail[lang]}</p>
            </li>
          ))}
        </ul>
        <h3 className="text-sm">{copy.sources}</h3>
        <ul aria-label={copy.sources} className="flex flex-wrap gap-x-4">
          {Object.values(sources).map(source => (
            <li key={source.href}>
              <a href={lang === 'kz' ? source.kazakhHref ?? source.href : source.href} target="_blank" rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-accent underline">
                {source.label[lang]}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-muted">{copy.checkSource}</p>
      </div>
    </section>
  )
}

export default function PhotoUpload({ presetId, onDocument, onFile, onCamera, cameraAvailable, heading, picker }) {
  const { lang, t } = useLang()
  const copy = photoCopy[lang]
  const input = useRef(null)
  const [dragging, setDragging] = useState(false)
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
      <div className="text-center">
        <h1 ref={heading} tabIndex={-1} className="text-2xl tracking-tight focus:outline-none sm:text-4xl">{t.step1Title}</h1>
        <p className="mt-2 text-sm text-text-muted sm:text-base">{t.step1Subtitle}</p>
      </div>
      <div className="rounded-xl border border-grid-border bg-white p-4 sm:p-6">
        <DocumentPicker value={presetId} onChange={onDocument} name="upload-document" />
        <div onDragOver={event => { event.preventDefault(); setDragging(true) }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
          onDrop={event => {
            event.preventDefault()
            setDragging(false)
            onFile(event.dataTransfer.files?.[0], picker.current)
          }}
          className={'mt-4 rounded-xl border-2 border-dashed px-3 py-5 text-center sm:py-8 ' +
            (dragging ? 'border-emerald-accent bg-emerald-accent/5' : 'border-grid-border bg-paper')}>
          <input ref={input} type="file" aria-label={t.choosePhotoLabel} accept={photoMimeTypes.join(',')} hidden
            onChange={event => { onFile(event.target.files?.[0], picker.current); event.target.value = '' }} />
          <div className="flex flex-wrap justify-center gap-2">
            {cameraAvailable && <button type="button" className={primaryButton} onClick={event => onCamera(event.currentTarget)}>{t.btnShootCamera}</button>}
            <button type="button" ref={picker} className={cameraAvailable ? secondaryButton : primaryButton} onClick={() => input.current.click()}>{t.btnChooseFile}</button>
          </div>
          <p className="mt-3 text-sm text-text-muted">{t.uploadDrag}</p>
          <p className="mt-1 text-xs text-text-muted">{t.uploadHint}</p>
          <p className="mt-3 text-sm font-medium text-emerald-accent">{t.photoPrivacy}</p>
        </div>
      </div>
      <Requirements key={presetId} initialDocument={presetId} />
      <section className="rounded-xl border border-grid-border bg-white p-4 sm:p-6">
        <h2 className="text-lg">{copy.faq}</h2>
        <div className="mt-2 divide-y divide-grid-border">
          {copy.questions.map(([question, answer]) => (
            <details key={question}>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{question}</summary>
              <p className="pb-3 text-sm text-text-muted">{answer}</p>
            </details>
          ))}
        </div>
        <a href="#photo-examples" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-accent underline">{copy.examples}</a>
      </section>
      <section id="photo-examples" className="rounded-xl border border-grid-border bg-white p-4 sm:p-6">
        <h2 className="text-lg">{copy.examples}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {t.howToShootTips.slice(0, 3).map(tip => (
            <li key={tip.icon} className="rounded-lg border border-grid-border bg-paper p-3">
              <h3 className="text-sm">{tip.title}</h3>
              <p className="mt-1 text-sm text-text-muted">{tip.desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
