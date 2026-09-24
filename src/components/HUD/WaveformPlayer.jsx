import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import { usePlayer, toggle, currentTime, seekTo } from '../../utils/player.js'
import { formatClock } from '../../utils/recordings.js'

const PLACEHOLDER_BARS = 48

// Play button + the recording's real waveform, filling in as it plays.
export default function WaveformPlayer({
  id,
  src,
  peaks = null,
  duration = null,
  startAt = 0,
  endAt = null,
  size = 'lg',
  tone = 'cyan',
  loadingWave = false,
  label = 'Play recording',
}) {
  const player = usePlayer()
  const isCurrent = player.id === id
  const status = isCurrent ? player.status : 'idle'
  const playing = status === 'playing'
  const busy = status === 'loading'
  const knownDuration = duration || (isCurrent ? player.duration : 0) || 0
  // Progress runs across the playback window (just the sound for older clips)
  const windowEnd = endAt ?? knownDuration
  const span = Math.max(0, (windowEnd || 0) - startAt)
  const fillRef = useRef(null)
  const timeRef = useRef(null)
  const waveRef = useRef(null)

  // Progress is written straight to the DOM each frame (no React re-render).
  useEffect(() => {
    let frame = 0
    const paint = () => {
      const t = isCurrent ? Math.max(0, currentTime() - startAt) : 0
      const done = status === 'ended'
      const fraction = done ? 1 : span > 0 ? Math.min(1, t / span) : 0
      if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - fraction) * 100}% 0 0)`
      if (timeRef.current) {
        timeRef.current.textContent = isCurrent && status !== 'idle' && !done
          ? `${formatClock(Math.min(t, span))} / ${formatClock(span)}`
          : formatClock(span)
      }
      if (playing || busy) frame = requestAnimationFrame(paint)
    }
    paint()
    return () => cancelAnimationFrame(frame)
  }, [isCurrent, status, playing, busy, span, startAt])

  const bars = peaks && peaks.length ? Array.from(peaks) : null

  const onWaveClick = event => {
    if (!isCurrent || !span || !waveRef.current) return
    const rect = waveRef.current.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    seekTo(startAt + fraction * span)
  }

  const renderBars = () => (
    bars
      ? bars.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(8, value * 100)}%` }} />
      ))
      : Array.from({ length: PLACEHOLDER_BARS }, (_, index) => (
        <span key={index} className="wave__placeholder" style={{ animationDelay: `${(index % 12) * 60}ms` }} />
      ))
  )

  return (
    <div className={`wplayer wplayer--${size} wplayer--${tone} ${playing ? 'is-playing' : ''}`}>
      <button
        type="button"
        className="wplayer__button"
        onClick={() => toggle(id, src, { duration: knownDuration })}
        aria-label={playing ? 'Pause' : label}
      >
        {busy ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={size === 'lg' ? 26 : 18} />}
      </button>
      <div className="wplayer__body">
        <div
          ref={waveRef}
          className={`wave ${bars ? '' : 'wave--loading'} ${loadingWave ? 'wave--loading' : ''}`}
          onClick={onWaveClick}
          role="presentation"
        >
          <div className="wave__bars">{renderBars()}</div>
          <div ref={fillRef} className="wave__bars wave__bars--fill" aria-hidden="true">{renderBars()}</div>
        </div>
        <div className="wplayer__meta">
          <span ref={timeRef} className="wplayer__time">{formatClock(knownDuration)}</span>
          {isCurrent && player.error && <span className="wplayer__error">{player.error}</span>}
        </div>
      </div>
    </div>
  )
}
