import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { releaseCopy } from '../../content/release-copy'
import { photoCopy } from '../../content/photo-copy'
import { photoPageCopy } from '../../content/photo-page-copy'
import { requirements } from '../../content/requirements'
import { presetList } from '../../presets'
import { photoMimeTypes } from '../../lib/photo'
import SourceLink from '../SourceLink'
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
  quality: 'M8 4H4v4m12-4h4v4m0 8v4h-4m-8 0H4v-4m4-4 3 3 5-5',
  lighting: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5m-3 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  retouch: 'm4 20 11-11 4 4-7 7H4Zm11-11 2-2 4 4-2 2M4 4l16 16',
  age: 'M5 4h14v16H5V4Zm0 5h14M9 2v4m6-4v4m-6 8h3v3',
  clothing: 'M9 4a3 3 0 0 0 6 0l5 2 2 5-4 2v7H6v-7l-4-2 2-5 5-2Z',
  scan: 'M6 11V4h12v7m-14 0h16v7H4v-7Zm3 4h10m-9 3v2h8v-2',
  interview: 'M4 8h13v12H4V8Zm3-3h13v12m-13-1 3-3 3 3m-1-5h.01',
  child: 'M20 13a8 8 0 1 1-8-8h1a2 2 0 0 1 0 4m-4 4h.01m6 0h.01M10 16a2 2 0 0 0 4 0',
  signature: 'm5 15 10-10 4 4L9 19H5v-4Zm8-8 4 4M4 22h16',
}

export function RequirementsBody({ doc }) {
  const { lang } = useLang()
  const copy = photoCopy[lang]
  const { intro, sources: [primary, ...documents], items, basis, edition, standards } = requirements[doc]
  return (
    <div>
      <p className="text-sm text-text-muted">{intro[lang]}</p>
      <ul className="my-3 grid gap-2 sm:grid-cols-3">
        {items.map(item => (
          <li key={item.id} className="rounded-lg border border-grid-border bg-paper p-3">
            <div className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-emerald-accent"><path d={symbols[item.id]} /></svg>
              <h3 className="text-sm">{item.title[lang]}</h3>
            </div>
            <p className="mt-1 text-sm font-semibold">{item.summary[lang]}</p>
            <p className="mt-1 text-sm text-text-muted">{item.detail[lang]}</p>
          </li>
        ))}
      </ul>
      <p className="py-2 text-sm">
        <span>{copy.source}</span>{' '}<SourceLink source={primary} lang={lang} />
      </p>
      {documents.length > 0 && (
        <details key={doc} className="my-1 rounded-lg border border-grid-border px-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">{copy.officialDocuments}</summary>
          <ul className="mb-3 list-disc space-y-2 pl-5">
            {documents.map(source => (
              <li key={source.url}><SourceLink source={source} lang={lang} /></li>
            ))}
          </ul>
        </details>
      )}
      {basis && <p className="mt-2 text-sm text-text-muted">{copy.legalBasis} {basis[lang]}</p>}
      <p className="mt-1 text-sm text-text-muted">{edition?.[lang] ?? copy.checkSource}</p>
      {standards && <p className="mt-1 text-sm text-text-muted">{standards[lang]}</p>}
    </div>
  )
}

function Icon({ d, className = 'size-5 shrink-0', width = 1.8 }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" className={className}><path d={d} /></svg>
  )
}

const paths = {
  photo: 'M3 7h3l2-3h8l2 3h3v13H3V7Zm9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  upload: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5',
  shield: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  external: 'M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
  list: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01',
  close: 'M6 18 18 6M6 6l12 12',
}

