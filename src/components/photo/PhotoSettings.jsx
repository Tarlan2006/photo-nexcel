import { useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { photoCopy } from '../../content/photo-copy'
import { presets } from '../../presets'
import { backgroundChoices, toPhotoParameters } from '../../lib/photo-flow'
import { photoMimeTypes } from '../../lib/photo'
import { primaryButton, secondaryButton } from '../editor/EditorControls'
import { SuitPanel } from '../editor/EditorPanels'
import { DocumentPicker } from './PhotoUpload'
import PhotoCanvas from './PhotoCanvas'

export function Slider({ label, min = -30, max = 30, value, onChange }) {
  return (
    <label className="block min-w-0 text-sm font-medium">
      {label} <span aria-hidden="true" className="ml-1 font-mono text-xs text-text-muted">{value}</span>
      <input type="range" min={min} max={max} value={value} onChange={event => onChange(event.currentTarget.valueAsNumber)}
        className="block min-h-11 w-full accent-emerald-accent" />
    </label>
  )
}

export function photoMessage(t, copy, key, preset) {
  if (!key) return ''
  const label = key === 'modelError' || key === 'unreliableMask' ? copy.backgroundError : copy[key] ?? t[key] ?? t.editor[key] ?? copy.processingError
  return label.replace('{max}', preset.maxKb)
}

export default function PhotoSettings({ source, settings, status, error, chooseDocument, onDocument, onSettings, onFile, onProcess, onClose, returnFocus }) {
  const { lang, t } = useLang()
  const copy = photoCopy[lang]
  const dialog = useRef(null)
  const close = useRef(null)
  const file = useRef(null)
  const documentButton = useRef(null)
  const [documentOpen, setDocumentOpen] = useState(chooseDocument)
  const preset = presets[settings.presetId]
  const dv = preset.id === 'dv'
  const busy = Boolean(status)
  const set = patch => onSettings({ ...settings, ...patch })
  useLayoutEffect(() => {
    const node = dialog.current
    node.showModal()
    close.current?.focus({ preventScroll: true })
    return () => {
      node.close()
      queueMicrotask(() => {
        if (!node.open && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
      })
    }
  }, [returnFocus])

  function backdrop(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom)
  }
  const pressedOutside = useRef(false)

  return (
    <dialog ref={dialog} aria-modal="true" aria-labelledby="photo-settings-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onPointerDown={event => { pressedOutside.current = backdrop(event) }}
      onClick={event => { if (pressedOutside.current && backdrop(event)) onClose() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const fields = [...event.currentTarget.querySelectorAll('button:enabled, input:enabled, select:enabled, summary')]
          .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
        const next = event.shiftKey && document.activeElement === fields[0]
          ? fields.at(-1)
          : !event.shiftKey && document.activeElement === fields.at(-1) ? fields[0] : null
        if (next) {
          event.preventDefault()
          next.focus()
        }
      }}
      className="fixed inset-x-0 bottom-0 top-auto mx-auto my-0 max-h-[96dvh] w-full max-w-none overscroll-contain rounded-t-2xl bg-white text-text-main shadow-xl backdrop:bg-black/65 sm:inset-0 sm:m-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:rounded-2xl">
      <form onSubmit={event => { event.preventDefault(); onProcess(settings) }} className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-grid-border pb-3">
          <h2 id="photo-settings-title" className="text-xl">{copy.settings}</h2>
          <button ref={close} type="button" aria-label={t.cameraClose} className={secondaryButton} onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p role="status" aria-live="polite" className={status ? 'mb-3 text-sm font-medium text-emerald-accent' : 'sr-only'}>
          {photoMessage(t, copy, status, preset)}
        </p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{photoMessage(t, copy, error, preset)}</p>}
        <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="min-w-0 space-y-2">
            {source && <PhotoCanvas bitmap={source.bitmap} label={t.editor.original}
              className="mx-auto block h-auto max-h-48 w-auto max-w-full rounded-lg sm:max-h-72" />}
            <input ref={file} type="file" hidden accept={photoMimeTypes.join(',')} aria-label={copy.changePhoto}
              onChange={event => { onFile(event.target.files?.[0]); event.target.value = '' }} />
            <button type="button" className={secondaryButton + ' w-full'} onClick={() => file.current.click()}>{copy.changePhoto}</button>
          </div>
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grid-border bg-paper p-3">
              <div>
                <p className="text-xs font-semibold text-text-muted">{copy.document}</p>
                <p className="text-sm font-bold">{preset.name[lang]}</p>
              </div>
              <button ref={documentButton} type="button" className={secondaryButton} aria-expanded={documentOpen} onClick={() => setDocumentOpen(!documentOpen)}>{copy.changeDocument}</button>
            </div>
            {documentOpen && <DocumentPicker name="settings-document" value={preset.id} onChange={id => {
              onDocument(id)
              setDocumentOpen(false)
              documentButton.current?.focus()
            }} />}
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-bold">{copy.background}</legend>
              <div className="grid grid-cols-2 gap-2">
                {backgroundChoices(preset.id).map(choice => {
                  const isWide = choice === 'recommended' || choice === 'original'
                  const color = toPhotoParameters({ ...settings, background: choice }).edit.bg.color
                  return (
                    <label key={choice} className={'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-grid-border p-2 text-sm font-medium has-checked:border-emerald-accent has-checked:bg-emerald-accent/5' + (isWide ? ' col-span-2' : '')}>
                      <input type="radio" name="photo-background" checked={settings.background === choice} value={choice}
                        onChange={() => set({ background: choice })} className="size-4 shrink-0 accent-emerald-accent" />
                      {choice !== 'original' && <span aria-hidden="true" className="size-4 shrink-0 rounded border border-grid-border" style={{ backgroundColor: color }} />}
                      <span>{copy[choice] ?? t.editor[choice === 'custom' ? 'customColor' : choice]}</span>
                    </label>
                  )
                })}
              </div>
              {settings.background === 'custom' && (
                <label className="mt-2 flex min-h-11 items-center justify-between gap-2 text-sm font-medium">
                  {t.editor.customColor}
                  <input type="color" value={settings.customColor} onChange={event => set({ customColor: event.target.value })}
                    className="h-11 w-16 cursor-pointer" />
                </label>
              )}
              {dv && <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-950">{copy.dvBackground}</p>}
            </fieldset>
            <div className="divide-y divide-grid-border border-y border-grid-border">
              {['fixTilt', 'autoExposure'].map(key => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2 text-sm font-semibold">
                  {copy[key]}
                  <input type="checkbox" role="switch" checked={settings[key]} onChange={event => set({ [key]: event.target.checked })}
                    className="size-5 shrink-0 accent-emerald-accent" />
                </label>
              ))}
            </div>
            <details className="rounded-lg border border-grid-border px-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">{copy.advanced}</summary>
              <div className="space-y-3 pb-3">
                {['brightness', 'contrast'].map(key => (
                  <Slider key={key} label={t.editor[key]} value={settings[key]} onChange={value => set({ [key]: value })} />
                ))}
                <label className="block text-sm font-medium" htmlFor="photo-filter">{t.editor.filters}</label>
                <select id="photo-filter" value={settings.filter} onChange={event => set({ filter: event.target.value })}
                  className="min-h-11 w-full rounded-lg border border-grid-border bg-white p-2 text-sm">
                  {['none', 'soft', 'sharp'].map(key => <option key={key} value={key}>{t.editor[key]}</option>)}
                </select>
                <div className="border-t border-grid-border pt-3">
                  <h3 className="mb-2 text-sm">{t.editor.suit}</h3>
                  <SuitPanel suit={settings.suit} segmentation={{}} text={t.editor}
                    update={apply => set({ suit: apply({ suit: settings.suit }).suit })} />
                </div>
                {dv && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{copy.dvWarning}</p>}
              </div>
            </details>
          </fieldset>
        </div>
        <button type="submit" className={primaryButton + ' mt-5 w-full'} disabled={!source || busy}>{copy.process}</button>
        <p className="mt-2 text-center text-xs text-text-muted">{copy.privacy}</p>
      </form>
    </dialog>
  )
}
