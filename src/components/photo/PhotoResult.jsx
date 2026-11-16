import { lazy, Suspense, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { photoCopy } from '../../content/photo-copy'
import { presets } from '../../presets'
import { primaryButton, secondaryButton } from '../editor/EditorControls'
import PhotoCanvas from './PhotoCanvas'
import { Slider } from './PhotoSettings'

const PhotoBrush = lazy(() => import('./PhotoBrush'))
const selfChecks = [
  ['verifyGlasses'], ['verifyHeadwear'], ['verifyClothing'],
  ['verifyMouth', 'mouth'], ['verifyEyes', 'eyes'], ['verifyTilt', 'tilt'], ['verifyAge'],
]

function CheckList({ checks, lang, t, preset }) {
  return (
    <ul className="divide-y divide-grid-border">
      {checks.filter(check => check.observed !== false).map(check => {
        const guide = check.id === 'headProportion'
        const ok = guide ? check.params?.pct >= preset.headMinPct && check.params?.pct <= preset.headMaxPct : check.ok
        return (
          <li key={check.id} className="flex items-start justify-between gap-2 py-2.5 text-sm">
            <span>{check.message?.[lang] ?? t[check.key]}</span>
            <span className={'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ' +
              (ok ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950')}>
              {ok ? t.checkStatusOk : t.checkStatusWarn}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function SelfCheck({ checks, copy }) {
  return (
    <section className="mt-4 border-t border-grid-border pt-3" aria-labelledby="photo-self-check">
      <h3 id="photo-self-check" className="mb-2 text-sm">{copy.selfCheck}</h3>
      <ul className="space-y-2 text-sm">
        {selfChecks.map(([key, id]) => {
          const check = id && checks.find(item => item.id === id)
          const passed = check?.ok && check.observed !== false
          return (
            <li key={key} className="flex items-start gap-2">
              <span aria-hidden="true" className={passed ? 'text-emerald-accent' : 'text-text-muted'}>
                {passed ? '✓' : '•'}
              </span>
              <span>{copy[key]}{passed && <span className="sr-only"> {copy.automaticCheck}</span>}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function PhotoResult({ result, source, heading, onSettings, onProcess, onReset, status }) {
  const { lang, t } = useLang()
  const copy = photoCopy[lang]
  const { settings } = result
  const preset = presets[settings.presetId]
  const [url, setUrl] = useState(null)
  const [before, setBefore] = useState(false)
  const [brush, setBrush] = useState(false)
  const [frame, setFrame] = useState(null)
  const adjusted = frame?.settings === settings ? frame : settings

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [heading])

  useEffect(() => {
    const objectUrl = URL.createObjectURL(result.blob)
    setUrl({ blob: result.blob, href: objectUrl })
    return () => URL.revokeObjectURL(objectUrl)
  }, [result.blob])

  const href = url?.blob === result.blob ? url.href : null
  const corrections = [
    result.tiltCorrected && copy.tiltApplied,
    result.lightCorrected && copy.exposureApplied,
    result.backgroundChanged && copy.backgroundApplied,
  ].filter(Boolean)
  const sizing = copy.sizing.replace('{width}', preset.width).replace('{height}', preset.height)
    .replace('{size}', result.sizeKb).replace('{limit}', preset.maxKb)
  const processFrame = (strokes = settings.strokes) => {
    setBrush(false)
    onProcess({ ...settings, scaleOffset: adjusted.scaleOffset, offsetY: adjusted.offsetY, strokes })
  }
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 sm:py-12">
      <h1 ref={heading} tabIndex={-1} className="text-2xl tracking-tight focus:outline-none sm:text-4xl">{t.step5Title}</h1>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-grid-border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">{preset.name[lang]}</h2>
            <button type="button" aria-pressed={before} className={secondaryButton} onClick={() => setBefore(!before)}>{copy.compare}</button>
          </div>
          <div className="my-3 grid min-h-52 place-items-center rounded-lg bg-paper p-3">
            {before ? (
              <PhotoCanvas bitmap={source.bitmap} label={t.editor.original} className="block h-auto max-h-96 w-auto max-w-full rounded-sm" />
            ) : href && (
              <img src={href} alt={copy.readyImage} width={preset.width} height={preset.height}
                className="block h-auto max-h-96 w-auto max-w-full rounded-sm" />
            )}
          </div>
          <p className="font-mono text-xs font-semibold text-text-muted">{sizing}</p>
          <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
            {href && <a href={href} download={preset.id + '.jpg'} className={primaryButton + ' inline-flex items-center justify-center'}>{copy.download}</a>}
            <button type="button" className={secondaryButton} onClick={event => onSettings(event.currentTarget)}>{copy.editSettings}</button>
            <button type="button" className={secondaryButton} onClick={event => onSettings(event.currentTarget, true)}>{t.btnOtherDoc}</button>
            <button type="button" className={secondaryButton} onClick={onReset}>{t.btnNewPhoto}</button>
          </div>
        </section>
        <section className="min-w-0 rounded-xl border border-grid-border bg-white p-4 sm:p-5">
          <h2 className="mb-2 text-base">{t.checksTitle}</h2>
          <CheckList checks={result.checks} lang={lang} t={t} preset={preset} />
          {preset.id === 'kz_id' && <SelfCheck checks={result.checks} copy={copy} />}
          {corrections.length > 0 && (
            <>
              <h3 className="mt-3 text-sm">{copy.corrections}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {corrections.map(text => <li key={text} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-950">{text}</li>)}
              </ul>
            </>
          )}
        </section>
      </div>
      <details className="rounded-xl border border-grid-border bg-white px-4 sm:px-5">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{copy.framing}</summary>
        <div className="space-y-3 pb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries({ scaleOffset: t.adjustScale, offsetY: t.adjustShiftY }).map(([key, text]) => (
              <Slider key={key} label={text} min={-10} max={10} value={Math.round(adjusted[key] * 100)}
                onChange={value => setFrame({ scaleOffset: adjusted.scaleOffset, offsetY: adjusted.offsetY, settings, [key]: value / 100 })} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} onClick={() => processFrame()} disabled={Boolean(status) ||
              (adjusted.scaleOffset === settings.scaleOffset && adjusted.offsetY === settings.offsetY)}>{copy.applyFraming}</button>
            {result.backgroundChanged && (
              <button type="button" className={secondaryButton} aria-expanded={brush} onClick={() => setBrush(!brush)}>
                {brush ? t.editor.brushDone : copy.refineBackground}
              </button>
            )}
          </div>
          {brush && (
            <Suspense fallback={<p role="status">{t.editor.processing}</p>}>
              <PhotoBrush source={source} settings={settings} copy={copy} text={t.editor}
                onClose={() => setBrush(false)} onApply={processFrame} busy={Boolean(status)} />
            </Suspense>
          )}
        </div>
      </details>
    </div>
  )
}
