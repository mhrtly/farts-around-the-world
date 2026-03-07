import { useState, useCallback, useRef, useEffect } from 'react'

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

const INTENSITY_LABELS = {
  1: 'Whisper', 2: 'Gentle', 3: 'Mild', 4: 'Moderate', 5: 'Notable',
  6: 'Significant', 7: 'Substantial', 8: 'Severe', 9: 'Extreme', 10: 'Catastrophic',
}

const MAX_RECORD_SECONDS = 10

// Shared button base style
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

export default function SubmitPanel() {
  const [expanded, setExpanded] = useState(false)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recordingIdRef = useRef(0) // prevents stale onstop callbacks

  // Location state
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(null)

  // Form state
  const [intensity, setIntensity] = useState(5)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [sequence, setSequence] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)

  // Auto-detect location when panel opens
  useEffect(() => {
    if (expanded && !location && !locating) {
      detectLocation()
    }
  }, [expanded])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
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
        setLocError(err.code === 1 ? 'Location access denied — tap to retry' : 'Location unavailable')
        setLocating(false)
      },
      { timeout: 8000, enableHighAccuracy: false }
    )
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)

    // Fully clean up any previous recording state
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    clearInterval(timerRef.current)

    const currentId = ++recordingIdRef.current

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Check if this recording was cancelled while awaiting permission
      if (currentId !== recordingIdRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        // Ignore if this is a stale callback from a previous recording
        if (currentId !== recordingIdRef.current) return

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 0) {
          setAudioBlob(blob)
          setAudioUrl(prev => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
        }
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      mediaRecorder.start(100)
      setRecording(true)
      setRecordTime(0)
      setAudioBlob(null)
      setAudioUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })

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
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(timerRef.current)
  }, [])

  const resetRecording = useCallback(() => {
    // Bump recording ID to invalidate any pending onstop
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

    setAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setAudioBlob(null)
    setRecordTime(0)
    setRecording(false)
    setConfirmed(false)
    setSequence(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!audioBlob) { setError('Record a fart first!'); return }
    if (!location) { setError('Location not detected — tap location button'); return }

    setError(null)
    setSubmitting(true)
    setConfirmed(false)

    const steps = ['TRIANGULATING COORDINATES...', 'ANALYZING EMISSION...', 'UPLOADING AUDIO...', 'FILING REPORT...']
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
          intensity,
          country: location.country,
          type: 'standard',
          audioData: audioBase64,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setSequence('CONFIRMED — FART LOGGED')
      setConfirmed(true)
      await new Promise(r => setTimeout(r, 2000))
      resetRecording()
      setExpanded(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
      setSequence(null)
      setConfirmed(false)
    }
  }, [audioBlob, location, intensity, resetRecording])

  return (
    <div className="panel submit-panel">
      <div className="panel-header">
        <span className="panel-header-title">INTEL SUBMISSION</span>
        <button
          style={{
            ...btnBase,
            padding: '6px 14px',
            fontSize: '11px',
            background: expanded ? 'rgba(255,77,90,0.15)' : 'rgba(56,243,255,0.15)',
            borderColor: expanded ? '#ff4d5a' : '#38f3ff',
            color: expanded ? '#ff4d5a' : '#38f3ff',
          }}
          onClick={() => { setExpanded(e => !e); setError(null) }}
        >
          {expanded ? 'CLOSE' : '\u2B06 FILE REPORT'}
        </button>
      </div>

      {expanded && (
        <div className="panel-content">
          <div className="submit-form">

            {/* --- RECORD / STOP / REVIEW --- */}
            {!audioBlob ? (
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                {!recording ? (
                  /* IDLE — show big record button */
                  <button
                    onClick={startRecording}
                    disabled={submitting}
                    style={{
                      ...btnBase,
                      width: '100%',
                      padding: '14px',
                      fontSize: '15px',
                      background: 'rgba(255,77,90,0.12)',
                      borderColor: '#ff6b6b',
                      color: '#ff6b6b',
                      boxShadow: '0 0 12px rgba(255,77,90,0.15)',
                    }}
                  >
                    {'\uD83C\uDFA4'} RECORD FART
                  </button>
                ) : (
                  /* RECORDING — show timer + prominent STOP button */
                  <>
                    <div style={{
                      fontSize: '22px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      color: '#ff4d5a',
                      marginBottom: '8px',
                      animation: 'pulseOpacity 1s ease-in-out infinite',
                    }}>
                      {'\u23FA'} {recordTime}s / {MAX_RECORD_SECONDS}s
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,77,90,0.2)',
                      borderRadius: '2px',
                      marginBottom: '10px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${(recordTime / MAX_RECORD_SECONDS) * 100}%`,
                        height: '100%',
                        background: '#ff4d5a',
                        borderRadius: '2px',
                        transition: 'width 1s linear',
                      }} />
                    </div>
                    <button
                      onClick={stopRecording}
                      style={{
                        ...btnBase,
                        width: '100%',
                        padding: '12px',
                        fontSize: '14px',
                        background: 'rgba(255,77,90,0.25)',
                        borderColor: '#ff4d5a',
                        color: '#ffffff',
                        boxShadow: '0 0 20px rgba(255,77,90,0.3)',
                      }}
                    >
                      {'\u23F9'} STOP RECORDING
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* --- PLAYBACK REVIEW --- */
              <div style={{ marginBottom: '10px' }}>
                <div style={{
                  fontSize: '10px',
                  color: '#9dff4a',
                  letterSpacing: '0.1em',
                  marginBottom: '6px',
                  fontFamily: 'monospace',
                }}>
                  {'\u2713'} RECORDED {recordTime}s
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <audio controls src={audioUrl} style={{ flex: 1, height: '32px' }} />
                  <button
                    onClick={resetRecording}
                    disabled={submitting}
                    style={{
                      ...btnBase,
                      padding: '6px 10px',
                      fontSize: '11px',
                      background: 'rgba(255,77,90,0.15)',
                      borderColor: '#ff4d5a',
                      color: '#ff4d5a',
                    }}
                    title="Re-record"
                  >
                    {'\u21BA'}
                  </button>
                </div>
              </div>
            )}

            {/* --- LOCATION --- */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-label, #6a7a8a)',
                letterSpacing: '0.1em',
                marginBottom: '4px',
                fontFamily: 'monospace',
              }}>
                LOCATION
              </div>
              {locating ? (
                <div style={{
                  fontSize: '11px',
                  color: '#38f3ff',
                  letterSpacing: '1px',
                  fontFamily: 'monospace',
                  animation: 'pulseOpacity 1s infinite',
                }}>
                  DETECTING POSITION...
                </div>
              ) : location ? (
                <div style={{ fontSize: '11px', color: '#9dff4a', fontFamily: 'monospace' }}>
                  {'\u2713'} {location.countryName} ({location.lat}\u00B0, {location.lng}\u00B0)
                </div>
              ) : (
                <button
                  onClick={detectLocation}
                  style={{
                    ...btnBase,
                    padding: '6px 12px',
                    fontSize: '11px',
                    background: locError ? 'rgba(255,176,32,0.12)' : 'rgba(56,243,255,0.1)',
                    borderColor: locError ? '#ffb020' : '#38f3ff',
                    color: locError ? '#ffb020' : '#38f3ff',
                  }}
                >
                  {locError || 'DETECT LOCATION'}
                </button>
              )}
            </div>

            {/* --- INTENSITY --- */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-label, #6a7a8a)',
                letterSpacing: '0.1em',
                marginBottom: '4px',
                fontFamily: 'monospace',
              }}>
                INTENSITY — <span style={{ color: '#38f3ff' }}>{intensity} / {INTENSITY_LABELS[intensity]}</span>
              </div>
              <input
                className="slider"
                type="range"
                min="1" max="10"
                value={intensity}
                onChange={e => setIntensity(parseInt(e.target.value))}
                disabled={submitting}
              />
            </div>

            {error && (
              <div style={{
                fontSize: '11px',
                color: '#ff4d5a',
                fontFamily: 'monospace',
                marginBottom: '8px',
                padding: '6px',
                background: 'rgba(255,77,90,0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(255,77,90,0.2)',
              }}>
                {error}
              </div>
            )}

            {submitting ? (
              <div style={{
                textAlign: 'center',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '0.1em',
                color: confirmed ? '#9dff4a' : '#38f3ff',
                padding: '12px',
                animation: confirmed ? 'none' : 'pulseOpacity 1.5s infinite',
              }}>
                {sequence}
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!audioBlob || !location}
                style={{
                  ...btnBase,
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  background: (!audioBlob || !location) ? 'rgba(56,243,255,0.05)' : 'rgba(56,243,255,0.15)',
                  borderColor: (!audioBlob || !location) ? 'rgba(56,243,255,0.2)' : '#38f3ff',
                  color: (!audioBlob || !location) ? 'rgba(56,243,255,0.3)' : '#38f3ff',
                  boxShadow: (!audioBlob || !location) ? 'none' : '0 0 16px rgba(56,243,255,0.2)',
                  cursor: (!audioBlob || !location) ? 'not-allowed' : 'pointer',
                }}
              >
                TRANSMIT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
