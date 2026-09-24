import { useEffect, useRef, useState } from 'react'

const EXIT_MS = 460

// A panel that slides in and out smoothly. On phones it's a bottom sheet you
// can drag down to dismiss; on desktop the CSS turns each variant into a
// floating panel (card on the right, recorder in the center).
export default function Sheet({
  open,
  onClose,
  variant,
  label,
  modal = false,
  className = '',
  children,
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (open) {
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
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open || !modal) return undefined
    const onKey = event => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, modal, onClose])

  const onPointerDown = event => {
    if (window.innerWidth >= 860 || !onClose) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragRef.current = { startY: event.clientY, lastY: event.clientY, lastT: performance.now(), velocity: 0, dy: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    panelRef.current?.classList.add('is-dragging')
  }

  const onPointerMove = event => {
    const drag = dragRef.current
    if (!drag) return
    const now = performance.now()
    const dy = Math.max(0, event.clientY - drag.startY)
    drag.velocity = (event.clientY - drag.lastY) / Math.max(1, now - drag.lastT)
    drag.lastY = event.clientY
    drag.lastT = now
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
    if (drag.dy > 110 || (drag.dy > 24 && drag.velocity > 0.55)) onClose?.()
  }

  if (!mounted) return null

  return (
    <div className={`sheet-layer sheet-layer--${variant} ${visible ? 'is-open' : ''} ${modal ? 'sheet-layer--modal' : ''}`}>
      {modal && <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />}
      <section
        ref={panelRef}
        className={`sheet sheet--${variant} ${className}`}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal || undefined}
        aria-label={label}
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
