import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { hasClosedArea, hasPhotoEdits } from '../lib/editor/edit-state'
import { initialView } from '../lib/editor/viewport'
import { runPhotoChecks } from '../lib/checks'
import { presets } from '../presets'
import EditorPreview from './editor/EditorPreview'
import { BrushControls, OutlineControls, PreviewControls, primaryButton, secondaryButton } from './editor/EditorControls'
import { BackgroundPanel, FiltersPanel, SuitPanel, TonePanel } from './editor/EditorPanels'

const stages = ['background', 'tone', 'filters', 'suit']

export default function Step2Editor() {
  const { t: { editor: text } } = useLang()
  const {
    originalImage, edit, editHistory, editorBusy, editorError, segmentation, cropStates, outlineDraft, canApplyEditor,
    getEditorSession, ensureSegmentation, updateEditor, setOutlineDraft, undoEditor, redoEditor, resetEditor, finishEditor,
  } = useWizard()
  const [stage, setStage] = useState(stages[0])
  const [showMask, setShowMask] = useState(false)
  const [brush, setBrush] = useState(null)
  const [compare, setCompare] = useState({ holding: false, split: false, splitPosition: 50 })
  const title = useRef(null)
  const workspace = useRef(null)
  const stageButtons = useRef({})
  const stageBody = useRef(null)
  const drawButton = useRef(null)
  const brushButton = useRef(null)
  const needsModel = (edit.bg.enabled && edit.bg.method === 'auto') || edit.suit.enabled
  const canBrush = stage === 'background' && edit.bg.enabled && edit.bg.method === 'auto' &&
    Boolean(segmentation.result?.reliable) && !outlineDraft && !editorBusy
  const activeBrush = canBrush ? brush : null
  const drawing = Boolean(outlineDraft)
  const brushing = Boolean(activeBrush)
  const stageIndex = stages.indexOf(stage)
  const lastStage = stageIndex === stages.length - 1
  const initialCrop = cropStates.kz_id

  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [])
  useLayoutEffect(() => {
    const element = workspace.current
    const bottomBar = document.getElementById('wizard-bottom-bar')
    const measure = () => {
      const bottom = bottomBar?.getBoundingClientRect().top ?? window.innerHeight
      const top = element.getBoundingClientRect().top + window.scrollY
      element.style.setProperty('--editor-room', Math.max(340, Math.floor(bottom - top - 8)) + 'px')
    }
    const observer = new ResizeObserver(measure)
    observer.observe(title.current.parentElement)
    if (bottomBar) observer.observe(bottomBar)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])
  useEffect(() => {
    if (needsModel && segmentation.status === 'idle') ensureSegmentation()
  }, [needsModel, segmentation.status, ensureSegmentation])
  useEffect(() => {
    if (!canBrush) setBrush(null)
  }, [canBrush])
  useLayoutEffect(() => {
    if (stageBody.current) stageBody.current.scrollTop = 0
  }, [stage, drawing, brushing])

  const originalBackgroundWarning = useMemo(() => {
    if (!initialCrop?.success) return false
    const { bitmap, landmarks, blendshapes } = originalImage
    return runPhotoChecks(initialCrop.canvas, landmarks, bitmap.width, bitmap.height, presets.kz_id, initialCrop.headPct, blendshapes)
      .some((check) => check.id === 'background' && !check.ok)
  }, [originalImage, initialCrop])

  const previewEdit = useMemo(() => {
    const activeBackground = edit.bg.enabled && (edit.bg.method === 'manual'
      ? hasClosedArea(edit.bg.outline)
      : segmentation.result?.reliable)
    return {
      ...edit,
      bg: activeBackground ? edit.bg : { ...edit.bg, enabled: false },
      suit: edit.suit.enabled && segmentation.result?.suitSupported ? edit.suit : { ...edit.suit, enabled: false },
    }
  }, [edit, segmentation.result])

  const changeCompare = (patch) => setCompare(current => ({ ...current, ...patch }))
  const changeBrush = useCallback((patch) => setBrush(current => current && { ...current, ...patch }), [])
  const changeView = useCallback((view) => changeBrush({ view }), [changeBrush])

  const focusControl = (target) => {
    requestAnimationFrame(() => (target.current ?? stageButtons.current.background)?.focus())
  }

  const selectStage = (nextStage) => {
    setStage(nextStage)
    setBrush(null)
    setOutlineDraft(null)
    setShowMask(false)
    changeCompare({ holding: false })
    stageButtons.current[nextStage]?.focus({ preventScroll: true })
  }

  const closeOutline = () => {
    setOutlineDraft(null)
    focusControl(drawButton)
  }

  const applyOutline = () => {
    if (!outlineDraft || !hasClosedArea(outlineDraft.points)) return
    updateEditor((current) => ({
      ...current,
      bg: { ...current.bg, enabled: true, method: 'manual', outline: outlineDraft.points },
    }))
    setShowMask(false)
    closeOutline()
  }

  const reset = () => {
    setShowMask(false)
    setOutlineDraft(null)
    setBrush(null)
    changeCompare({ holding: false, split: false })
    resetEditor()
  }

  const closeBrush = () => {
    setBrush(null)
    focusControl(brushButton)
  }

  const commitStroke = (stroke) => {
    const saved = { ...stroke, id: crypto.randomUUID() }
    updateEditor((current) => ({
      ...current,
      bg: { ...current.bg, strokes: [...current.bg.strokes, saved] },
    }))
  }

  const brushTool = activeBrush && {
    ...activeBrush,
    onChange: changeBrush,
    onViewChange: changeView,
    onStroke: commitStroke,
    onClose: closeBrush,
    onUndo: undoEditor,
    onRedo: redoEditor,
    canUndo: Boolean(editHistory.past.length),
    canRedo: Boolean(editHistory.future.length),
  }

  const panel = (
    <>
      {drawing ? (
        <OutlineControls draft={outlineDraft} setDraft={setOutlineDraft} applyOutline={applyOutline} cancelOutline={closeOutline} text={text} />
      ) : brushing ? (
        <BrushControls brush={brushTool} text={text} />
      ) : (
        <>
          {stage === 'background' && (
            <BackgroundPanel
              bg={edit.bg}
              update={updateEditor}
              startOutline={() => {
                changeCompare({ holding: false })
                setOutlineDraft({ points: [], cursor: null })
              }}
              drawButton={drawButton}
              showMask={showMask}
              setShowMask={setShowMask}
              brushAvailable={canBrush}
              brushButton={brushButton}
              startBrush={() => {
                changeCompare({ holding: false })
                setBrush({ mode: 'erase', size: 4, original: false, pan: false, view: initialView })
              }}
              segmentation={segmentation}
              originalBackgroundWarning={originalBackgroundWarning}
              text={text}
            />
          )}
          {stage === 'tone' && <TonePanel edit={edit} update={updateEditor} getSession={getEditorSession} text={text} />}
          {stage === 'filters' && <FiltersPanel filter={edit.filter} update={updateEditor} text={text} />}
          {stage === 'suit' && <SuitPanel suit={edit.suit} update={updateEditor} segmentation={segmentation} text={text} />}

          <PreviewControls compare={compare} changeCompare={changeCompare} disabled={!hasPhotoEdits(previewEdit) || showMask} text={text} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} disabled={!editHistory.past.length} onClick={undoEditor}>{text.undo}</button>
            <button type="button" className={secondaryButton} disabled={!editHistory.future.length} onClick={redoEditor}>{text.redo}</button>
            <button type="button" className={secondaryButton} onClick={reset}>{text.reset}</button>
            <button type="button" className={secondaryButton} onClick={() => finishEditor(true)}>{text.skip}</button>
          </div>
        </>
      )}

      {needsModel && segmentation.status === 'loading' && (
        <div role="status" className="rounded-lg border border-grid-border bg-white p-2 text-sm text-text-muted">
          <p>{text.modelLoading}</p>
          <progress aria-label={text.modelLoading} className="mt-2 block w-full accent-emerald-accent" />
        </div>
      )}
      {needsModel && segmentation.status === 'error' && (
        <div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950">
          <p role="alert">{text.modelError}</p>
          <button type="button" className={secondaryButton + ' mt-2'} onClick={ensureSegmentation}>{text.retry}</button>
        </div>
      )}
      {editorBusy && <p role="status" className="text-sm text-text-muted">{text.processing}</p>}
      {editorError && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950">{text[editorError]}</p>}
    </>
  )

  return (
    <div className="mx-auto max-w-6xl px-2 py-4 sm:px-6 sm:py-6">
      <div className="mb-3 text-center sm:mb-5">
        <h1 ref={title} tabIndex={-1} className="text-xl font-extrabold tracking-tight sm:text-3xl">{text.title}</h1>
        <p className="mx-auto mt-1 hidden max-w-xl text-sm text-text-muted sm:block">{text.subtitle}</p>
      </div>

      <div ref={workspace} className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start gap-2 sm:gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="sticky top-[4.5rem] min-w-0">
          <EditorPreview
            original={originalImage.bitmap}
            edit={previewEdit}
            getSession={getEditorSession}
            showMask={showMask && previewEdit.bg.enabled}
            draft={outlineDraft}
            setDraft={setOutlineDraft}
            cancelOutline={closeOutline}
            brush={brushTool}
            compare={compare}
            text={text}
          />
        </div>

        <fieldset disabled={editorBusy} className="min-w-0 rounded-xl border border-grid-border bg-white">
          <legend className="sr-only">{text.tools}</legend>
          <div
            className="flex max-h-[var(--editor-room)] min-w-0 flex-col"
            role={brushing ? 'group' : undefined}
            aria-label={brushing ? text.brush : undefined}
          >
            {stages.map(key => {
              const expanded = key === stage
              const headingId = `editor-heading-${key}`
              const panelId = `editor-panel-${key}`
              return (
                <Fragment key={key}>
                  <h2 className="shrink-0 border-t border-grid-border first:border-t-0">
                    <button
                      ref={element => { stageButtons.current[key] = element }}
                      id={headingId}
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => selectStage(expanded ? null : key)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold leading-tight hover:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-accent sm:px-4"
                    >
                      <span aria-hidden="true" className={'shrink-0 text-[0.625rem] ' + (expanded ? 'rotate-90' : '')}>▶</span>
                      {text[key]}
                    </button>
                  </h2>
                  <div
                    id={panelId}
                    ref={expanded ? stageBody : undefined}
                    role="region"
                    aria-labelledby={headingId}
                    hidden={!expanded}
                    tabIndex={expanded ? 0 : undefined}
                    className="min-h-0 space-y-3 overflow-y-auto overscroll-contain border-t border-grid-border p-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-accent sm:p-4"
                  >
                    {expanded && panel}
                  </div>
                </Fragment>
              )
            })}
            {brushing ? (
              <div className="shrink-0 border-t border-grid-border p-2 sm:p-3">
                <button type="button" className={primaryButton} onClick={closeBrush}>{text.brushDone}</button>
              </div>
            ) : stage && !drawing && (
              <div className="flex shrink-0 flex-wrap justify-between gap-1 border-t border-grid-border p-2 sm:gap-2 sm:p-3" role="group" aria-label={text.stagePicker}>
                {stageIndex > 0 && (
                  <button type="button" className={secondaryButton} onClick={() => selectStage(stages[stageIndex - 1])}>{text.previousStage}</button>
                )}
                <button
                  type="button"
                  className={primaryButton}
                  disabled={lastStage && !canApplyEditor}
                  onClick={() => lastStage ? finishEditor() : selectStage(stages[stageIndex + 1])}
                >
                  {text.stageDone}
                </button>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