// Synthetic portrait drawn on a canvas: no file, no network, no real person.
function makeDemoPhoto() {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1100
  const g = canvas.getContext('2d')
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 900, 1100)
  g.fillStyle = '#2f3b4a'; g.beginPath(); g.ellipse(450, 1120, 380, 300, 0, Math.PI, 0); g.fill()
  g.fillStyle = '#c99774'; g.fillRect(395, 640, 110, 190)
  g.fillStyle = '#3b2a20'; g.beginPath(); g.ellipse(450, 430, 205, 245, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#d9a982'; g.beginPath(); g.ellipse(450, 470, 175, 225, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#3b2a20'; g.beginPath(); g.ellipse(450, 290, 190, 90, 0, Math.PI, 0); g.fill()
  for (const x of [380, 520]) {
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, 450, 30, 16, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(x, 450, 11, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#3b2a20'; g.lineWidth = 8; g.beginPath(); g.moveTo(x - 36, 410); g.lineTo(x + 36, 408); g.stroke()
  }
  g.strokeStyle = '#a8734f'; g.lineWidth = 6; g.beginPath(); g.moveTo(450, 460); g.lineTo(440, 540); g.lineTo(462, 545); g.stroke()
  g.strokeStyle = '#8c4a42'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(405, 610); g.lineTo(495, 610); g.stroke()
  return new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], 'test-photo.png', { type: 'image/png' })), 'image/png'))
}

function RequirementsDialog({ doc, open, onClose, page }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={event => { if (event.target === ref.current) onClose() }}
      aria-labelledby="requirements-dialog-title"
      className="m-auto max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-grid-border bg-white p-0 backdrop:bg-black/40">
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="requirements-dialog-title" className="text-lg">{page.requirementsTitle}: {page.docs[doc].pill}</h2>
          <button type="button" aria-label={page.close} onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-grid-border hover:border-emerald-accent">
            <Icon d={paths.close} />
          </button>
        </div>
        <div className="mt-3">{open && <RequirementsBody doc={doc} />}</div>
      </div>
    </dialog>
  )
}

