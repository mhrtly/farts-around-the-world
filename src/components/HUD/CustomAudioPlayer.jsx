import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * FATWA-styled audio player that replaces browser-default <audio controls>.
 * Compact, monospace-themed with waveform progress bar, time display,
 * and play/pause toggle. Designed for the sci-fi HUD aesthetic.
 */
export default function CustomAudioPlayer({ src, color = '#38f3ff', height = 44 }) {
  const audioRef = useRef(null)
  const progressRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const rafRef = useRef(null)

  // Sync playback progress
  const updateProgress = useCallback(() => {
    if (audioRef.current && !seeking) {
      setCurrentTime(audioRef.current.currentTime)
    }
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [seeking])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(rafRef.current)
  }, [updateProgress])

  // Reset when src changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [src])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }, [playing])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  // Seek on progress bar click
  const handleSeek = useCallback((e) => {
    if (!progressRef.current || !audioRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = pct * duration
    setCurrentTime(pct * duration)
  }, [duration])

  const handleMouseDown = useCallback((e) => {
    setSeeking(true)
    handleSeek(e)
    const onMove = (ev) => handleSeek(ev)
    const onUp = () => {
      setSeeking(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [handleSeek])

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      background: 'rgba(6,9,13,0.7)',
      border: `1px solid ${color}22`,
      borderRadius: '6px',
      height: `${height}px`,
      fontFamily: 'monospace',
      userSelect: 'none',
    }}>
      <audio
        ref={audioRef}
        src={src}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: `1px solid ${color}55`,
          background: playing ? `${color}18` : `${color}0a`,
          color: color,
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          boxShadow: playing ? `0 0 8px ${color}33` : 'none',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          height: '20px',
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Track background */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '4px',
          borderRadius: '2px',
          background: `${color}15`,
          overflow: 'hidden',
        }}>
          {/* Fill */}
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: '2px',
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 6px ${color}44`,
            transition: seeking ? 'none' : 'width 0.1s linear',
          }} />
        </div>

        {/* Scrubber dot */}
        <div style={{
          position: 'absolute',
          left: `calc(${progress * 100}% - 5px)`,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}66`,
          opacity: playing || seeking ? 1 : 0.5,
          transition: seeking ? 'none' : 'left 0.1s linear, opacity 0.2s ease',
        }} />
      </div>

      {/* Time display */}
      <div style={{
        fontSize: '9px',
        color: `${color}88`,
        letterSpacing: '0.05em',
        flexShrink: 0,
        minWidth: '60px',
        textAlign: 'right',
      }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  )
}
