import { useEffect, useRef, useState } from 'react'

const PAD_WIDTH = 1100
const PAD_HEIGHT = 300
const pens = [['thin', 2.5], ['standard', 3.8], ['marker', 5.2]]

// Draw the signature with a mouse, a pen or a finger. The picture never leaves the browser.
export default function SignaturePad({ copy, open, onClose, onUse }) {
  const dialog = useRef(null)
  const canvas = useRef(null)
  const last = useRef(null)
  const [pen, setPen] = useState('standard')
  const [empty, setEmpty] = useState(true)
  const [warning, setWarning] = useState(false)

  const clear = () => {
    const ctx = canvas.current.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAD_WIDTH, PAD_HEIGHT)
    setEmpty(true)
    setWarning(false)
  }

  useEffect(() => {
    const node = dialog.current
    if (open && !node.open) {
      node.showModal()
      clear()
    }
    if (!open && node.open) node.close()
  }, [open])

  const point = event => {
    const rect = canvas.current.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * PAD_WIDTH, y: ((event.clientY - rect.top) / rect.height) * PAD_HEIGHT }
  }
  function down(event) {
    if (event.button > 0) return
    canvas.current.setPointerCapture?.(event.pointerId)
    last.current = point(event)
    const ctx = canvas.current.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(last.current.x, last.current.y, pens.find(([name]) => name === pen)[1], 0, Math.PI * 2)
    ctx.fill()
    setEmpty(false)
    setWarning(false)
  }
  function move(event) {
    if (!last.current) return
    const next = point(event)
    const ctx = canvas.current.getContext('2d')
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = pens.find(([name]) => name === pen)[1] * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.quadraticCurveTo(last.current.x, last.current.y, (last.current.x + next.x) / 2, (last.current.y + next.y) / 2)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
    last.current = next
  }
  const up = () => { last.current = null }

  async function use() {
    if (empty) return setWarning(true)
    onUse(await createImageBitmap(canvas.current))
  }

  return (
    <dialog ref={dialog} onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose() }}
      aria-labelledby="signature-pad-title"
      className="m-auto max-h-[92dvh] w-[min(40rem,calc(100vw-1.5rem))] overflow-auto rounded-2xl border border-grid-border bg-white p-0 backdrop:bg-black/45">
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="signature-pad-title" className="text-lg">{copy.drawTitle}</h2>
            <p className="mt-1 text-sm text-text-muted">{copy.drawHint}</p>
          </div>
          <button type="button" aria-label={copy.closeDialog} onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-grid-border hover:border-emerald-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-5"><path d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="relative my-4 w-full touch-none overflow-hidden rounded-xl border-2 border-[#d4d4ce] bg-white" style={{ aspectRatio: '550 / 150' }}>
          <canvas ref={canvas} width={PAD_WIDTH} height={PAD_HEIGHT} role="img" aria-label={copy.drawCanvas} data-pad-canvas
            className="block h-full w-full cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <div aria-hidden="true" className="pointer-events-none absolute border border-dashed border-emerald-accent/60" style={{ left: '5%', right: '5%', top: '18%', bottom: '18%' }} />
        </div>
        {warning && <p role="alert" className="signature-alert">{copy.drawEmpty}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="signature-button" onClick={clear}>{copy.drawClear}</button>
            <label className="flex items-center gap-2 text-sm text-text-muted">{copy.drawPen}
              <select value={pen} onChange={event => setPen(event.target.value)} className="min-h-11 rounded-lg border border-grid-border bg-paper px-2 text-sm font-medium text-text-main">
                {pens.map(([name]) => <option key={name} value={name}>{copy.pens[name]}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="signature-button signature-primary" onClick={use}>{copy.drawApply}</button>
        </div>
      </div>
    </dialog>
  )
}
