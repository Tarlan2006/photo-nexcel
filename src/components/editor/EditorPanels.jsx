import { useId, useRef } from 'react'
import { suitStyles } from '../../lib/editor/suits'
import { primaryButton, secondaryButton } from './EditorControls'

function Range({ name, label, value, min, max, reset = 0, onChange, text }) {
  const id = useId()
  const gesture = useRef(null)
  const changeNumber = useRef(0)
  const valueText = text.value.replace('{value}', value > 0 ? '+' + value : value)
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <label htmlFor={id} className="font-medium">{label}</label>
        <span aria-hidden="true" className="font-mono text-xs text-text-muted">{value > 0 ? '+' + value : value}</span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={valueText}
        onPointerDown={() => { gesture.current = id + '-' + ++changeNumber.current }}
        onPointerUp={() => { gesture.current = null }}
        onPointerCancel={() => { gesture.current = null }}
        onBlur={() => { gesture.current = null }}
        onChange={(event) => onChange(Number(event.target.value), gesture.current)}
        onDoubleClick={() => onChange(reset, null)}
        className="block min-h-11 w-full cursor-pointer accent-emerald-accent"
      />
    </div>
  )
}

export function SuitPanel({ suit, update, segmentation, text }) {
  const unavailable = segmentation.result?.suitSupported === false
  const change = (patch, group) => update((edit) => ({ ...edit, suit: { ...edit.suit, ...patch } }), group)
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">{text.suitHelp}</p>
      <div role="group" aria-label={text.suitGender} className="flex flex-wrap gap-2">
        {['male', 'female', null].map((gender) => (
          <button
            key={gender ?? 'skip'}
            type="button"
            aria-pressed={suit.gender === gender}
            className={suit.gender === gender ? primaryButton : secondaryButton}
            onClick={() => change({ gender, enabled: false, styleId: 'dark', scale: 0, offset: 0 })}
          >
            {text[gender ?? 'skipSuit']}
          </button>
        ))}
      </div>
      {suit.gender && (
        <>
          {unavailable && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{text.suitUnavailable}</p>}
          <div className="flex flex-wrap gap-2">
            {suitStyles.map((styleId) => (
              <button
                key={styleId}
                type="button"
                className={suit.enabled && suit.styleId === styleId ? primaryButton : secondaryButton}
                aria-pressed={suit.enabled && suit.styleId === styleId}
                disabled={unavailable}
                onClick={() => change({ enabled: true, styleId })}
              >
                {text[styleId]}
              </button>
            ))}
            {suit.enabled && <button type="button" className={secondaryButton} onClick={() => change({ enabled: false })}>{text.removeSuit}</button>}
          </div>
          {suit.enabled && !unavailable && (
            <>
              <Range name="suitScale" label={text.suitScale} min={-25} max={25} value={suit.scale} text={text} onChange={(scale, group) => change({ scale }, group)} />
              <Range name="suitOffset" label={text.suitOffset} min={-10} max={10} value={suit.offset} text={text} onChange={(offset, group) => change({ offset }, group)} />
            </>
          )}
        </>
      )}
    </div>
  )
}
