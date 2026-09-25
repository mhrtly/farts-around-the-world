import { useEffect, useRef, useState } from 'react'

// Scale bar lengths to choose from (km)
const STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
const BAR_MAX = 88 // px

function scaleFor(kmPerPx) {
  let best = STEPS[0]
  for (const step of STEPS) if (step / kmPerPx <= BAR_MAX) best = step
  const px = Math.max(24, Math.min(BAR_MAX, best / kmPerPx))
  const text = best < 1 ? `${Math.round(best * 1000)} m` : `${best.toLocaleString('en-US')} km`
  return { px, text }
}

function Glyph({ name }) {
  if (name === 'in') {
    return (
      <svg className="icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'out') {
    return (
      <svg className="icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    )
  }
  // The whole planet: a globe with one meridian and the equator
  return (
    <svg className="icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="9" cy="9" rx="2.9" ry="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.6 9h12.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

// The zoom rocker at the edge of the globe: + and − keys on a small plate,
// a key that pulls back to the whole planet once you're down close, and a
// scale readout that lights up beside it while the zoom changes (the way a
// map shows its scale bar), then fades.
export default function ZoomControls({ globeRef, compact, hidden, onEarth }) {
  const [limits, setLimits] = useState({ atMin: false, atMax: false, close: false })
  const scaleRef = useRef(null)
  const barRef = useRef(null)
  const textRef = useRef(null)
  const timerRef = useRef(0)
  const lastRef = useRef(null)

  useEffect(() => {
    const api = globeRef.current
    if (!api?.onZoom) return undefined
    const off = api.onZoom(({ altitude, kmPerPx, atMin, atMax }) => {
      const close = altitude < 0.85
      setLimits(prev => (prev.atMin === atMin && prev.atMax === atMax && prev.close === close ? prev : { atMin, atMax, close }))
      // The scale only means something once the view is less than a planet
      const el = scaleRef.current
      if (!el) return
      const { px, text } = scaleFor(kmPerPx)
      if (barRef.current) barRef.current.style.width = `${Math.round(px)}px`
      if (textRef.current && textRef.current.textContent !== text) textRef.current.textContent = text
      const first = lastRef.current == null
      lastRef.current = altitude
      if (first || altitude > 1.2) {
        el.classList.remove('is-on')
        return
      }
      el.classList.add('is-on')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => el.classList.remove('is-on'), 1600)
    })
    return () => {
      off?.()
      clearTimeout(timerRef.current)
    }
  }, [globeRef])

  const zoom = factor => globeRef.current?.zoomBy?.(factor)

  return (
    <div className={`zoom ${compact ? 'zoom--compact' : 'zoom--wide'} ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden || undefined}>
      <div ref={scaleRef} className="zoom__scale well well--sm" aria-hidden="true">
        <span ref={barRef} className="zoom__bar" />
        <span ref={textRef} className="zoom__text" />
      </div>
      <div className="zoom__stack">
        <button
          type="button"
          className={`key zoom__earth ${limits.close ? 'is-on' : ''}`}
          onClick={onEarth}
          aria-label="Back out to the whole Earth"
          aria-hidden={!limits.close || undefined}
          tabIndex={limits.close && !hidden ? 0 : -1}
          title="Whole Earth"
        >
          <Glyph name="earth" />
        </button>
        <div className="zoom__rocker chassis" role="group" aria-label="Zoom">
          <button
            type="button"
            className="key zoom__key"
            onClick={() => zoom(1 / 2.2)}
            disabled={limits.atMin}
            aria-label="Zoom in"
            aria-keyshortcuts={compact ? undefined : '+'}
            tabIndex={hidden ? -1 : 0}
          >
            <Glyph name="in" />
          </button>
          <button
            type="button"
            className="key zoom__key"
            onClick={() => zoom(2.2)}
            disabled={limits.atMax}
            aria-label="Zoom out"
            aria-keyshortcuts={compact ? undefined : '-'}
            tabIndex={hidden ? -1 : 0}
          >
            <Glyph name="out" />
          </button>
        </div>
      </div>
    </div>
  )
}
