import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { useWizard } from '../contexts/WizardContext'
import { hasClosedArea } from '../lib/editor/edit-state'
import { runPhotoChecks } from '../lib/checks'
import { presets } from '../presets'
import EditorPreview, { secondaryButton } from './editor/EditorPreview'
import { BackgroundPanel, FiltersPanel, SuitPanel, TonePanel } from './editor/EditorPanels'

export default function Step2Editor() {
  const { t: { editor: text } } = useLang()
  const {
    originalImage, edit, editHistory, editorBusy, editorError, segmentation, cropStates, outlineDraft,
    getEditorSession, ensureSegmentation, updateEditor, setOutlineDraft, undoEditor, redoEditor, resetEditor, finishEditor,
  } = useWizard()
  const [showMask, setShowMask] = useState(false)
  const title = useRef(null)
  const drawButton = useRef(null)
  const needsModel = (edit.bg.enabled && edit.bg.method === 'auto') || edit.suit.enabled
  const initialCrop = cropStates.kz_id

  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (needsModel && segmentation.status === 'idle') ensureSegmentation()
  }, [needsModel, segmentation.status, ensureSegmentation])

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

  const closeOutline = () => {
    setOutlineDraft(null)
    drawButton.current?.focus({ preventScroll: true })
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
    resetEditor()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 text-center">
        <h1 ref={title} tabIndex={-1} className="text-2xl font-extrabold tracking-tight sm:text-3xl">{text.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted sm:text-base">{text.subtitle}</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <EditorPreview
          original={originalImage.bitmap}
          edit={previewEdit}
          getSession={getEditorSession}
          showMask={showMask && previewEdit.bg.enabled}
          draft={outlineDraft}
          setDraft={setOutlineDraft}
          applyOutline={applyOutline}
          cancelOutline={closeOutline}
          text={text}
        />

        <fieldset disabled={editorBusy} className="min-w-0 space-y-3">
          <legend className="sr-only">{text.tools}</legend>
          <BackgroundPanel
            bg={edit.bg}
            update={updateEditor}
            startOutline={() => setOutlineDraft((draft) => draft ?? { points: [], cursor: null })}
            drawButton={drawButton}
            draft={outlineDraft}
            showMask={showMask}
            setShowMask={setShowMask}
            segmentation={segmentation}
            originalBackgroundWarning={originalBackgroundWarning}
            text={text}
          />
          {needsModel && segmentation.status === 'loading' && (
            <div role="status" className="rounded-lg border border-grid-border bg-white p-3 text-sm text-text-muted">
              <p>{text.modelLoading}</p>
              <progress aria-label={text.modelLoading} className="mt-2 block w-full accent-emerald-accent" />
            </div>
          )}
          {needsModel && segmentation.status === 'error' && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <p role="alert">{text.modelError}</p>
              <button type="button" className={secondaryButton + ' mt-2'} onClick={ensureSegmentation}>{text.retry}</button>
            </div>
          )}
          <TonePanel edit={edit} update={updateEditor} getSession={getEditorSession} text={text} />
          <FiltersPanel filter={edit.filter} update={updateEditor} text={text} />
          <SuitPanel suit={edit.suit} update={updateEditor} segmentation={segmentation} text={text} />

          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} disabled={!editHistory.past.length} onClick={undoEditor}>{text.undo}</button>
            <button type="button" className={secondaryButton} disabled={!editHistory.future.length} onClick={redoEditor}>{text.redo}</button>
            <button type="button" className={secondaryButton} onClick={reset}>{text.reset}</button>
            <button type="button" className={secondaryButton} onClick={() => finishEditor(true)}>{text.skip}</button>
          </div>
          {editorBusy && <p role="status" className="text-sm text-text-muted">{text.processing}</p>}
          {editorError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text[editorError]}</p>}
        </fieldset>
      </div>
    </div>
  )
}
