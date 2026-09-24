import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * Live audio waveform visualizer for playback.
 * Takes an audio URL, plays it, and draws a real-time waveform.
 */
export default function AudioWaveform({
  audioUrl,
  isPlaying,
  onPlayToggle,
  onEnded,
  color = '#38f3ff',
  height = 48,
}) {
  const canvasRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const audioRef = useRef(null)
  const animFrameRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const cleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch { /* ignore */ }
      sourceRef.current = null
    }
    // Don't close AudioContext — reuse it
  }, [])

  // Draw the waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      analyser.getByteTimeDomainData(dataArray)

      ctx.clearRect(0, 0, width, height)

      // Draw background grid
      ctx.strokeStyle = `${color}11`
      ctx.lineWidth = 0.5
      for (let y = 0; y < height; y += 8) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw center line
      ctx.strokeStyle = `${color}22`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      // Draw waveform
      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 6
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Draw progress bar
      if (audioRef.current && audioRef.current.duration) {
        const prog = audioRef.current.currentTime / audioRef.current.duration
        setProgress(prog)

        ctx.fillStyle = `${color}33`
        ctx.fillRect(0, height - 2, width * prog, 2)
        ctx.fillStyle = color
        ctx.fillRect(0, height - 2, width * prog, 1)
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()
  }, [color])

  // Handle play/stop
  useEffect(() => {
    if (isPlaying && audioUrl) {
      // Create audio context on demand (user gesture required)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      const audioCtx = audioCtxRef.current
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })

      audio.addEventListener('ended', () => {
        cleanup()
        onEnded?.()
      })

      const source = audioCtx.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)
      sourceRef.current = source

      audio.play().then(() => {
        draw()
      }).catch(() => {
        cleanup()
        onEnded?.()
      })
    } else {
      cleanup()
      // Draw flat line when stopped
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)

        // Grid
        ctx.strokeStyle = `${color}11`
        ctx.lineWidth = 0.5
        for (let y = 0; y < h; y += 8) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
          ctx.stroke()
        }

        // Center line
        ctx.strokeStyle = `${color}22`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(w, h / 2)
        ctx.stroke()
      }
    }

    return cleanup
  }, [isPlaying, audioUrl, cleanup, draw, onEnded, color])

  // Set canvas resolution on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      canvas.width = rect.width
      canvas.height = rect.height
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Waveform canvas */}
      <div
        onClick={onPlayToggle}
        style={{
          position: 'relative',
          cursor: 'pointer',
          borderRadius: '4px',
          border: `1px solid ${isPlaying ? color + '44' : color + '15'}`,
          background: isPlaying ? `${color}08` : 'rgba(6,9,13,0.4)',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: `${height}px`,
            display: 'block',
          }}
        />

        {/* Play/stop overlay */}
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: '14px',
            color: isPlaying ? '#ff4d5a' : color,
            textShadow: isPlaying ? '0 0 8px rgba(255,77,90,0.5)' : `0 0 8px ${color}55`,
          }}>
            {isPlaying ? '⏹' : '▶'}
          </span>
          <span style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            color: isPlaying ? '#ff4d5a' : color,
            fontWeight: 'bold',
          }}>
            {isPlaying ? 'STOP' : 'PLAY'}
          </span>
        </div>

        {/* Duration / progress */}
        {(duration > 0 || isPlaying) && (
          <div style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '9px',
            fontFamily: 'monospace',
            color: 'var(--text-dim)',
            letterSpacing: '0.1em',
            pointerEvents: 'none',
          }}>
            {isPlaying ? `${(progress * duration).toFixed(1)}s` : `${duration.toFixed(1)}s`}
          </div>
        )}
      </div>
    </div>
  )
}
