import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import TakeSlip from './TakeSlip.jsx'

// A posted take's slip flies out of the closing drawer to the spot on the globe
// where its pin will appear. Rendered outside the sheet (which unmounts as it
// closes). The arc comes from nesting: X and Y travel on separate easings,
// while the slip itself turns, shrinks and fades.

const FLIGHT_MS = 720

export default function SlipFlight({ flight, onDone }) {
  const xRef = useRef(null)
  const yRef = useRef(null)
  const bodyRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useLayoutEffect(() => {
    const { rect, target, reducedMotion } = flight
    const start = flight.start || { x: 0, y: 0, angle: 0 }
    let cancelled = false
    // A cancelled animation rejects `finished`; only a real landing counts
    const finish = () => { if (!cancelled) doneRef.current?.() }
    const x = xRef.current
    const y = yRef.current
    const body = bodyRef.current
    if (!x || !y || !body || typeof body.animate !== 'function') {
      const timer = setTimeout(finish, 200)
      return () => { cancelled = true; clearTimeout(timer) }
    }
    if (reducedMotion) {
      const fade = body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' })
      fade.finished.then(finish, finish)
      return () => { cancelled = true; fade.cancel() }
    }
    const dx = target.x - (rect.left + rect.width / 2)
    const dy = target.y - (rect.top + rect.height / 2)
    // Bow the path sideways so it reads as a throw, not a lift
    const bow = (dx >= 0 ? 1 : -1) * Math.min(90, window.innerWidth * 0.16)
    const turn = start.angle
    const animations = [
      x.animate(
        [{ transform: `translate3d(${start.x}px,0,0)` }, { transform: `translate3d(${bow + (start.x + dx) * 0.5}px,0,0)`, offset: 0.45 }, { transform: `translate3d(${dx}px,0,0)` }],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(.35,0,.3,1)', fill: 'forwards' },
      ),
      y.animate(
        [{ transform: `translate3d(0,${start.y}px,0)` }, { transform: `translate3d(0,${dy}px,0)` }],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'forwards' },
      ),
      body.animate(
        [
          { transform: `rotate(${turn}deg) scale(1)`, opacity: 1 },
          { transform: `rotate(${turn - 5}deg) scale(.42)`, opacity: 1, offset: 0.55 },
          { transform: `rotate(${turn - 9}deg) scale(.08)`, opacity: 0 },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
      ),
    ]
    animations[2].finished.then(finish, finish)
    return () => {
      cancelled = true
      animations.forEach(animation => animation.cancel())
    }
  }, [flight])

  const { rect } = flight
  const start = flight.start || { x: 0, y: 0, angle: 0 }
  return createPortal(
    <div
      className="slip-flight"
      style={{ left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` }}
      aria-hidden="true"
    >
      <div ref={xRef} className="slip-flight__axis" style={{ transform: `translate3d(${start.x}px, 0, 0)` }}>
        <div ref={yRef} className="slip-flight__axis" style={{ transform: `translate3d(0, ${start.y}px, 0)` }}>
          <div ref={bodyRef} className="slip-flight__body" style={{ transform: `rotate(${start.angle}deg)` }}>
            <TakeSlip slip={flight.slip} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
