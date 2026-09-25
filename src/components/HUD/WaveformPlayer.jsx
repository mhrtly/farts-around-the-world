import { useEffect, useMemo, useRef, useState } from 'react'
import Glyph from './deck/Glyph.jsx'
import { usePlayer, toggle, currentTime, seekTo } from '../../utils/player.js'
import { formatLength, formatPlayhead } from '../../utils/recordings.js'

// Max-pool the analysis peaks (72 of them) down to as many bars as the track
// has room for, so the bars stay chunky like a bargraph.
function poolPeaks(peaks, count) {
  if (!peaks?.length) return null
  if (peaks.length <= count) return Array.from(peaks)
  const out = new Array(count)
  for (let b = 0; b < count; b++) {
    const from = Math.floor((b / count) * peaks.length)
    const to = Math.max(from + 1, Math.floor(((b + 1) / count) * peaks.length))
    let max = 0
    for (let i = from; i < to; i++) if (peaks[i] > max) max = peaks[i]
    out[b] = max
  }
  return out
}

function usePlayState(id) {
  const player = usePlayer()
  const isCurrent = player.id === id
  const status = isCurrent ? player.status : 'idle'
  return {
    isCurrent,
    status,
    playing: status === 'playing',
    busy: status === 'loading',
    error: isCurrent ? player.error : null,
    playerDuration: isCurrent ? player.duration : 0,
  }
}

// The ceramic PLAY key. It latches (stays down) while its recording plays.
export function PlayKey({ id, src, duration = null, label = 'Play recording', className = '' }) {
  const { playing, busy } = usePlayState(id)
  const down = playing || busy
  return (
    <button
      type="button"
      className={`key-ceramic play-key wplayer__button ${busy ? 'is-busy' : ''} ${className}`}
      aria-pressed={down}
      aria-label={label}
      onClick={() => toggle(id, src, { duration })}
    >
      <Glyph name={down ? 'pause' : 'play'} size={20} className="play-key__glyph" />
    </button>
  )
}

