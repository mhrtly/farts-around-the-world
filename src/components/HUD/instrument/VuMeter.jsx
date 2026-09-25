import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react'
import { LOUDNESS_BANDS } from '../../../utils/recordings.js'

// A backlit VU meter. The scale is dBFS (−50 … 0) and it's printed with the
// app's real loudness words, so a fart that the card calls HUGE pegs the
// needle in the red. The needle has real meter ballistics (a damped spring
// with hard stops). It reads getDb() every frame while active.

const MIN_DB = -50
const MAX_DB = 0
const angleFor = db => (Math.min(MAX_DB, Math.max(MIN_DB, db)) + 25) * 2 // −50° … +50°
const REST = angleFor(MIN_DB)
const HUGE_FROM = LOUDNESS_BANDS[LOUDNESS_BANDS.length - 2].max // where HUGE starts

const CX = 74
const CY = 122
const R = 80
const point = (deg, r) => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)]
function arc(a1, a2, r) {
  const [x1, y1] = point(a1, r)
  const [x2, y2] = point(a2, r)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// Band edges come straight from the loudness words used everywhere else.
const BANDS = (() => {
  let low = MIN_DB
  return LOUDNESS_BANDS.map(band => {
    const high = Math.min(MAX_DB, band.max)
    const entry = { word: band.word.toUpperCase(), from: low, to: high }
    low = high
    return entry
  })
})()

const Face = memo(function Face({ id }) {
  const ticks = []
  for (let db = MIN_DB; db <= MAX_DB; db += 2.5) {
    const major = db % 10 === 0
    const a = angleFor(db)
    const [x1, y1] = point(a, R - (major ? 9 : 5))
    const [x2, y2] = point(a, R)
    ticks.push(
      <line
        key={db}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={db > HUGE_FROM ? 'var(--vu-red)' : 'var(--vu-ink)'}
        strokeWidth={major ? 1.1 : 0.7}
      />,
    )
  }
  const numbers = [-40, -30, -20, -10, 0].map(db => {
    const [x, y] = point(angleFor(db), R - 16)
    return (
      <text key={db} x={x} y={y + 2.5} textAnchor="middle" fontFamily="B612 Mono, monospace" fontSize="7" fill={db > HUGE_FROM ? 'var(--vu-red)' : 'var(--vu-ink)'}>
        {db === 0 ? '0' : `−${Math.abs(db)}`}
      </text>
    )
  })
  return (
    <svg className="vu__face" viewBox="0 0 148 100" aria-hidden="true">
      <defs>
        {BANDS.map((band, i) => (
          <path key={band.word} id={`${id}-band${i}`} d={arc(angleFor(band.from), angleFor(band.to), R + 5)} />
        ))}
      </defs>
      <path d={arc(angleFor(HUGE_FROM), angleFor(MAX_DB), R - 2)} stroke="var(--vu-red)" strokeWidth="4" fill="none" opacity=".85" />
      <path d={arc(angleFor(MIN_DB), angleFor(HUGE_FROM), R - 0.5)} stroke="var(--vu-ink)" strokeWidth=".8" fill="none" />
      {ticks}
      {numbers}
      {BANDS.map((band, i) => (
        <text
          key={band.word}
          fontFamily="B612, sans-serif"
          fontWeight="700"
          fontSize={band.word === 'HUGE' ? 7 : 5.6}
          letterSpacing=".6"
          fill={band.word === 'HUGE' ? 'var(--vu-red)' : 'rgba(43,34,23,.78)'}
        >
          <textPath href={`#${id}-band${i}`} startOffset="50%" textAnchor="middle">{band.word}</textPath>
        </text>
      ))}
      <text x="74" y="70" textAnchor="middle" fontFamily="B612, sans-serif" fontWeight="700" fontSize="8" letterSpacing="1.5" fill="rgba(43,34,23,.7)">dBFS</text>
    </svg>
  )
})

let meterCount = 0

const VuMeter = forwardRef(function VuMeter({
  getDb,
  active = false,
  lit = true,
  size = 'md',
  peakHoldMs = 1000,
  className = '',
}, ref) {
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = `vu${++meterCount}`
  const needleRef = useRef(null)
  const peakRef = useRef(null)
  const stateRef = useRef({ x: REST, v: 0, frame: 0, last: 0, peakUntil: 0, peakOn: false })
  const getDbRef = useRef(getDb)
  getDbRef.current = getDb
  const activeRef = useRef(active)
  activeRef.current = active

  const start = () => {
    const state = stateRef.current
    if (state.frame) return
    state.last = performance.now()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const stiffness = 170
    const damping = reduced ? 2 * Math.sqrt(stiffness) : 21
    const tick = now => {
      const dt = Math.min(1 / 30, Math.max(0, (now - state.last) / 1000))
      state.last = now
      const db = activeRef.current ? getDbRef.current?.() : null
      const target = Number.isFinite(db) ? angleFor(db) : REST
      const accel = -stiffness * (state.x - target) - damping * state.v
      state.v += accel * dt
      state.x += state.v * dt
      // Hard stops: the needle really pegs, with a little bounce
      if (state.x > 50) { state.x = 50; state.v = -state.v * 0.3 }
      if (state.x < -50) { state.x = -50; state.v = -state.v * 0.3 }
      if (needleRef.current) needleRef.current.style.transform = `rotate(${state.x.toFixed(2)}deg)`

      const hot = Number.isFinite(db) && db > -6
      if (hot) state.peakUntil = now + peakHoldMs
      const peakOn = now < state.peakUntil
      if (peakOn !== state.peakOn && peakRef.current) {
        state.peakOn = peakOn
        peakRef.current.classList.toggle('is-on', peakOn)
      }

      const settled = Math.abs(state.v) < 0.05 && Math.abs(state.x - target) < 0.05 && !peakOn
      if (!activeRef.current && settled) {
        state.frame = 0
        return
      }
      state.frame = requestAnimationFrame(tick)
    }
    state.frame = requestAnimationFrame(tick)
  }

  useEffect(() => {
    start()
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    cancelAnimationFrame(stateRef.current.frame)
    stateRef.current.frame = 0
  }, [])

  useImperativeHandle(ref, () => ({
    // A little wobble, like a meter carried in a drawer
    kick(velocity = 60) {
      stateRef.current.v += velocity
      start()
    },
  }))

  return (
    <div className={`vu vu--${size} ${lit ? 'is-lit' : ''} ${className}`} aria-hidden="true">
      <Face id={idRef.current} />
      <span className="vu__peak-label">PEAK</span>
      <span ref={peakRef} className="vu__peak" />
      <div ref={needleRef} className="vu__needle" />
      <div className="vu__cowl" />
      <div className="vu__shade" />
    </div>
  )
})

export default VuMeter
