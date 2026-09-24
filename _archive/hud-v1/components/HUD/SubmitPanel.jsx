import { useState, useCallback, useRef, useEffect } from 'react'
import { classifyEmission } from '../../config/humor.ts'
import CustomAudioPlayer from './CustomAudioPlayer.jsx'

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

const AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
]

const DIAGNOSTIC_COLORS = {
  info: '#38f3ff',
  success: '#9dff4a',
  warn: '#ffb020',
  error: '#ff4d5a',
}

const SIGNAL_TRACE_STAGES = [
  { key: 'GEO', label: 'Geo Fix' },
  { key: 'MIC', label: 'Mic Hot' },
  { key: 'RECORDER', label: 'Capture' },
  { key: 'ENCODER', label: 'Encode' },
  { key: 'UPLINK', label: 'Uplink' },
  { key: 'DATABASE', label: 'Database' },
  { key: 'MAP', label: 'Map Echo' },
]

const TRACE_LEVEL_LABELS = {
  info: 'LIVE',
  success: 'LOCKED',
  warn: 'WARN',
  error: 'FAULT',
}

function getRecorderProfile() {
  if (typeof MediaRecorder === 'undefined') {
    return { options: null, mimeType: '', supported: false }
  }

  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return { options: null, mimeType: '', supported: true }
  }

  const mimeType = AUDIO_RECORDER_MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || ''
  return {
    options: mimeType ? { mimeType } : null,
    mimeType,
    supported: true,
  }
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function formatTraceTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getLatestDiagnosticForStage(diagnostics, stage) {
  return diagnostics.find(item => item.stage === stage) || null
}

