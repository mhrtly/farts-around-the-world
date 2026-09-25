import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const EXIT_MS = 400
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

// A panel that slides out of the hardware. On phones it's a drawer from the
// bottom you can drag down to dismiss; on desktop the CSS turns each variant
// into a floating panel. Modal sheets trap focus and hand it back on close.
// While `dismissible` is false (e.g. mid-recording) the backdrop, Esc and the
// drag handle can't close it; Esc calls onEscape instead.
export default function Sheet({
  open,
  onClose,
  onEscape,
  variant,
  label,
  modal = false,
  dismissible = true,
  initialFocus,
  onHeightChange,
  className = '',
  children,
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const layerRef = useRef(null)
  const panelRef = useRef(null)
  const dragRef = useRef(null)
  const openerRef = useRef(null)
  const propsRef = useRef({})
  propsRef.current = { onClose, onEscape, dismissible, onHeightChange, initialFocus }

  useEffect(() => {
    if (open) {
      if (modal && !openerRef.current) openerRef.current = document.activeElement
      setMounted(true)
      // Two frames so the closed position is painted before we animate open
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    setVisible(false)
    propsRef.current.onHeightChange?.(0)
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open, modal])

  // Focus: move into modal sheets when they open, hand it back when they close
  useEffect(() => {
    if (!modal) return undefined
    if (open && visible) {
      const panel = panelRef.current
      if (panel && !panel.contains(document.activeElement)) {
        const selector = propsRef.current.initialFocus
        const target = (selector && panel.querySelector(selector)) || panel
        target.focus({ preventScroll: true })
      }
      return undefined
    }
    if (!open) {
      const opener = openerRef.current
      openerRef.current = null
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        const active = document.activeElement
        if (!active || active === document.body || panelRef.current?.contains(active)) {
          opener.focus({ preventScroll: true })
        }
      }
    }
    return undefined
  }, [open, visible, modal])

  // Modal sheets make everything behind them inert (except toasts)
  useEffect(() => {
    if (!modal || !open || !mounted) return undefined
    const layer = layerRef.current
    const parent = layer?.parentElement
    if (!parent) return undefined
    const madeInert = []
    for (const child of parent.children) {
      if (child === layer || child.classList.contains('toasts') || child.hasAttribute('inert')) continue
      child.setAttribute('inert', '')
      madeInert.push(child)
    }
    return () => madeInert.forEach(child => child.removeAttribute('inert'))
  }, [modal, open, mounted])

  // Esc, and Tab kept inside a modal sheet
  useEffect(() => {
    if (!open) return undefined
    const onKey = event => {
      if (event.key === 'Escape' && (modal || panelRef.current?.contains(document.activeElement))) {
        event.stopPropagation()
        if (propsRef.current.dismissible) propsRef.current.onClose?.()
        else propsRef.current.onEscape?.()
        return
      }
      if (event.key === 'Tab' && modal && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, modal])

  // Report how much of the screen the panel covers (the globe re-centres above it)
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || !visible || !onHeightChange) return undefined
    const report = () => propsRef.current.onHeightChange?.(panel.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [visible, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = event => {
    if (window.innerWidth >= 860) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastT: performance.now(), velocity: 0, dy: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    panelRef.current?.classList.add('is-dragging')
  }

  const onPointerMove = event => {
    const drag = dragRef.current
    if (!drag) return
    const now = performance.now()
    const raw = Math.max(0, event.clientY - drag.startY)
    drag.velocity = (event.clientY - drag.lastY) / Math.max(1, now - drag.lastT)
    drag.lastY = event.clientY
    drag.lastT = now
    // A panel that can't be dismissed right now only gives a little
    const dy = propsRef.current.dismissible ? raw : Math.min(24, raw * 0.2)
    drag.dy = dy
    if (panelRef.current) panelRef.current.style.transform = `translate3d(0, ${dy}px, 0)`
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    const panel = panelRef.current
    if (!drag || !panel) return
    panel.classList.remove('is-dragging')
    panel.style.transform = ''
    if (!propsRef.current.dismissible) return
    if (drag.dy > 110 || (drag.dy > 24 && drag.velocity > 0.55)) propsRef.current.onClose?.()
  }

  if (!mounted) return null

  return (
    <div
      ref={layerRef}
      className={`sheet-layer sheet-layer--${variant} ${visible ? 'is-open' : ''} ${modal ? 'sheet-layer--modal' : ''}`}
    >
      {modal && (
        <div
          className="sheet-backdrop"
          onClick={() => { if (propsRef.current.dismissible) propsRef.current.onClose?.() }}
          aria-hidden="true"
        />
      )}
      <section
        ref={panelRef}
        className={`sheet sheet--${variant} chassis ${className}`}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal || undefined}
        aria-label={label}
        tabIndex={-1}
      >
        <div
          className="sheet__grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet__handle" />
        </div>
        {children}
      </section>
    </div>
  )
}
