import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

// The take drawn as tape: 100 slots = 10 seconds, each bar the loudest moment
// of its tenth of a second (phosphor; sodium above −6 dBFS). After the take,
// the silence that gets trimmed is shaded and the kept part zooms to fill the
// strip. Driven imperatively by the recorder's own animation loop.

const SLOTS = 100
const SECONDS = 10
const FLOOR_DB = -50
const HOT_DB = -6
const MAX_ZOOM = 3.5

const PHOSPHOR = '#62f6d0'
const SODIUM = '#ffa537'
const EMPTY = 'rgba(232, 226, 212, 0.11)'

const TapeStrip = forwardRef(function TapeStrip(_props, ref) {
  const canvasRef = useRef(null)
  const rollRef = useRef(null)
  const headRef = useRef(null)
  const leftShadeRef = useRef(null)
  const rightShadeRef = useRef(null)
  const levelsRef = useRef(new Float32Array(SLOTS).fill(NaN))
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const headAtRef = useRef(-1)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height, dpr } = sizeRef.current
    if (!width) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    const slot = width / SLOTS
    const bar = Math.max(dpr, Math.round(slot * 0.58))
    const dot = Math.max(1, Math.round(2 * dpr))
    const levels = levelsRef.current
    const mid = height / 2
    for (let i = 0; i < SLOTS; i++) {
      const x = Math.round(i * slot + (slot - bar) / 2)
      const db = levels[i]
      if (Number.isNaN(db)) {
        ctx.fillStyle = EMPTY
        ctx.fillRect(x, Math.round(mid - dot / 2), bar, dot)
        continue
      }
      const level = Math.max(0.06, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB))
      const h = Math.max(dot, Math.round(level * height))
      ctx.fillStyle = db > HOT_DB ? SODIUM : PHOSPHOR
      ctx.fillRect(x, Math.round(mid - h / 2), bar, h)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(canvas.clientWidth * dpr)
      const height = Math.round(canvas.clientHeight * dpr)
      if (width === sizeRef.current.width && height === sizeRef.current.height) return
      canvas.width = width
      canvas.height = height
      sizeRef.current = { width, height, dpr }
      draw()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  const setShade = (el, from, to) => {
    if (!el) return
    el.style.left = `${from * 100}%`
    el.style.width = `${Math.max(0, to - from) * 100}%`
  }

  useImperativeHandle(ref, () => ({
    reset() {
      levelsRef.current.fill(NaN)
      headAtRef.current = -1
      const roll = rollRef.current
      if (roll) {
        roll.classList.remove('is-zooming')
        roll.style.transform = ''
      }
      leftShadeRef.current?.classList.remove('is-on')
      rightShadeRef.current?.classList.remove('is-on')
      headRef.current?.classList.remove('is-on')
      draw()
    },
    // Record a level (dBFS) at a moment of the take; redraws only on change.
    push(seconds, db) {
      const i = Math.min(SLOTS - 1, Math.max(0, Math.floor((seconds / SECONDS) * SLOTS)))
      const levels = levelsRef.current
      const value = Number.isFinite(db) ? Math.max(FLOOR_DB, db) : FLOOR_DB
      let changed = false
      for (let j = 0; j <= i; j++) {
        // A slot the loop skipped (a slow frame) gets the neighbouring level
        if (Number.isNaN(levels[j])) { levels[j] = value; changed = true }
      }
      if (value > levels[i]) { levels[i] = value; changed = true }
      if (changed) draw()
      const head = headRef.current
      const at = Math.min(1, seconds / SECONDS)
      if (head && Math.abs(at - headAtRef.current) > 0.0015) {
        headAtRef.current = at
        head.classList.add('is-on')
        head.style.transform = `translate3d(${(at * (sizeRef.current.width / sizeRef.current.dpr)).toFixed(1)}px, 0, 0)`
      }
    },
    stop() {
      headRef.current?.classList.remove('is-on')
    },
    // Shade what was trimmed, then zoom the kept part to fill the strip.
    // Resolves when it's done (immediately if there's nothing to show).
    revealTrim({ keptStart = 0, keptEnd = 0, trimmedSeconds = 0, rawDuration = SECONDS }, { reducedMotion = false } = {}) {
      const roll = rollRef.current
      if (!roll || !(keptEnd > keptStart)) return Promise.resolve()
      const a = Math.max(0, keptStart / SECONDS)
      const b = Math.min(1, keptEnd / SECONDS)
      const trimmed = trimmedSeconds >= 0.1
      if (trimmed) {
        setShade(leftShadeRef.current, 0, a)
        setShade(rightShadeRef.current, b, Math.min(1, Math.max(b, rawDuration / SECONDS)))
        leftShadeRef.current?.classList.add('is-on')
        rightShadeRef.current?.classList.add('is-on')
      }
      if (reducedMotion) return new Promise(resolve => setTimeout(resolve, trimmed ? 420 : 120))
      const width = roll.clientWidth
      const zoom = Math.min(MAX_ZOOM, 1 / Math.max(0.001, b - a))
      const shift = width / (2 * zoom) - ((a + b) / 2) * width
      return new Promise(resolve => {
        setTimeout(() => {
          roll.classList.add('is-zooming')
          roll.style.transform = `scaleX(${zoom.toFixed(4)}) translateX(${shift.toFixed(2)}px)`
          setTimeout(resolve, 420)
        }, trimmed ? 260 : 60)
      })
    },
  }), [draw])

  return (
    <div className="tape" aria-hidden="true">
      <div className="tape__track">
        <div ref={rollRef} className="tape__roll">
          <canvas ref={canvasRef} className="tape__canvas" />
          <span ref={leftShadeRef} className="tape__shade tape__shade--head" />
          <span ref={rightShadeRef} className="tape__shade tape__shade--tail" />
        </div>
        <span ref={headRef} className="tape__head" />
      </div>
      <div className="tape__scale">
        <span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10 s</span>
      </div>
    </div>
  )
})

export default TapeStrip