export default function PhotoUpload({ presetId, onDocument, onFile, onCamera, cameraAvailable, heading, picker }) {
  const { lang, t } = useLang()
  const copy = photoCopy[lang]
  const page = photoPageCopy[lang]
  const doc = page.docs[presetId]
  const input = useRef(null)
  const tips = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const sources = requirements[presetId].sources
  const showTips = () => {
    setTipsOpen(true)
    requestAnimationFrame(() => tips.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }
  const accordion = 'group rounded-2xl border border-grid-border bg-white px-4 sm:px-5'
  const summary = 'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden after:text-xl after:font-normal after:text-text-muted after:content-["+"] group-open:after:content-["–"]'
  return (
    <>
      <div className="border-b border-grid-border bg-white">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-accent text-white"><Icon d={paths.photo} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-base font-bold">{page.pageTitle}</p>
                <span className="rounded-full border border-emerald-accent/25 bg-emerald-accent/5 px-2 py-0.5 text-[11px] font-semibold text-emerald-accent">{doc.badge}</span>
              </div>
              <p className="hidden text-xs text-text-muted sm:block">{doc.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={() => setRulesOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-grid-border bg-white px-3 text-sm font-semibold hover:border-emerald-accent hover:text-emerald-accent">
            <Icon d={paths.list} className="size-4" /> {page.requirementsButton}
          </button>
        </div>
      </div>
      <RequirementsDialog doc={presetId} open={rulesOpen} onClose={() => setRulesOpen(false)} page={page} />

      <div className="mx-auto max-w-[1040px] space-y-5 px-4 pt-4 pb-10 sm:px-6 sm:pt-8">
        <div className="text-center">
          <fieldset className="mx-auto mb-3 inline-block min-w-0 max-w-full sm:mb-4">
            <legend className="sr-only">{copy.document}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-grid-border">
              {presetList.map(preset => (
                <label key={preset.id} className="flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3 text-center text-sm font-semibold has-checked:bg-emerald-accent has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-emerald-accent sm:px-5">
                  <input type="radio" name="upload-document" value={preset.id} checked={presetId === preset.id}
                    onChange={() => onDocument(preset.id)} className="sr-only" />
                  {page.docs[preset.id].pill}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mx-auto mb-3 flex w-fit max-w-full items-center gap-1.5 rounded-full border border-emerald-accent/25 bg-emerald-accent/5 px-3 py-1 text-xs font-semibold text-emerald-accent">
            <Icon d={paths.shield} className="size-3.5 shrink-0" width={2.2} /> {page.trust}
          </p>
          <h1 ref={heading} tabIndex={-1} className="text-2xl leading-tight tracking-tight focus:outline-none sm:text-3xl">{doc.h1}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-text-muted sm:text-base">{doc.lead}</p>
        </div>

        <div onDragOver={event => { event.preventDefault(); setDragging(true) }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }}
          onDrop={event => {
            event.preventDefault()
            setDragging(false)
            onFile(event.dataTransfer.files?.[0], picker.current)
          }}
          className={'mx-auto max-w-[960px] rounded-2xl border-2 border-dashed bg-white px-4 py-4 text-center transition-colors hover:border-emerald-accent sm:px-8 sm:py-10 ' +
            (dragging ? 'border-emerald-accent bg-emerald-accent/5' : 'border-grid-border')}>
          <input ref={input} type="file" aria-label={t.choosePhotoLabel} accept={photoMimeTypes.join(',')} hidden
            onChange={event => { onFile(event.target.files?.[0], picker.current); event.target.value = '' }} />
          <span className="mx-auto mb-3 hidden size-14 items-center justify-center rounded-2xl bg-emerald-accent/10 text-emerald-accent sm:flex"><Icon d={paths.upload} className="size-7" /></span>
          <h2 className="text-base sm:text-lg">{page.uploadTitle}</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted sm:text-sm">{page.uploadText}</p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button type="button" ref={picker} className={primaryButton + ' min-h-11 px-5 sm:min-h-12'} onClick={() => input.current.click()}>{t.btnChooseFile}</button>
            {cameraAvailable && <button type="button" className={secondaryButton + ' min-h-11 px-5 sm:min-h-12'} onClick={event => onCamera(event.currentTarget)}>{t.btnShootCamera}</button>}
          </div>
          <p className="mt-3 text-xs font-medium text-emerald-accent">{releaseCopy[lang].privacyShort}</p>
          <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-grid-border pt-4 text-xs">
            <button type="button" className="inline-flex min-h-11 items-center font-semibold text-emerald-accent underline underline-offset-4"
              onClick={async () => onFile(await makeDemoPhoto(), picker.current, { demo: true })}>{page.tryDemo}</button>
            <button type="button" className="inline-flex min-h-11 items-center font-semibold text-text-muted underline underline-offset-4 hover:text-emerald-accent"
              onClick={showTips}>{page.howTo}</button>
          </div>
        </div>

        <ul className="mx-auto grid max-w-[960px] gap-3 sm:grid-cols-3">
          {doc.cards.map(([title, text], index) => (
            <li key={title} className="rounded-2xl border border-grid-border bg-white p-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-accent/10 text-xs font-bold text-emerald-accent">{index + 1}</span>
              <h3 className="mt-2 text-sm">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{text}</p>
            </li>
          ))}
        </ul>

        <div className="mx-auto max-w-[960px] space-y-2">
          <details id="photo-all-requirements" className={accordion}>
            <summary className={summary}>{page.allRequirements}</summary>
            <div className="pb-4"><RequirementsBody doc={presetId} /></div>
          </details>
          <details id="photo-examples" ref={tips} open={tipsOpen} onToggle={event => setTipsOpen(event.currentTarget.open)} className={accordion}>
            <summary className={summary}>{page.howTo}</summary>
            <ul className="grid gap-3 pb-4 sm:grid-cols-3">
              {t.howToShootTips.slice(0, 3).map(tip => (
                <li key={tip.icon} className="rounded-lg border border-grid-border bg-paper p-3">
                  <h3 className="text-sm">{tip.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{tip.desc}</p>
                </li>
              ))}
            </ul>
          </details>
          <details id="photo-faq" className={accordion}>
            <summary className={summary}>{copy.faq}</summary>
            <div className="divide-y divide-grid-border pb-2">
              {doc.faq.map(([question, answer]) => (
                <div key={question} className="py-3">
                  <h3 className="text-sm">{question}</h3>
                  <p className="mt-1 text-sm text-text-muted">{answer}</p>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="mx-auto max-w-[960px] border-t border-grid-border pt-4 text-xs text-text-muted">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <p className="font-semibold text-text-main">{page.normativeBase} {doc.base}</p>
            <p>{page.localCompute}</p>
          </div>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
            <li>{page.officialSources}</li>
            {sources.map(source => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 font-semibold text-emerald-accent hover:underline">
                  {source.label[lang]} <Icon d={paths.external} className="size-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">{releaseCopy[lang].unofficial}</p>
        </div>
      </div>
    </>
  )
}
