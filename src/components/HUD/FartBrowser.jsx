import { useState, useRef, useEffect } from 'react'
import { REPORTER_ALIASES, classifyEmission, generatePayloadDescription } from '../../config/humor.ts'
import AudioWaveform from './AudioWaveform.jsx'

const FLAG_EMOJIS = {
  US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA', FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5',
  CN:'\uD83C\uDDE8\uD83C\uDDF3', BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA', CA:'\uD83C\uDDE8\uD83C\uDDE6',
  MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA', NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
  AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9', TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
}

// Community tone reactions (Peace & Planet UX inspired — positive, never cruel)
const REACTIONS = [
  { emoji: '\uD83D\uDE36', label: 'Stealth', color: '#9dff4a' },
  { emoji: '\uD83D\uDE0F', label: 'Cheeky', color: '#38f3ff' },
  { emoji: '\uD83C\uDFB6', label: 'Operatic', color: '#ff64ff' },
  { emoji: '\uD83D\uDC51', label: 'Legendary', color: '#ffb020' },
  { emoji: '\u2604\uFE0F', label: 'Catastrophic', color: '#ff4d5a' },
]

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

function aliasForEvent(id) {
  const seed = parseInt(id.slice(0, 4).replace(/-/g, ''), 16) || 0
  return REPORTER_ALIASES[seed % REPORTER_ALIASES.length]
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function volumeLabel(vol) {
  if (!vol || vol < 5) return 'Whisper'
  if (vol < 15) return 'Moderate'
  if (vol < 30) return 'Loud'
  if (vol < 50) return 'Very Loud'
  return 'Thunderous'
}

const SORT_OPTIONS = [
  { key: 'recent', label: 'RECENT' },
  { key: 'loudest', label: 'LOUDEST' },
  { key: 'longest', label: 'LONGEST' },
  { key: 'audio', label: 'WITH AUDIO' },
]

export default function FartBrowser({ events, onClose }) {
  const isCompact = window.innerWidth <= 768
  const [expandedId, setExpandedId] = useState(null)
  const [ratings, setRatings] = useState({})
  const [audioStates, setAudioStates] = useState({})
  const [sortBy, setSortBy] = useState('recent')
  const audioRefs = useRef({})

  // ESC key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const [audioUrls, setAudioUrls] = useState({})

  const toggleAudio = async (eventId) => {
    const currentState = audioStates[eventId] || 'idle'

    if (currentState === 'playing') {
      // Stop — AudioWaveform handles actual audio stop
      setAudioStates(prev => ({ ...prev, [eventId]: 'idle' }))
      return
    }

    // Load URL if not yet fetched
    if (!audioUrls[eventId]) {
      setAudioStates(prev => ({ ...prev, [eventId]: 'loading' }))
      try {
        const res = await fetch(`/api/events/${eventId}/audio`)
        if (!res.ok) throw new Error('No audio')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setAudioUrls(prev => ({ ...prev, [eventId]: url }))
        setAudioStates(prev => ({ ...prev, [eventId]: 'playing' }))
      } catch {
        setAudioStates(prev => ({ ...prev, [eventId]: 'idle' }))
      }
    } else {
      setAudioStates(prev => ({ ...prev, [eventId]: 'playing' }))
    }
  }

  const handleRate = async (eventId, ratingIndex) => {
    const rating = (ratingIndex + 1) * 2
    setRatings(prev => ({ ...prev, [eventId]: ratingIndex }))
    try {
      await fetch(`/api/events/${eventId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })
    } catch {
      // Keep optimistic update
    }
  }

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
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: isCompact ? '100%' : '580px',
          maxHeight: isCompact ? '100%' : '85%',
          height: isCompact ? '100%' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(16,26,38,0.95)',
          border: isCompact ? 'none' : '1px solid rgba(56,243,255,0.2)',
          borderRadius: isCompact ? '0' : '8px',
          boxShadow: '0 0 60px rgba(56,243,255,0.1), 0 0 120px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid rgba(56,243,255,0.1)', flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.3em',
              color: '#38f3ff', fontFamily: 'monospace', textTransform: 'uppercase',
            }}>
              Rate Emissions
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.15em', fontFamily: 'monospace', marginTop: '2px' }}>
              {events.length} EMISSION{events.length !== 1 ? 'S' : ''} RECORDED
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

        {/* Sort tabs */}
        {events.length > 0 && (
          <div style={{
            display: 'flex', gap: '4px', padding: '10px 24px',
            borderBottom: '1px solid rgba(56,243,255,0.06)', flexShrink: 0,
          }}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                style={{
                  ...btnBase, padding: '4px 10px', fontSize: '9px',
                  background: sortBy === opt.key ? 'rgba(56,243,255,0.15)' : 'rgba(56,243,255,0.03)',
                  borderColor: sortBy === opt.key ? 'rgba(56,243,255,0.4)' : 'rgba(56,243,255,0.1)',
                  color: sortBy === opt.key ? '#38f3ff' : 'var(--text-dim)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Event list */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          {events.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              fontFamily: 'monospace', color: 'var(--text-dim)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'grayscale(0.3)' }}>
                {'\uD83C\uDF0D'}
              </div>
              <div style={{
                fontSize: '14px', letterSpacing: '0.2em', marginBottom: '8px',
                color: '#38f3ff', fontWeight: 'bold',
                textShadow: '0 0 12px rgba(56,243,255,0.3)',
              }}>
                THE ATMOSPHERE AWAITS
              </div>
              <div style={{
                fontSize: '10px', letterSpacing: '0.1em', lineHeight: 1.8,
                maxWidth: '300px', margin: '0 auto',
              }}>
                No emissions recorded yet. Press <span style={{ color: '#ff6b6b' }}>R</span> to capture
                your first contribution to the global dataset.
              </div>
              <div style={{
                marginTop: '20px', fontSize: '9px', letterSpacing: '0.15em',
                color: 'rgba(56,243,255,0.3)',
              }}>
                SAME ATMOSPHERE {'\u00B7'} SAME SPECIES {'\u00B7'} SAME RIDICULOUS NOISES
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Highlights bar */}
              {events.length >= 2 && (() => {
                const withDuration = events.filter(e => e.duration != null)
                const withVolume = events.filter(e => e.volume != null)
                const longest = withDuration.length > 0 ? withDuration.reduce((a, b) => (b.duration > a.duration ? b : a)) : null
                const loudest = withVolume.length > 0 ? withVolume.reduce((a, b) => (b.volume > a.volume ? b : a)) : null
                const highlights = [
                  longest && { label: 'LONGEST', value: `${longest.duration}s`, color: '#38f3ff', country: longest.country },
                  loudest && { label: 'LOUDEST', value: volumeLabel(loudest.volume), color: '#ff6b6b', country: loudest.country },
                  { label: 'LATEST', value: timeSince(events[0].timestamp), color: '#9dff4a', country: events[0].country },
                ].filter(Boolean)
                return (
                  <div style={{
                    display: 'flex', gap: '8px', marginBottom: '12px',
                    padding: '10px', borderRadius: '4px',
                    background: 'rgba(6,9,13,0.5)', border: '1px solid rgba(56,243,255,0.08)',
                  }}>
                    {highlights.map((h, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '7px', color: 'var(--text-dim)', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: '3px' }}>{h.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: h.color, fontFamily: 'monospace' }}>{h.value}</div>
                        <div style={{ fontSize: '10px' }}>{FLAG_EMOJIS[h.country] || '\uD83C\uDF0D'}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
              {[...events].sort((a, b) => {
                if (sortBy === 'loudest') return (b.volume || 0) - (a.volume || 0)
                if (sortBy === 'longest') return (b.duration || 0) - (a.duration || 0)
                if (sortBy === 'audio') return (b.hasAudio ? 1 : 0) - (a.hasAudio ? 1 : 0)
                return b.timestamp - a.timestamp // recent (default)
              }).slice(0, 50).map(e => {
                const isExpanded = expandedId === e.id
                const audioState = audioStates[e.id] || 'idle'
                const userRating = ratings[e.id]

                return (
                  <div
                    key={e.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '4px',
                      border: `1px solid ${isExpanded ? 'rgba(56,243,255,0.25)' : 'rgba(56,243,255,0.06)'}`,
                      background: isExpanded ? 'rgba(12,20,30,0.8)' : 'rgba(12,20,30,0.4)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onClick={() => setExpandedId(prev => prev === e.id ? null : e.id)}
                  >
                    {/* Summary row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      fontSize: '11px', fontFamily: 'monospace',
                    }}>
                      <span style={{ fontSize: '16px' }}>{FLAG_EMOJIS[e.country] || '\uD83C\uDF0D'}</span>
                      <span style={{ color: 'var(--text-primary)', flex: 1 }}>
                        {aliasForEvent(e.id)}
                      </span>
                      {e.duration != null && (
                        <span style={{ color: '#38f3ff', fontSize: '10px' }}>{e.duration}s</span>
                      )}
                      {e.volume != null && (
                        <span style={{
                          fontSize: '9px', padding: '1px 6px',
                          border: '1px solid rgba(56,243,255,0.2)',
                          borderRadius: '3px', color: 'var(--text-label)',
                        }}>
                          {volumeLabel(e.volume)}
                        </span>
                      )}
                      {e.hasAudio ? (
                        <span style={{ color: '#9dff4a', fontSize: '10px' }}>{'\u25B6'} AUDIO</span>
                      ) : null}
                      <span style={{ color: 'var(--text-dim)', fontSize: '9px', flexShrink: 0 }}>
                        {timeSince(e.timestamp)}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div
                        style={{ paddingTop: '12px', borderTop: '1px solid rgba(56,243,255,0.08)', marginTop: '10px' }}
                        onClick={ev => ev.stopPropagation()}
                      >
                        {/* Classification badge + payload description */}
                        {(() => {
                          const cls = classifyEmission(e.duration, e.volume)
                          return (
                            <>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                marginBottom: '6px', padding: '8px 10px', borderRadius: '4px',
                                background: `${cls.color}0a`, border: `1px solid ${cls.color}22`,
                              }}>
                                <span style={{
                                  fontSize: '8px', padding: '2px 5px', borderRadius: '3px',
                                  background: `${cls.color}22`, border: `1px solid ${cls.color}44`,
                                  color: cls.color, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.1em',
                                }}>{cls.code}</span>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: cls.color, fontFamily: 'monospace' }}>
                                  {cls.label.toUpperCase()}
                                </span>
                                <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace', flex: 1, textAlign: 'right' }}>
                                  {cls.description.split('.')[0]}
                                </span>
                              </div>
                              <div style={{
                                fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace',
                                fontStyle: 'italic', marginBottom: '10px', padding: '4px 10px',
                                lineHeight: 1.5,
                              }}>
                                {generatePayloadDescription()}
                              </div>
                            </>
                          )
                        })()}

                        <div style={{
                          display: 'flex', gap: '16px', marginBottom: '12px',
                          fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-label)',
                        }}>
                          <span>{e.lat?.toFixed(2)}{'\u00B0'}, {e.lng?.toFixed(2)}{'\u00B0'}</span>
                          {e.duration != null && <span>Duration: {e.duration}s</span>}
                          {e.volume != null && <span>Volume: {e.volume?.toFixed(1)}</span>}
                          {e.peakVolume != null && <span>Peak: {e.peakVolume?.toFixed(1)}</span>}
                        </div>

                        {e.hasAudio && (
                          <div style={{ marginBottom: '12px' }}>
                            {audioState === 'loading' ? (
                              <div style={{
                                textAlign: 'center', padding: '14px',
                                fontFamily: 'monospace', fontSize: '10px',
                                color: '#38f3ff', letterSpacing: '0.15em',
                                border: '1px solid rgba(56,243,255,0.15)',
                                borderRadius: '4px', background: 'rgba(56,243,255,0.05)',
                              }}>
                                ⏳ LOADING AUDIO...
                              </div>
                            ) : audioUrls[e.id] ? (
                              <AudioWaveform
                                audioUrl={audioUrls[e.id]}
                                isPlaying={audioState === 'playing'}
                                onPlayToggle={() => toggleAudio(e.id)}
                                onEnded={() => setAudioStates(prev => ({ ...prev, [e.id]: 'idle' }))}
                                color={(() => { const cls = classifyEmission(e.duration, e.volume); return cls.color; })()}
                              />
                            ) : (
                              <button
                                onClick={() => toggleAudio(e.id)}
                                style={{
                                  ...btnBase, width: '100%', padding: '10px',
                                  fontSize: '12px',
                                  border: '1px solid rgba(56,243,255,0.3)',
                                  background: 'rgba(56,243,255,0.08)',
                                  color: '#38f3ff',
                                }}
                              >
                                ▶ PLAY AUDIO
                              </button>
                            )}
                          </div>
                        )}

                        <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: '0.15em', marginBottom: '8px' }}>
                          COMMUNITY REACTION
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {REACTIONS.map((reaction, i) => {
                            const isActive = userRating === i
                            return (
                              <button
                                key={i}
                                onClick={() => handleRate(e.id, i)}
                                title={reaction.label}
                                style={{
                                  ...btnBase,
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  gap: '2px', padding: '6px 8px', borderRadius: '6px',
                                  fontSize: '16px', minWidth: '52px',
                                  border: `1px solid ${isActive ? reaction.color + '66' : 'rgba(56,243,255,0.1)'}`,
                                  background: isActive ? reaction.color + '18' : 'rgba(56,243,255,0.03)',
                                  boxShadow: isActive ? `0 0 12px ${reaction.color}30` : 'none',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span>{reaction.emoji}</span>
                                <span style={{
                                  fontSize: '7px', letterSpacing: '0.1em',
                                  color: isActive ? reaction.color : 'var(--text-dim)',
                                  fontWeight: isActive ? 'bold' : 'normal',
                                }}>
                                  {reaction.label.toUpperCase()}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
