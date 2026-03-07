import { useState, useCallback, useRef, useEffect } from 'react'

// Supported country codes for the app
const SUPPORTED_COUNTRIES = new Set([
  'US', 'GB', 'DE', 'FR', 'JP', 'CN', 'BR', 'IN', 'AU', 'CA',
  'MX', 'RU', 'NG', 'ZA', 'EG', 'AR', 'KR', 'ID', 'TR', 'IT',
])

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
    // Map to supported country or keep raw code
    return { code: SUPPORTED_COUNTRIES.has(code) ? code : code, name }
  } catch {
    return { code: 'XX', name: 'Unknown' }
  }
}

const INTENSITY_LABELS = {
  1: 'Whisper', 2: 'Gentle', 3: 'Mild', 4: 'Moderate', 5: 'Notable',
  6: 'Significant', 7: 'Substantial', 8: 'Severe', 9: 'Extreme', 10: 'Catastrophic',
}

const MAX_RECORD_SECONDS = 10

export default function SubmitPanel() {
  const [expanded, setExpanded] = useState(false)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  // Location state
  const [location, setLocation] = useState(null) // { lat, lng, country }
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

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }
  }, [audioUrl])

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start(100) // collect data every 100ms
      setRecording(true)
      setRecordTime(0)
      setAudioBlob(null)
      setAudioUrl(null)

      // Timer
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
      setError('Microphone access denied')
    }
  }, [audioUrl])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(timerRef.current)
  }, [])

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordTime(0)
    setConfirmed(false)
    setSequence(null)
  }, [audioUrl])

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
      // Convert audio blob to base64
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
          className="btn btn-primary btn-sm"
          onClick={() => { setExpanded(e => !e); setError(null) }}
        >
          {expanded ? 'CLOSE' : '⬆ FILE REPORT'}
        </button>
      </div>

      {expanded && (
        <div className="panel-content">
          <div className="submit-form">

            {/* --- RECORD BUTTON --- */}
            {!audioBlob ? (
              <div className="submit-field" style={{ textAlign: 'center' }}>
                <button
                  className={`btn btn-lg record-btn${recording ? ' record-btn--active' : ''}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    letterSpacing: '2px',
                    background: recording ? 'rgba(255,77,90,0.2)' : 'rgba(255,77,90,0.1)',
                    borderColor: recording ? '#ff4d5a' : '#ff6b6b',
                    color: recording ? '#ff4d5a' : '#ff6b6b',
                    boxShadow: recording ? '0 0 20px rgba(255,77,90,0.3)' : 'none',
                    animation: recording ? 'pulseOpacity 1s ease-in-out infinite' : 'none',
                  }}
                >
                  {recording ? `⏺ RECORDING... ${recordTime}s / ${MAX_RECORD_SECONDS}s` : '🎙 RECORD FART'}
                </button>
                {recording && (
                  <div style={{ marginTop: '6px', fontSize: '10px', color: '#8a8a8a', letterSpacing: '1px' }}>
                    TAP AGAIN TO STOP
                  </div>
                )}
              </div>
            ) : (
              /* --- PLAYBACK --- */
              <div className="submit-field">
                <label className="submit-label">RECORDED ({recordTime}s)</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <audio controls src={audioUrl} style={{ flex: 1, height: '32px' }} />
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={resetRecording}
                    disabled={submitting}
                    title="Re-record"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* --- LOCATION --- */}
            <div className="submit-field">
              <label className="submit-label">LOCATION</label>
              {locating ? (
                <div style={{ fontSize: '11px', color: '#38f3ff', letterSpacing: '1px', animation: 'pulseOpacity 1s infinite' }}>
                  DETECTING POSITION...
                </div>
              ) : location ? (
                <div style={{ fontSize: '11px', color: '#9dff4a' }}>
                  {location.countryName} ({location.lat}°, {location.lng}°)
                </div>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={detectLocation}
                  style={{ fontSize: '10px' }}
                >
                  {locError || 'DETECT LOCATION'}
                </button>
              )}
            </div>

            {/* --- INTENSITY --- */}
            <div className="submit-field">
              <label className="submit-label">
                INTENSITY — <span className="submit-intensity-value">{intensity} / {INTENSITY_LABELS[intensity]}</span>
              </label>
              <input
                className="slider"
                type="range"
                min="1" max="10"
                value={intensity}
                onChange={e => setIntensity(parseInt(e.target.value))}
                disabled={submitting}
              />
            </div>

            {error && <div className="submit-error">{error}</div>}

            {submitting ? (
              <div className={`submit-sequence${confirmed ? ' submit-sequence--confirmed' : ''}`}>
                {sequence}
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg submit-transmit-btn"
                onClick={handleSubmit}
                disabled={!audioBlob || !location}
                style={{ opacity: (!audioBlob || !location) ? 0.4 : 1 }}
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
