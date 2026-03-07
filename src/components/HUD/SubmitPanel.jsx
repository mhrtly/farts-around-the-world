import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { classifyEmission } from '../../config/humor.ts'

// Reverse geocode via free BigDataCloud API (no key needed, client-side)
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    )
    if (!res.ok) throw new Error('Geocode failed')
    const data = await res.json()
    const code = (data.countryCode || '').toUpperCase()
    const name = data.countryName || code
    return { code, name }
  } catch {
    return { code: 'XX', name: 'Unknown' }
  }
}

const MAX_RECORD_SECONDS = 10

const FLAG_EMOJIS = {
  US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA',
  FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5', CN:'\uD83C\uDDE8\uD83C\uDDF3',
  BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA',
  CA:'\uD83C\uDDE8\uD83C\uDDE6', MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA',
  NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
  AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9',
  TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
}

const btnBase = {
  fontFamily: 'monospace',
  fontWeight: 'bold',
  letterSpacing: '0.1em',
  border: '1px solid',
  borderRadius: '4px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'all 0.15s ease',
}

export default function SubmitPanel({ onClose }) {
  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recordingIdRef = useRef(0)

  // Web Audio analysis
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const volumeSamplesRef = useRef([])
  const peakVolumeRef = useRef(0)

  // Audio stats (after recording)
  const [audioStats, setAudioStats] = useState(null)
  const waveformCanvasRef = useRef(null)

  // Location state
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(null)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [sequence, setSequence] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)

  // Draw static waveform when audio blob is ready
  useEffect(() => {
    if (!audioBlob || !waveformCanvasRef.current) return
    const canvas = waveformCanvasRef.current
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    // Decode audio and draw waveform
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const buffer = await audioCtx.decodeAudioData(reader.result)
        const data = buffer.getChannelData(0)
        audioCtx.close()

        // Clear
        ctx.fillStyle = 'rgba(6,9,13,0.9)'
        ctx.fillRect(0, 0, w, h)

        // Draw center line
        ctx.strokeStyle = 'rgba(56,243,255,0.1)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(w, h / 2)
        ctx.stroke()

        // Sample the audio data into bars
        const barCount = 120
        const samplesPerBar = Math.floor(data.length / barCount)

        for (let i = 0; i < barCount; i++) {
          let sum = 0
          for (let j = 0; j < samplesPerBar; j++) {
            sum += Math.abs(data[i * samplesPerBar + j])
          }
          const avg = sum / samplesPerBar
          const barH = avg * h * 1.8
          const x = (i / barCount) * w
          const barW = (w / barCount) * 0.7

          // Gradient color based on amplitude
          const intensity = Math.min(avg * 4, 1)
          const r = Math.round(56 + intensity * 199)
          const g = Math.round(243 - intensity * 166)
          const b = Math.round(255 - intensity * 165)
          ctx.fillStyle = `rgba(${r},${g},${b},${0.5 + intensity * 0.4})`
          ctx.shadowColor = `rgba(${r},${g},${b},0.4)`
          ctx.shadowBlur = 4

          ctx.fillRect(x, (h - barH) / 2, barW, barH)
        }
        ctx.shadowBlur = 0
      } catch {
        // Fallback if decode fails
        ctx.fillStyle = 'rgba(6,9,13,0.9)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = 'rgba(56,243,255,0.3)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('WAVEFORM UNAVAILABLE', w / 2, h / 2 + 4)
      }
    }
    reader.readAsArrayBuffer(audioBlob)
  }, [audioBlob])

  // Auto-detect location on mount
  useEffect(() => {
    if (!location && !locating) detectLocation()
  }, [])

  // ESC key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      clearInterval(timerRef.current)
      cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported')
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const country = await reverseGeocode(lat, lng)
        setLocation({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), country: country.code, countryName: country.name })
        setLocating(false)
      },
      (err) => {
        setLocError(err.code === 1 ? 'Location access denied' : 'Location unavailable')
        setLocating(false)
      },
      { timeout: 8000, enableHighAccuracy: false }
    )
  }, [])

  // Draw live waveform on canvas
  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    const bufLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufLen)
    analyser.getByteTimeDomainData(data)

    // Calculate RMS volume
    let sum = 0
    for (let i = 0; i < bufLen; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / bufLen) * 100
    volumeSamplesRef.current.push(rms)
    if (rms > peakVolumeRef.current) peakVolumeRef.current = rms

    // Draw
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = 'rgba(6,9,13,0.3)'
    ctx.fillRect(0, 0, w, h)

    ctx.lineWidth = 2
    ctx.strokeStyle = '#ff4d5a'
    ctx.shadowColor = 'rgba(255,77,90,0.6)'
    ctx.shadowBlur = 6
    ctx.beginPath()

    const sliceWidth = w / bufLen
    let x = 0
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0
      const y = (v * h) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioStats(null)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)

    const currentId = ++recordingIdRef.current
    volumeSamplesRef.current = []
    peakVolumeRef.current = 0

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      if (currentId !== recordingIdRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      // Set up Web Audio analyser
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        if (currentId !== recordingIdRef.current) return
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 0) {
          setAudioBlob(blob)
          setAudioUrl(prev => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
        }
        // Calculate final stats
        const samples = volumeSamplesRef.current
        const avgVol = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0
        setAudioStats({
          avgVolume: Math.round(avgVol * 10) / 10,
          peakVolume: Math.round(peakVolumeRef.current * 10) / 10,
        })

        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        cancelAnimationFrame(animFrameRef.current)
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
        }
      }

      mediaRecorder.start(100)
      setRecording(true)
      setRecordTime(0)
      setAudioBlob(null)
      setAudioUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })

      // Start waveform drawing
      drawWaveform()

      let elapsed = 0
      timerRef.current = setInterval(() => {
        elapsed++
        setRecordTime(elapsed)
        if (elapsed >= MAX_RECORD_SECONDS) {
          mediaRecorder.stop()
          setRecording(false)
          clearInterval(timerRef.current)
        }
      }, 1000)
    } catch {
      setError('Microphone access denied')
    }
  }, [drawWaveform])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(timerRef.current)
  }, [])

  const resetRecording = useCallback(() => {
    recordingIdRef.current++
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setAudioBlob(null)
    setAudioStats(null)
    setRecordTime(0)
    setRecording(false)
    setConfirmed(false)
    setSequence(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!audioBlob) { setError('Record a fart first!'); return }
    if (!location) { setError('Location not detected'); return }

    setError(null)
    setSubmitting(true)
    setConfirmed(false)

    const steps = ['TRIANGULATING COORDINATES...', 'ANALYZING EMISSION SIGNATURE...', 'ENCODING AUDIO PAYLOAD...', 'FILING REPORT...']
    for (const step of steps) {
      setSequence(step)
      await new Promise(r => setTimeout(r, 600))
    }

    try {
      const reader = new FileReader()
      const audioBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          intensity: 5,
          country: location.country,
          type: 'standard',
          audioData: audioBase64,
          duration: recordTime,
          volume: audioStats?.avgVolume || null,
          peakVolume: audioStats?.peakVolume || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setSequence('CONFIRMED \u2014 EMISSION LOGGED')
      setConfirmed(true)
      await new Promise(r => setTimeout(r, 2000))
      resetRecording()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
      setSequence(null)
      setConfirmed(false)
    }
  }, [audioBlob, location, recordTime, audioStats, resetRecording, onClose])

  const volumeLabel = (vol) => {
    if (vol < 5) return 'Whisper'
    if (vol < 15) return 'Moderate'
    if (vol < 30) return 'Loud'
    if (vol < 50) return 'Very Loud'
    return 'Thunderous'
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,9,13,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          maxHeight: '90%',
          overflowY: 'auto',
          background: 'rgba(16,26,38,0.95)',
          border: '1px solid rgba(56,243,255,0.2)',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(56,243,255,0.1), 0 0 120px rgba(0,0,0,0.5)',
          padding: '32px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{
              fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.3em',
              color: '#ff6b6b', fontFamily: 'monospace', textTransform: 'uppercase',
            }}>
              Record a Fart
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.15em', fontFamily: 'monospace', marginTop: '2px' }}>
              AUDIO CAPTURE + GEOLOCATION
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              ...btnBase, padding: '4px 10px', fontSize: '11px',
              background: 'rgba(255,77,90,0.1)', borderColor: 'rgba(255,77,90,0.3)', color: '#ff4d5a',
            }}
          >
            ESC
          </button>
        </div>

        {/* Recording area */}
        {!audioBlob ? (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={submitting}
                style={{
                  ...btnBase, width: '100%', padding: '28px', fontSize: '20px',
                  background: 'rgba(255,77,90,0.12)', borderColor: '#ff6b6b', color: '#ff6b6b',
                  boxShadow: '0 0 30px rgba(255,77,90,0.25), 0 0 60px rgba(255,77,90,0.1)',
                  animation: 'pulseOpacity 2.5s ease-in-out infinite',
                }}
              >
                {'\uD83C\uDFA4'} RECORD
              </button>
            ) : (
              <>
                <div style={{
                  fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace',
                  color: '#ff4d5a', marginBottom: '12px',
                  animation: 'pulseOpacity 1s ease-in-out infinite',
                }}>
                  {'\u23FA'} {recordTime}s / {MAX_RECORD_SECONDS}s
                </div>
                <canvas
                  ref={canvasRef}
                  width={456}
                  height={80}
                  style={{
                    width: '100%', height: '80px',
                    border: '1px solid rgba(255,77,90,0.2)',
                    borderRadius: '4px', background: 'rgba(6,9,13,0.8)',
                    marginBottom: '12px',
                  }}
                />
                <div style={{
                  width: '100%', height: '4px', background: 'rgba(255,77,90,0.2)',
                  borderRadius: '2px', marginBottom: '12px', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(recordTime / MAX_RECORD_SECONDS) * 100}%`,
                    height: '100%', background: '#ff4d5a', borderRadius: '2px',
                    transition: 'width 1s linear',
                  }} />
                </div>
                <button
                  onClick={stopRecording}
                  style={{
                    ...btnBase, width: '100%', padding: '16px', fontSize: '16px',
                    background: 'rgba(255,77,90,0.25)', borderColor: '#ff4d5a', color: '#ffffff',
                    boxShadow: '0 0 20px rgba(255,77,90,0.3)',
                  }}
                >
                  {'\u23F9'} STOP RECORDING
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              background: 'rgba(6,9,13,0.6)', border: '1px solid rgba(56,243,255,0.1)',
              borderRadius: '6px', padding: '16px', marginBottom: '16px',
            }}>
              <div style={{
                fontSize: '9px', color: '#9dff4a', letterSpacing: '0.15em',
                marginBottom: '10px', fontFamily: 'monospace',
              }}>
                {'\u2713'} EMISSION CAPTURED
              </div>
              <canvas
                ref={waveformCanvasRef}
                width={456}
                height={60}
                style={{
                  width: '100%', height: '60px',
                  border: '1px solid rgba(56,243,255,0.1)',
                  borderRadius: '4px', marginBottom: '10px',
                }}
              />
              <audio controls src={audioUrl} style={{ width: '100%', height: '36px', marginBottom: '12px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: '4px' }}>DURATION</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38f3ff', fontFamily: 'monospace' }}>{recordTime}s</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: '4px' }}>AVG VOLUME</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38f3ff', fontFamily: 'monospace' }}>{audioStats?.avgVolume?.toFixed(1) || '0'}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-label)', fontFamily: 'monospace' }}>{volumeLabel(audioStats?.avgVolume || 0)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: '4px' }}>PEAK</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff6b6b', fontFamily: 'monospace' }}>{audioStats?.peakVolume?.toFixed(1) || '0'}</div>
                </div>
              </div>
              {(() => {
                const cls = classifyEmission(recordTime, audioStats?.avgVolume)
                return (
                  <div style={{
                    padding: '12px', borderRadius: '4px',
                    background: 'rgba(6,9,13,0.6)',
                    border: `1px solid ${cls.color}33`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '8px', padding: '2px 6px', borderRadius: '3px',
                        background: `${cls.color}22`, border: `1px solid ${cls.color}44`,
                        color: cls.color, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.15em',
                      }}>
                        {cls.code}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: cls.color, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                        {cls.label.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-label)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                      {cls.description}
                    </div>
                  </div>
                )
              })()}
            </div>
            <button
              onClick={resetRecording}
              disabled={submitting}
              style={{
                ...btnBase, width: '100%', padding: '8px', fontSize: '11px',
                background: 'rgba(255,77,90,0.1)', borderColor: 'rgba(255,77,90,0.3)',
                color: '#ff4d5a', marginBottom: '12px',
              }}
            >
              {'\u21BA'} RE-RECORD
            </button>
          </div>
        )}

        {/* Location */}
        <div style={{
          marginBottom: '16px', padding: '12px',
          background: 'rgba(6,9,13,0.4)', border: '1px solid rgba(56,243,255,0.08)',
          borderRadius: '4px',
        }}>
          <div style={{ fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: '6px' }}>GEOLOCATION</div>
          {locating ? (
            <div style={{ fontSize: '11px', color: '#38f3ff', fontFamily: 'monospace', animation: 'pulseOpacity 1s infinite' }}>ACQUIRING POSITION...</div>
          ) : location ? (
            <div style={{ fontSize: '12px', color: '#9dff4a', fontFamily: 'monospace' }}>
              {FLAG_EMOJIS[location.country] || '\uD83C\uDF0D'} {location.countryName} ({location.lat}{'\u00B0'}, {location.lng}{'\u00B0'})
            </div>
          ) : (
            <button
              onClick={detectLocation}
              style={{
                ...btnBase, padding: '6px 12px', fontSize: '11px',
                background: locError ? 'rgba(255,176,32,0.12)' : 'rgba(56,243,255,0.1)',
                borderColor: locError ? '#ffb020' : '#38f3ff',
                color: locError ? '#ffb020' : '#38f3ff',
              }}
            >
              {locError || 'DETECT LOCATION'}
            </button>
          )}
        </div>

        {error && (
          <div style={{
            fontSize: '11px', color: '#ff4d5a', fontFamily: 'monospace',
            marginBottom: '12px', padding: '8px',
            background: 'rgba(255,77,90,0.1)', borderRadius: '4px',
            border: '1px solid rgba(255,77,90,0.2)',
          }}>
            {error}
          </div>
        )}

        {submitting ? (
          <div style={{
            textAlign: 'center', fontSize: '13px', fontFamily: 'monospace',
            fontWeight: 'bold', letterSpacing: '0.1em',
            color: confirmed ? '#9dff4a' : '#38f3ff',
            padding: '16px',
            animation: confirmed ? 'none' : 'pulseOpacity 1.5s infinite',
          }}>
            {sequence}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!audioBlob || !location}
            style={{
              ...btnBase, width: '100%', padding: '16px', fontSize: '14px',
              background: (!audioBlob || !location) ? 'rgba(56,243,255,0.05)' : 'rgba(56,243,255,0.15)',
              borderColor: (!audioBlob || !location) ? 'rgba(56,243,255,0.2)' : '#38f3ff',
              color: (!audioBlob || !location) ? 'rgba(56,243,255,0.3)' : '#38f3ff',
              boxShadow: (!audioBlob || !location) ? 'none' : '0 0 20px rgba(56,243,255,0.25)',
              cursor: (!audioBlob || !location) ? 'not-allowed' : 'pointer',
            }}
          >
            TRANSMIT EMISSION
          </button>
        )}
      </div>
    </div>
  )
}
