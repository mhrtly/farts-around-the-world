import { forwardRef, useEffect, useRef } from 'react'
import Icon from '../Icon.jsx'
import { currentTime, seekTo, toggle, usePlayer } from '../../../utils/player.js'
import { formatLength } from '../../../utils/recordings.js'

// The review display: ceramic PLAY key (latched while playing), the take's
// real waveform in phosphor (the played part lit, the rest dim) and the time.
// Progress is a transform-only wipe written straight to the DOM each frame.
// The time is always the take's measured LENGTH, the same number the slip
// prints. (The clip keeps a little padding around the sound, so a running
// playhead would end on a different, longer number.) The lit wipe shows
// where playback is.

const ReviewPlayer = forwardRef(function ReviewPlayer({ id, src, peaks, duration, length, note, onUserPlay, showError }, keyRef) {
  const player = usePlayer()
  const isCurrent = player.id === id
  const status = isCurrent ? player.status : 'idle'
  const playing = status === 'playing' || status === 'loading'
  const span = Math.max(0.01, duration || (isCurrent ? player.duration : 0) || 0)
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const waveRef = useRef(null)
  const lengthLabel = length || formatLength(span)

  useEffect(() => {
    let frame = 0
    const paint = () => {
      const done = status === 'ended'
      const t = isCurrent && status !== 'idle' ? Math.min(span, Math.max(0, currentTime())) : 0
      const p = done ? 0 : t / span
      if (outerRef.current) outerRef.current.style.transform = `translate3d(${((p - 1) * 100).toFixed(2)}%, 0, 0)`
      if (innerRef.current) innerRef.current.style.transform = `translate3d(${((1 - p) * 100).toFixed(2)}%, 0, 0)`
      if (playing) frame = requestAnimationFrame(paint)
    }
    paint()
    return () => cancelAnimationFrame(frame)
  }, [isCurrent, status, playing, span])

  const bars = peaks?.length ? Array.from(peaks) : null
  const renderBars = () => (bars
    ? bars.map((value, index) => <span key={index} style={{ height: `${Math.max(7, value * 100).toFixed(1)}%` }} />)
    : <span className="rplay__flat" />)

  const onWave = event => {
    if (!isCurrent || !waveRef.current) return
    const rect = waveRef.current.getBoundingClientRect()
    seekTo(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * span)
  }

  const error = isCurrent && status === 'error' && showError ? player.error : null

  return (
    <div className={`well rplay ${playing ? 'is-playing' : ''}`}>
      <button
        ref={keyRef}
        type="button"
        className="key-ceramic rplay__key"
        aria-pressed={playing}
        aria-label={playing ? 'Pause' : 'Play it back'}
        onClick={() => {
          onUserPlay?.()
          toggle(id, src, { duration: span })
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={24} />
      </button>
      <div className="rplay__body">
        <div ref={waveRef} className="rplay__wave" onClick={onWave} role="presentation">
          <div className="rplay__bars">{renderBars()}</div>
          <div ref={outerRef} className="rplay__lit">
            <div ref={innerRef} className="rplay__lit-inner">
              <div className="rplay__bars rplay__bars--lit">{renderBars()}</div>
            </div>
          </div>
        </div>
        <div className="rplay__meta">
          <span className="rplay__note">
            {error || note}
          </span>
          <span className="rplay__time">{lengthLabel}</span>
        </div>
      </div>
    </div>
  )
})

export default ReviewPlayer
