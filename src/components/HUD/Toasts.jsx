import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const LEAVE_MS = 160
const LED_TONE = { info: 'phosphor', success: 'phosphor', new: 'sodium', error: 'tally' }

// Keeps a toast on screen for a moment after App removes it, so it can decay
// out instead of vanishing — and for as long as it's hovered or focused, so a
// timed toast can't disappear from under your finger. Order is preserved.
function useLeaving(toasts, heldId, dismissed) {
  const [shown, setShown] = useState(toasts)
  const timersRef = useRef(new Map())

  useEffect(() => {
    setShown(previous => {
      const live = new Map(toasts.map(toast => [toast.id, toast]))
      const next = previous.map(toast => {
        if (live.has(toast.id)) return live.get(toast.id)
        if (toast.leaving) return toast
        if (toast.id === heldId && !dismissed.has(toast.id)) return toast
        return { ...toast, leaving: true }
      })
      for (const toast of toasts) if (!previous.some(item => item.id === toast.id)) next.push(toast)
      return next
    })
  }, [toasts, heldId, dismissed])

  useEffect(() => {
    const timers = timersRef.current
    for (const toast of shown) {
      if (!toast.leaving || timers.has(toast.id)) continue
      timers.set(toast.id, setTimeout(() => {
        timers.delete(toast.id)
        setShown(list => list.filter(item => item.id !== toast.id))
      }, LEAVE_MS))
    }
  }, [shown])

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])
  return shown
}

// Notices as strips of the chassis, each lit by an LED: phosphor for info and
// success, sodium for a new arrival (it blinks as it lands), tally red for
// errors. No icons, no glass.
export default function Toasts({ toasts, onDismiss }) {
  const [heldId, setHeldId] = useState(null)
  const dismissedRef = useRef(new Set()) // closed on purpose: never held back
  const shown = useLeaving(toasts, heldId, dismissedRef.current)

  const hold = id => setHeldId(id)
  const release = id => setHeldId(current => (current === id ? null : current))
  const dismiss = id => {
    dismissedRef.current.add(id)
    release(id)
    onDismiss(id)
  }

  return (
    <div className="toasts" aria-live="polite">
      {shown.map(toast => {
        const tone = LED_TONE[toast.tone] ? toast.tone : 'info'
        return (
          <div
            key={toast.id}
            className={`toast toast--${tone} chassis ${toast.leaving ? 'is-leaving' : ''}`}
            role={tone === 'error' ? 'alert' : undefined}
            onPointerEnter={event => { if (event.pointerType === 'mouse') hold(toast.id) }}
            onPointerLeave={event => { if (event.pointerType === 'mouse') release(toast.id) }}
            onFocus={() => hold(toast.id)}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) release(toast.id)
            }}
          >
            <span className={`led led--${LED_TONE[tone]} toast__led ${tone === 'new' ? 'is-announce' : ''}`} aria-hidden="true" />
            <p className="toast__text">{toast.text}</p>
            {toast.action && (
              <button
                type="button"
                className="key key--sm toast__action"
                onClick={() => {
                  // Straight through: an action like "Open" or "Listen" may
                  // need this very tap (microphone, audio on iOS)
                  toast.action()
                  dismiss(toast.id)
                }}
              >
                {toast.actionLabel || 'Open'}
              </button>
            )}
            <button type="button" className="key key--sm toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <Icon name="close" size={14} strokeWidth={2} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