export default function SubmitPanel({ onClose }) {
  const isCompact = window.innerWidth <= 768
  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioMimeType, setAudioMimeType] = useState('')
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recordingIdRef = useRef(0)
  const audioMimeTypeRef = useRef('')
  const diagnosticIdRef = useRef(0)

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
  const [diagnostics, setDiagnostics] = useState([])
  const [serverTrace, setServerTrace] = useState({ requestId: null, eventId: null, code: null })

  const pushDiagnostic = useCallback((level, stage, message) => {
    const entry = {
      id: ++diagnosticIdRef.current,
      level,
      stage,
      message,
      timestamp: Date.now(),
    }

    setDiagnostics(prev => [entry, ...prev].slice(0, 8))
  }, [])

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
        pushDiagnostic('warn', 'WAVEFORM', 'Browser could not decode the waveform preview, but playback may still work')
      }
    }
    reader.readAsArrayBuffer(audioBlob)
  }, [audioBlob, pushDiagnostic])

  useEffect(() => {
    pushDiagnostic('info', 'SYSTEM', 'Submission diagnostics online')
  }, [pushDiagnostic])

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
      pushDiagnostic('error', 'GEO', 'Browser does not expose geolocation')
      return
    }
    setLocating(true)
    setLocError(null)
    pushDiagnostic('info', 'GEO', 'Requesting device coordinates')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const country = await reverseGeocode(lat, lng)
        setLocation({ lat: +lat.toFixed(4), lng: +lng.toFixed(4), country: country.code, countryName: country.name })
        setLocating(false)
        pushDiagnostic(
          country.code === 'XX' ? 'warn' : 'success',
          'GEO',
          `${country.name} locked at ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        )
      },
      (err) => {
        setLocError(err.code === 1 ? 'Location access denied' : 'Location unavailable')
        setLocating(false)
        pushDiagnostic('error', 'GEO', err.code === 1 ? 'Location access denied by user' : 'Location fix unavailable')
      },
      { timeout: 8000, enableHighAccuracy: false }
    )
  }, [pushDiagnostic])

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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone capture')
      }

      const recorderProfile = getRecorderProfile()
      if (!recorderProfile.supported) {
        throw new Error('This browser does not support in-browser recording')
      }

      pushDiagnostic('info', 'MIC', 'Requesting microphone access')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      if (currentId !== recordingIdRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      pushDiagnostic('success', 'MIC', 'Microphone stream acquired')

      // Set up Web Audio analyser
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = recorderProfile.options
        ? new MediaRecorder(stream, recorderProfile.options)
        : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioMimeTypeRef.current = mediaRecorder.mimeType || recorderProfile.mimeType || ''
      setAudioMimeType(audioMimeTypeRef.current)
      chunksRef.current = []
      pushDiagnostic(
        'info',
        'RECORDER',
        audioMimeTypeRef.current
          ? `Recorder initialized with ${audioMimeTypeRef.current}`
          : 'Recorder initialized with browser default audio format'
      )

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onerror = (event) => {
        const message = event.error?.message || 'MediaRecorder emitted an error'
        setError(message)
        pushDiagnostic('error', 'RECORDER', message)
      }

      mediaRecorder.onstop = () => {
        if (currentId !== recordingIdRef.current) return
        const resolvedMimeType =
          chunksRef.current.find(chunk => chunk.size > 0)?.type ||
          mediaRecorder.mimeType ||
          audioMimeTypeRef.current ||
          ''
        const blob = resolvedMimeType
          ? new Blob(chunksRef.current, { type: resolvedMimeType })
          : new Blob(chunksRef.current)

        audioMimeTypeRef.current = resolvedMimeType
        setAudioMimeType(resolvedMimeType)

        if (blob.size > 0) {
          setAudioBlob(blob)
          setAudioUrl(prev => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
          pushDiagnostic(
            'success',
            'RECORDER',
            `Capture ready: ${formatBytes(blob.size)} ${resolvedMimeType || 'unknown format'}`
          )
        } else {
          setError('Recording finished without usable audio data')
          pushDiagnostic('error', 'RECORDER', 'Capture ended with zero audio bytes')
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
      pushDiagnostic('success', 'RECORDER', 'Recording started')
      setRecording(true)
      setRecordTime(0)
      setAudioBlob(null)
      setAudioMimeType('')
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
    } catch (err) {
      const message = err?.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : err?.message || 'Unable to start recording'
      setError(message)
      pushDiagnostic('error', 'MIC', message)
    }
  }, [drawWaveform, pushDiagnostic])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(timerRef.current)
    pushDiagnostic('info', 'RECORDER', 'Recording stopped by operator')
  }, [pushDiagnostic])

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
    setAudioMimeType('')
    audioMimeTypeRef.current = ''
    setAudioStats(null)
    setRecordTime(0)
    setRecording(false)
    setConfirmed(false)
    setSequence(null)
    setServerTrace({ requestId: null, eventId: null, code: null })
    pushDiagnostic('info', 'RECORDER', 'Capture buffer cleared')
  }, [pushDiagnostic])

  const handleSubmit = useCallback(async () => {
    if (!audioBlob) {
      setError('Record a fart first!')
      pushDiagnostic('warn', 'UPLINK', 'Transmit blocked: no recording is loaded')
      return
    }
    if (!location) {
      setError('Location not detected')
      pushDiagnostic('warn', 'UPLINK', 'Transmit blocked: no location fix is available')
      return
    }

    setError(null)
    setSubmitting(true)
    setConfirmed(false)

    const steps = [
      'TRIANGULATING COORDINATES...',
      'ANALYZING EMISSION SIGNATURE...',
      'ENCODING AUDIO PAYLOAD...',
      'UPLOADING TO GLOBAL DATABASE...',
      'NOTIFYING MONITORING STATIONS...',
    ]
    for (const step of steps) {
      setSequence(step)
      await new Promise(r => setTimeout(r, 500))
    }

    try {
      const reader = new FileReader()
      pushDiagnostic('info', 'ENCODER', 'Encoding capture to base64 payload')
      const audioBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : ''
          const encoded = result.split(',')[1] || ''
          if (!encoded) {
            reject(new Error('Audio encoding returned an empty payload'))
            return
          }
          resolve(encoded)
        }
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })
      pushDiagnostic(
        'success',
        'ENCODER',
        `Payload ready: ${formatBytes(audioBlob.size)} ${audioMimeTypeRef.current || audioBlob.type || 'unknown format'}`
      )

      pushDiagnostic('info', 'UPLINK', 'Posting event to /api/events')
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
          audioMimeType: audioMimeTypeRef.current || audioBlob.type || null,
          duration: recordTime,
          volume: audioStats?.avgVolume || null,
          peakVolume: audioStats?.peakVolume || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const details = Array.isArray(body?.details) && body.details.length > 0
          ? `: ${body.details.join('; ')}`
          : ''
        const apiError = new Error(`${body?.error || `HTTP ${res.status}`}${details}`)
        apiError.stage = body?.stage || null
        apiError.code = body?.code || null
        apiError.requestId = body?.requestId || null
        throw apiError
      }

      const createdEvent = await res.json()
      const requestId = createdEvent?.ingest?.requestId || null
      setServerTrace({
        requestId,
        eventId: createdEvent.id,
        code: createdEvent?.ingest?.stage || 'stored',
      })
      pushDiagnostic('success', 'UPLINK', `Transmit complete: event ${createdEvent.id.slice(0, 8)} acknowledged`)
      pushDiagnostic(
        'success',
        'DATABASE',
        requestId
          ? `Stored in SQLite under request ${requestId}`
          : `Stored in SQLite as ${createdEvent.id.slice(0, 8)}`
      )
      window.dispatchEvent(new CustomEvent('fatwa:recorded', { detail: createdEvent }))
      pushDiagnostic('success', 'MAP', `Local dashboard received event ${createdEvent.id.slice(0, 8)}`)

      const cls = classifyEmission(recordTime, audioStats?.avgVolume)
      setSequence(cls.label.toUpperCase())
      setConfirmed(true)
      await new Promise(r => setTimeout(r, 3000))
      resetRecording()
      onClose()
    } catch (err) {
      const stage = err?.stage === 'parse'
        ? 'UPLINK'
        : err?.stage === 'validation'
          ? 'DATABASE'
          : err?.stage === 'storage'
            ? 'DATABASE'
            : 'UPLINK'
      const message = err?.message || 'Transmit failed'
      setServerTrace({
        requestId: err?.requestId || null,
        eventId: null,
        code: err?.code || null,
      })
      setError(message)
      pushDiagnostic(
        'error',
        stage,
        err?.requestId
          ? `${message} [${err.requestId}]`
          : message
      )
    } finally {
      setSubmitting(false)
      setSequence(null)
      setConfirmed(false)
    }
  }, [audioBlob, location, recordTime, audioStats, resetRecording, onClose, pushDiagnostic])

  const volumeLabel = (vol) => {
    if (vol < 5) return 'Whisper'
    if (vol < 15) return 'Moderate'
    if (vol < 30) return 'Loud'
    if (vol < 50) return 'Very Loud'
    return 'Thunderous'
  }

  const stageEntries = SIGNAL_TRACE_STAGES.map(stage => ({
    ...stage,
    entry: getLatestDiagnosticForStage(diagnostics, stage.key),
  }))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: isCompact ? 'stretch' : 'center',
        justifyContent: 'center',
        background: 'rgba(6,9,13,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        padding: isCompact ? '0' : '20px',
        animation: 'modalBackdropIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: isCompact ? '100%' : '520px',
          maxHeight: isCompact ? '100%' : '90%',
          height: isCompact ? '100%' : 'auto',
          overflowY: 'auto',
          background: 'rgba(16,26,38,0.95)',
          border: isCompact ? 'none' : '1px solid rgba(56,243,255,0.2)',
          borderRadius: isCompact ? '0' : '8px',
          boxShadow: '0 0 60px rgba(56,243,255,0.1), 0 0 120px rgba(0,0,0,0.5)',
          padding: isCompact ? '20px 16px calc(28px + env(safe-area-inset-bottom))' : '32px',
          animation: 'modalContentIn 0.25s ease-out',
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
              <div style={{ marginBottom: '12px' }}>
                <CustomAudioPlayer
                  src={audioUrl}
                  color="#9dff4a"
                  onReady={(duration) => {
                    pushDiagnostic('success', 'PREVIEW', `Preview ready (${duration.toFixed(1)}s)`)
                  }}
                  onPlayStateChange={(playing) => {
                    pushDiagnostic('info', 'PREVIEW', playing ? 'Preview playback started' : 'Preview playback stopped')
                  }}
                  onPlaybackError={(message) => {
                    setError(message)
                    pushDiagnostic('error', 'PREVIEW', message)
                  }}
                />
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                marginBottom: '12px', flexWrap: 'wrap',
              }}>
                <div style={{
                  fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.16em',
                  fontFamily: 'monospace',
                }}>
                  FORMAT {audioMimeType || audioBlob.type || 'UNKNOWN'}
                </div>
                <div style={{
                  fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '0.16em',
                  fontFamily: 'monospace',
                }}>
                  SIZE {formatBytes(audioBlob.size)}
                </div>
              </div>
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

        <div style={{
          marginBottom: '14px',
          padding: '12px',
          background: 'rgba(6,9,13,0.55)',
          border: '1px solid rgba(56,243,255,0.12)',
          borderRadius: '6px',
          boxShadow: 'inset 0 0 30px rgba(56,243,255,0.04)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
          }}>
            <div style={{
              fontSize: '8px',
              color: '#38f3ff',
              letterSpacing: '0.22em',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}>
              SIGNAL TRACE
            </div>
            <div style={{
              fontSize: '8px',
              color: 'var(--text-dim)',
              letterSpacing: '0.12em',
              fontFamily: 'monospace',
            }}>
              LIVE DIAGNOSTICS
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
            gap: '8px',
            marginBottom: '12px',
          }}>
            {stageEntries.map(stage => {
              const level = stage.entry?.level || null
              const color = level ? DIAGNOSTIC_COLORS[level] : 'rgba(255,255,255,0.18)'
              const tone = level ? `${color}18` : 'rgba(255,255,255,0.03)'
              const label = level ? TRACE_LEVEL_LABELS[level] : 'IDLE'

              return (
                <div
                  key={stage.key}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${level ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
                    background: tone,
                    boxShadow: level ? `0 0 20px ${color}10` : 'none',
                  }}
                >
                  <div style={{
                    fontSize: '8px',
                    color,
                    fontFamily: 'monospace',
                    letterSpacing: '0.18em',
                    marginBottom: '6px',
                  }}>
                    {stage.label.toUpperCase()}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: level ? color : 'var(--text-dim)',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    letterSpacing: '0.12em',
                  }}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
          {(serverTrace.requestId || serverTrace.eventId || serverTrace.code) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
              marginBottom: '10px',
            }}>
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(56,243,255,0.08)',
                border: '1px solid rgba(56,243,255,0.16)',
              }}>
                <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: '0.14em', marginBottom: '4px' }}>
                  TRACE ID
                </div>
                <div style={{ fontSize: '10px', color: '#38f3ff', fontFamily: 'monospace', letterSpacing: '0.06em', wordBreak: 'break-all' }}>
                  {serverTrace.requestId || 'PENDING'}
                </div>
              </div>
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(157,255,74,0.08)',
                border: '1px solid rgba(157,255,74,0.16)',
              }}>
                <div style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: '0.14em', marginBottom: '4px' }}>
                  EVENT / CODE
                </div>
                <div style={{ fontSize: '10px', color: '#9dff4a', fontFamily: 'monospace', letterSpacing: '0.06em', wordBreak: 'break-all' }}>
                  {serverTrace.eventId || serverTrace.code || 'STANDBY'}
                </div>
              </div>
            </div>
          )}
          <div style={{
            display: 'grid',
            gap: '8px',
            maxHeight: '176px',
            overflowY: 'auto',
          }}>
            {diagnostics.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 78px 1fr',
                  gap: '8px',
                  alignItems: 'start',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${DIAGNOSTIC_COLORS[item.level]}22`,
                  background: `${DIAGNOSTIC_COLORS[item.level]}0d`,
                  boxShadow: `0 0 16px ${DIAGNOSTIC_COLORS[item.level]}12`,
                }}
              >
                <div style={{
                  fontSize: '8px',
                  color: 'var(--text-dim)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                }}>
                  {formatTraceTime(item.timestamp)}
                </div>
                <div style={{
                  fontSize: '8px',
                  color: DIAGNOSTIC_COLORS[item.level],
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  letterSpacing: '0.14em',
                }}>
                  {item.stage}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-label)',
                  fontFamily: 'monospace',
                  lineHeight: 1.4,
                }}>
                  {item.message}
                </div>
              </div>
            ))}
          </div>
        </div>

        {submitting ? (
          confirmed ? (
            <div style={{
              textAlign: 'center', padding: '24px 16px',
              background: 'rgba(157,255,74,0.05)',
              border: '1px solid rgba(157,255,74,0.2)',
              borderRadius: '6px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{'\uD83D\uDCA8'}</div>
              <div style={{
                fontSize: '10px', letterSpacing: '0.3em', color: '#9dff4a',
                fontFamily: 'monospace', marginBottom: '6px',
              }}>
                EMISSION LOGGED
              </div>
              <div style={{
                fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.15em',
                color: '#9dff4a', fontFamily: 'monospace',
                textShadow: '0 0 20px rgba(157,255,74,0.5)',
              }}>
                {sequence}
              </div>
              <div style={{
                fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace',
                letterSpacing: '0.1em', marginTop: '10px',
              }}>
                Your contribution to the global dataset is recorded.
              </div>
              <div style={{
                fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace',
                letterSpacing: '0.1em', marginTop: '4px',
              }}>
                The world thanks you.
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '16px',
            }}>
              <div style={{
                fontSize: '13px', fontFamily: 'monospace',
                fontWeight: 'bold', letterSpacing: '0.1em',
                color: '#38f3ff',
                animation: 'pulseOpacity 1.5s infinite',
              }}>
                {sequence}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '4px',
                marginTop: '12px',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#38f3ff',
                    animation: `pulseOpacity 1s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )
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
