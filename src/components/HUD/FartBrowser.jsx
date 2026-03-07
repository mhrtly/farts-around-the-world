import { useState, useRef } from 'react'
import { REPORTER_ALIASES } from '../../config/humor.ts'

const TYPE_COLORS = {
  standard: '#38f3ff',
  epic: '#ff64ff',
  'silent-but-deadly': '#9dff4a',
}

const FLAG_EMOJIS = {
  US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA', FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5',
  CN:'\uD83C\uDDE8\uD83C\uDDF3', BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA', CA:'\uD83C\uDDE8\uD83C\uDDE6',
  MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA', NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
  AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9', TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
}

const RATING_LABELS = ['Mild', 'Medium', 'Strong', 'Brutal', 'Nuclear']

function aliasForEvent(id) {
  const seed = parseInt(id.slice(0, 4).replace(/-/g, ''), 16) || 0
  return REPORTER_ALIASES[seed % REPORTER_ALIASES.length]
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export default function FartBrowser({ events }) {
  const [expandedId, setExpandedId] = useState(null)
  const [ratings, setRatings] = useState({})
  const [audioStates, setAudioStates] = useState({})
  const audioRefs = useRef({})

  const toggleAudio = async (eventId) => {
    // Stop if already playing
    if (audioRefs.current[eventId]) {
      audioRefs.current[eventId].pause()
      audioRefs.current[eventId] = null
      setAudioStates(prev => ({ ...prev, [eventId]: 'idle' }))
      return
    }

    setAudioStates(prev => ({ ...prev, [eventId]: 'loading' }))
    try {
      const res = await fetch(`/api/events/${eventId}/audio`)
      if (!res.ok) throw new Error('No audio')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        setAudioStates(prev => ({ ...prev, [eventId]: 'idle' }))
        audioRefs.current[eventId] = null
        URL.revokeObjectURL(url)
      }
      audioRefs.current[eventId] = audio
      await audio.play()
      setAudioStates(prev => ({ ...prev, [eventId]: 'playing' }))
    } catch {
      setAudioStates(prev => ({ ...prev, [eventId]: 'idle' }))
    }
  }

  const handleRate = async (eventId, ratingIndex) => {
    const rating = (ratingIndex + 1) * 2 // maps 0-4 → 2,4,6,8,10
    setRatings(prev => ({ ...prev, [eventId]: ratingIndex }))
    try {
      await fetch(`/api/events/${eventId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })
    } catch {
      // Keep optimistic update even if server fails (mock mode)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-title">RATE EMISSIONS</div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
      }}>
        {events.map(e => {
          const isExpanded = expandedId === e.id
          const audioState = audioStates[e.id] || 'idle'
          const userRating = ratings[e.id]
          const color = TYPE_COLORS[e.type] || TYPE_COLORS.standard

          return (
            <div
              key={e.id}
              style={{
                padding: '6px 8px',
                borderRadius: '3px',
                border: `1px solid ${isExpanded ? 'rgba(56,243,255,0.3)' : 'transparent'}`,
                background: isExpanded ? 'rgba(12,20,30,0.8)' : 'rgba(12,20,30,0.4)',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => setExpandedId(prev => prev === e.id ? null : e.id)}
            >
              {/* Header row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 5px ${color}`,
                  flexShrink: 0,
                }} />
                <span>{FLAG_EMOJIS[e.country] || '\uD83C\uDF0D'}</span>
                <span style={{
                  color: 'var(--text-primary, #d0d8e0)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {aliasForEvent(e.id)}
                </span>
                {e.hasAudio && (
                  <span style={{ color: '#ffb020', fontSize: '9px' }}>{'\uD83D\uDD0A'}</span>
                )}
                <span style={{
                  color: 'var(--text-label, #6a7a8a)',
                  fontSize: '9px',
                  flexShrink: 0,
                }}>
                  {timeSince(e.timestamp)}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div
                  style={{
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(56,243,255,0.08)',
                    marginTop: '8px',
                  }}
                  onClick={ev => ev.stopPropagation()}
                >
                  {/* Coordinates */}
                  <div style={{
                    fontSize: '9px',
                    color: 'var(--text-label, #6a7a8a)',
                    fontFamily: 'monospace',
                    marginBottom: '8px',
                  }}>
                    {e.lat.toFixed(2)}{'\u00B0'}, {e.lng.toFixed(2)}{'\u00B0'} \u2014 {e.country}
                  </div>

                  {/* Audio playback */}
                  {e.hasAudio && (
                    <button
                      onClick={() => toggleAudio(e.id)}
                      disabled={audioState === 'loading'}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '8px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        letterSpacing: '0.1em',
                        border: `1px solid ${audioState === 'playing' ? 'rgba(255,77,90,0.4)' : 'rgba(56,243,255,0.3)'}`,
                        borderRadius: '3px',
                        background: audioState === 'playing' ? 'rgba(255,77,90,0.12)' : 'rgba(56,243,255,0.08)',
                        color: audioState === 'playing' ? '#ff4d5a' : '#38f3ff',
                        cursor: audioState === 'loading' ? 'wait' : 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {audioState === 'loading' ? '\u23F3 LOADING...' :
                       audioState === 'playing' ? '\u23F9 STOP' :
                       '\uD83D\uDD0A LISTEN'}
                    </button>
                  )}

                  {/* Rating */}
                  <div style={{
                    fontSize: '9px',
                    color: 'var(--text-label, #6a7a8a)',
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    marginBottom: '4px',
                  }}>
                    RATE THIS EMISSION
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {RATING_LABELS.map((label, i) => {
                      const isActive = userRating !== undefined && i <= userRating
                      return (
                        <button
                          key={i}
                          onClick={() => handleRate(e.id, i)}
                          title={label}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: `1px solid ${isActive ? '#38f3ff' : 'rgba(56,243,255,0.25)'}`,
                            background: isActive ? 'rgba(56,243,255,0.35)' : 'rgba(56,243,255,0.05)',
                            boxShadow: isActive ? '0 0 8px rgba(56,243,255,0.3)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            padding: 0,
                            fontSize: '9px',
                            fontFamily: 'monospace',
                            color: isActive ? '#38f3ff' : 'rgba(56,243,255,0.4)',
                          }}
                        >
                          {'\uD83D\uDCA8'}
                        </button>
                      )
                    })}
                    {userRating !== undefined && (
                      <span style={{
                        fontSize: '9px',
                        color: '#38f3ff',
                        fontFamily: 'monospace',
                        marginLeft: '4px',
                      }}>
                        {RATING_LABELS[userRating]}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
