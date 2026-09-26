import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

// True once the splash has handed over (fatw:reveal) plus `delay` ms, so the
// front panel powers on after the globe starts warming up. With no splash on
// screen (it already left, or never ran) it's true right away.
function useAfterReveal(delay) {
  const [on, setOn] = useState(() => !document.getElementById('boot'))
  useEffect(() => {
    if (on) return undefined
    let timer = 0
    const go = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setOn(true), delay)
    }
    window.addEventListener('fatw:reveal', go)
    const safety = setTimeout(() => setOn(true), 12000)
    return () => {
      window.removeEventListener('fatw:reveal', go)
      clearTimeout(timer)
      clearTimeout(safety)
    }
  }, [on, delay])
  return on
}

// Keys travel down on pointerdown and hold there for at least a few frames,
// so even a quick tap on a phone reads as a physical press.
const MIN_PRESS_MS = 90
const pressHandlers = {
  onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const el = event.currentTarget
    el.dataset.downAt = String(performance.now())
    el.classList.add('is-down')
  },
  onPointerUp(event) {
    release(event.currentTarget)
  },
  onPointerCancel(event) {
    release(event.currentTarget)
  },
  onPointerLeave(event) {
    release(event.currentTarget)
  },
}

function release(el) {
  if (!el.classList.contains('is-down')) return
  const held = performance.now() - Number(el.dataset.downAt || 0)
  setTimeout(() => el.classList.remove('is-down'), Math.max(0, MIN_PRESS_MS - held))
}

function ListGlyph() {
  return (
    <svg className="icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

// On desktop the list is always on screen (the left panel): the console's
// list key takes you into it.
function focusSidePanel() {
  const panel = document.querySelector('.side-panel')
  if (!panel) return
  panel.querySelector('.rlist__scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  const target = panel.querySelector('button[aria-pressed="true"], [role="listitem"] button, button')
  target?.focus({ preventScroll: true, focusVisible: true })
}

// The front panel: a thumb-zone plate on phones, a bottom-centre console on
// desktop. REC is the ceramic key in the knurled bezel; onRecord runs inside
// the tap itself (the recorder arms the mic in that same gesture).
// With reduced motion the globe switches on at once, so the panel does too
const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function HomeControls({ compact, hidden, canShuffle, total, onRecord, onList, onShuffle }) {
  const [powerDelay] = useState(() => (reducedMotion() ? 0 : 600))
  const powered = useAfterReveal(powerDelay)
  const totalLabel = total == null ? '--' : total.toLocaleString('en-US')

  const record = event => {
    onRecord(event)
    try { navigator.vibrate?.(8) } catch { /* unsupported */ }
  }

  const classes = [
    'front-panel',
    'chassis',
    compact ? 'front-panel--dock' : 'front-panel--console',
    powered ? 'is-powered' : '',
    compact && hidden ? 'is-hidden' : '',
  ].join(' ')

  return (
    <nav className={classes} aria-label="Controls">
      <button
        type="button"
        className="fp-button fp-button--side"
        onClick={compact ? onList : focusSidePanel}
        aria-label={total == null ? 'All farts' : `All farts (${totalLabel})`}
        {...pressHandlers}
      >
        <span className="key fp-cap" aria-hidden="true"><ListGlyph /></span>
        <span className="key-legend" aria-hidden="true">
          All <span className={`fp-count ${total == null ? 'is-ghost' : ''}`}>{totalLabel}</span>
        </span>
      </button>

      <button
        type="button"
        className="fp-button fp-button--rec"
        onClick={record}
        aria-label="Record a fart"
        aria-keyshortcuts={compact ? undefined : 'R'}
        {...pressHandlers}
      >
        <span className="bezel" aria-hidden="true">
          <span className="key-ceramic key-ceramic--round fp-rec-cap">
            <span className="rec-dot" />
          </span>
        </span>
        <span className="key-legend" aria-hidden="true">
          Rec{!compact && <kbd className="fp-kbd">R</kbd>}
        </span>
      </button>

      <button
        type="button"
        className="fp-button fp-button--side"
        onClick={onShuffle}
        disabled={!canShuffle}
        aria-label="Play a random fart"
        {...pressHandlers}
      >
        <span className="key fp-cap" aria-hidden="true"><Icon name="shuffle" size={20} /></span>
        <span className="key-legend" aria-hidden="true">Random</span>
      </button>
    </nav>
  )
}

// A one-line dot-matrix readout at the top of the globe for things that are
// happening (a tour in progress, the odd easter egg). Characters light up one
// after another like the hint's; tapping it does what `onPress` says
// (stop the tour, say).
export function Whisper({ text, tone = 'phosphor', label, onPress }) {
  const line = text.toUpperCase()
  // Filled a beat after mounting, so screen readers announce it
  const [spoken, setSpoken] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(text), 300)
    return () => clearTimeout(timer)
  }, [text])
  return (
    <div className="whisper-slot">
      <p className="sr-only" role="status">{spoken}</p>
      <button
        type="button"
        className={`hint whisper well well--sm ${tone === 'sodium' ? 'hint--sodium' : ''}`}
        onClick={onPress}
        aria-label={label || text}
        tabIndex={onPress ? 0 : -1}
      >
        <span className="hint__line" key={line} aria-hidden="true">
          {[...line].map((char, index) => (
            // The index is the character's position in the reveal sequence
            // eslint-disable-next-line react/no-array-index-key
            <span key={index} style={{ '--i': index }}>{char}</span>
          ))}
        </span>
      </button>
    </div>
  )
}

// A one-line dot-matrix readout in a small well above the front panel:
// "TAP A DOT TO LISTEN", or a live line App passes in `text`. The well rises
// out of the panel, then the characters light up one after another over
// their own ghost dots. (App mounts it once the globe has warmed up.)
export function Hint({ compact, text, tone = 'phosphor', onDismiss }) {
  const sentence = text || `${compact ? 'Tap' : 'Click'} a dot to listen`
  const line = sentence.toUpperCase()
  // Filled a beat after mounting, so screen readers announce it
  const [spoken, setSpoken] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(sentence), 300)
    return () => clearTimeout(timer)
  }, [sentence])

  return (
    <div className="hint-slot">
      <p className="sr-only" role="status">{spoken}</p>
      <button
        type="button"
        className={`hint well well--sm ${tone === 'sodium' ? 'hint--sodium' : ''}`}
        onClick={onDismiss}
        aria-label={`Dismiss: ${sentence}`}
      >
        <span className="hint__line" key={line} aria-hidden="true">
          {[...line].map((char, index) => (
            // The index is the character's position in the reveal sequence
            // eslint-disable-next-line react/no-array-index-key
            <span key={index} style={{ '--i': index }}>{char}</span>
          ))}
        </span>
      </button>
    </div>
  )
}