// The recording's real waveform in phosphor: the part already played is lit,
// the rest glows at 28 %. Under it, the playhead against the sound's length
// ("0.7 / 1.6 s"). Progress moves by transform only and is written straight
// to the DOM each frame while playing (no React renders).
export function WaveTrack({
  id,
  src = null,
  peaks = null,
  duration = null,
  startAt = 0,
  endAt = null,
  soundStart = null,
  soundLength = null,
  loading = false,
  failed = false,
  bars = 48,
  showTime = true,
  className = '',
}) {
  const { isCurrent, status, playing, busy, playerDuration } = usePlayState(id)
  const windowEnd = endAt ?? duration ?? playerDuration ?? 0
  const span = Math.max(0, (windowEnd || 0) - startAt)
  // About one bar per 4.6 px of track, so the bargraph reads the same at any width
  const trackRef = useRef(null)
  const [fitBars, setFitBars] = useState(bars)
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (width > 0) setFitBars(Math.max(24, Math.min(72, Math.round(width / 4.6))))
    })
    observer.observe(track)
    return () => observer.disconnect()
  }, [])
  const barCount = fitBars || bars
  const values = useMemo(() => poolPeaks(peaks, barCount), [peaks, barCount])
  const ready = Boolean(values)
  // The readout counts the sound itself, so it agrees with LENGTH. Without a
  // measured length it waits for the waveform rather than show the clip's.
  const lengthSec = Number.isFinite(soundLength) ? soundLength : (ready && span) || null
  const zero = Number.isFinite(soundStart) ? soundStart : startAt

  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const elapsedRef = useRef(null)
  const lastText = useRef('')

  const paintRef = useRef(() => {})
  paintRef.current = () => {
    const done = status === 'ended'
    const t = isCurrent && status !== 'idle' ? currentTime() : startAt
    const fraction = done ? 1 : span > 0 ? Math.min(1, Math.max(0, (t - startAt) / span)) : 0
    const shift = (1 - fraction) * 100
    if (outerRef.current) outerRef.current.style.transform = `translate3d(${-shift}%,0,0)`
    if (innerRef.current) innerRef.current.style.transform = `translate3d(${shift}%,0,0)`
    if (elapsedRef.current && lengthSec) {
      const into = done ? lengthSec : Math.min(lengthSec, Math.max(0, t - zero))
      const text = formatPlayhead(into, lengthSec)
      if (text !== lastText.current) {
        lastText.current = text
        elapsedRef.current.textContent = text
      }
    }
  }

  useEffect(() => {
    let frame = 0
    const loop = () => {
      paintRef.current()
      if (playing || busy) frame = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(frame)
  }, [isCurrent, status, playing, busy, span, startAt, lengthSec, ready])

  const onClick = event => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    if (!isCurrent || status === 'idle' || status === 'error') {
      if (!src) return
      toggle(id, src, { duration })
      // Start from where it was tapped. A seek before the file's metadata
      // arrives is kept by the media element and applied once it can.
      if (span > 0 && fraction > 0.02) seekTo(startAt + fraction * span)
      return
    }
    if (!span) return
    seekTo(startAt + fraction * span)
    // Paused: nothing else will repaint, so do it now
    paintRef.current()
  }

  // Before the waveform arrives: a dim placeholder pattern (heights in CSS).
  // If it can't be measured at all, a flat trace, not a made-up waveform.
  const renderBars = () => (
    values
      ? values.map((value, i) => <span key={i} style={{ height: `${Math.max(6, value * 100)}%` }} />)
      : Array.from({ length: barCount }, (_, i) => <span key={i} className="wtrack__ghost" />)
  )

  return (
    <div className={`wtrack ${ready ? 'is-ready' : ''} ${loading && !ready ? 'is-loading' : ''} ${playing ? 'is-playing' : ''} ${className}`}>
      <div ref={trackRef} className="wtrack__bars" onClick={onClick} role="presentation">
        {failed && !ready ? (
          <div className="wtrack__flat" aria-hidden="true" />
        ) : (
          <div key={ready ? 'on' : 'off'} className={`wtrack__layer wtrack__layer--base ${ready ? 'flash-on' : ''}`}>{renderBars()}</div>
        )}
        {ready && (
          <div ref={outerRef} className="wtrack__clip" aria-hidden="true">
            <div ref={innerRef} className="wtrack__layer wtrack__layer--hot">{renderBars()}</div>
          </div>
        )}
      </div>
      {showTime && (
        <div className="wtrack__time">
          {lengthSec ? (
            <>
              <span ref={elapsedRef} className="wtrack__elapsed">{formatPlayhead(0, lengthSec)}</span>
              <span className="wtrack__total"> / {formatLength(lengthSec)}</span>
            </>
          ) : failed ? (
            <span className="wtrack__elapsed is-ghost">No waveform</span>
          ) : (
            <span className="wtrack__elapsed is-ghost">-.- / -.- s</span>
          )}
        </div>
      )}
    </div>
  )
}

// Ceramic PLAY key + the waveform in a display well. Used where a recording
// needs a self-contained player (the deck lays the two parts out itself).
export default function WaveformPlayer({
  id,
  src,
  peaks = null,
  duration = null,
  startAt = 0,
  endAt = null,
  size = 'lg',
  tone = 'phosphor',
  loadingWave = false,
  label = 'Play recording',
  variant = 'well',
  soundStart = null,
  soundLength = null,
}) {
  const { error } = usePlayState(id)
  const knownDuration = duration || null
  return (
    <div className={`wplayer wplayer--${variant} wplayer--${size} wplayer--${tone}`}>
      <PlayKey id={id} src={src} duration={knownDuration} label={label} />
      <div className="well wplayer__well">
        <WaveTrack
          id={id}
          src={src}
          peaks={peaks}
          duration={knownDuration}
          startAt={startAt}
          endAt={endAt}
          soundStart={soundStart}
          soundLength={soundLength}
          loading={loadingWave}
          bars={size === 'sm' ? 36 : 56}
        />
        {error && <div className="wplayer__error">{error}</div>}
      </div>
    </div>
  )
}
