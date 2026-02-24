import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'RU', name: 'Russia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AR', name: 'Argentina' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IT', name: 'Italy' },
]

const INTENSITY_LABELS = {
  1: 'Whisper', 2: 'Gentle', 3: 'Mild', 4: 'Moderate', 5: 'Notable',
  6: 'Significant', 7: 'Substantial', 8: 'Severe', 9: 'Extreme', 10: 'Catastrophic',
}

const TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'epic', label: 'Epic' },
  { value: 'silent-but-deadly', label: 'SBD' },
]

const SEQUENCE_STEPS = [
  'TRIANGULATING COORDINATES...',
  'CLASSIFYING EMISSION...',
  'FILING REPORT...',
]

const BLANK_FORM = { lat: '', lng: '', intensity: 5, country: 'US', type: 'standard' }

export default function SubmitPanel() {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sequence, setSequence] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by browser')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({
          ...f,
          lat: pos.coords.latitude.toFixed(4),
          lng: pos.coords.longitude.toFixed(4),
        }))
        setLocating(false)
      },
      () => {
        setError('Location access denied')
        setLocating(false)
      },
      { timeout: 5000 }
    )
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    setConfirmed(false)

    for (const step of SEQUENCE_STEPS) {
      setSequence(step)
      await new Promise(r => setTimeout(r, 700))
    }

    try {
      const res = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          intensity: form.intensity,
          country: form.country,
          type: form.type,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      setSequence('CONFIRMED')
      setConfirmed(true)
      await new Promise(r => setTimeout(r, 1500))
      setForm(BLANK_FORM)
      setExpanded(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
      setSequence(null)
      setConfirmed(false)
    }
  }, [form])

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
          <form onSubmit={handleSubmit} className="submit-form">

            {/* Coordinates */}
            <div className="submit-field">
              <label className="submit-label">COORDINATES</label>
              <div className="submit-coord-row">
                <input
                  className="input"
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  placeholder="LAT"
                  value={form.lat}
                  onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                  disabled={submitting}
                  required
                />
                <input
                  className="input"
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  placeholder="LNG"
                  value={form.lng}
                  onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="btn btn-sm submit-locate-btn"
                  onClick={detectLocation}
                  disabled={locating || submitting}
                  title="Auto-detect location"
                >
                  {locating ? '…' : '⌖'}
                </button>
              </div>
            </div>

            {/* Intensity */}
            <div className="submit-field">
              <label className="submit-label">
                INTENSITY —{' '}
                <span className="submit-intensity-value">
                  {form.intensity} / {INTENSITY_LABELS[form.intensity]}
                </span>
              </label>
              <input
                className="slider"
                type="range"
                min="1"
                max="10"
                value={form.intensity}
                onChange={e => setForm(f => ({ ...f, intensity: parseInt(e.target.value) }))}
                disabled={submitting}
              />
            </div>

            {/* Classification */}
            <div className="submit-field">
              <label className="submit-label">CLASSIFICATION</label>
              <div className="submit-chips">
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`chip${form.type === t.value ? ' active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    disabled={submitting}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Origin country */}
            <div className="submit-field">
              <label className="submit-label">ORIGIN</label>
              <select
                className="select"
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                disabled={submitting}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="submit-error">{error}</div>
            )}

            {submitting ? (
              <div className={`submit-sequence${confirmed ? ' submit-sequence--confirmed' : ''}`}>
                {sequence}
              </div>
            ) : (
              <button type="submit" className="btn btn-primary btn-lg submit-transmit-btn">
                TRANSMIT
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
