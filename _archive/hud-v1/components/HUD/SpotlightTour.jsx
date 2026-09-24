import { useState, useEffect, useRef, useCallback } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

const COUNTRY_NAMES = {
  US:'United States', GB:'United Kingdom', DE:'Germany', FR:'France',
  JP:'Japan', CN:'China', BR:'Brazil', IN:'India', AU:'Australia',
  CA:'Canada', MX:'Mexico', RU:'Russia', NG:'Nigeria', ZA:'South Africa',
  EG:'Egypt', AR:'Argentina', KR:'South Korea', ID:'Indonesia',
  TR:'Turkey', IT:'Italy',
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export default function SpotlightTour({ events, onFlyTo, onStop }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef(null)
  const progressRef = useRef(null)

  // Get tour-worthy events (deduplicate by country, prefer ones with audio/stats)
  const tourEvents = events
    .filter(e => e.lat != null && e.lng != null)
    .slice(0, 20) // Take up to 20 most recent

  const currentEvent = tourEvents[currentIndex] || null

  const goToEvent = useCallback((index) => {
    const event = tourEvents[index]
    if (event && onFlyTo) {
      onFlyTo({ lat: event.lat, lng: event.lng, altitude: 1.2 })
    }
    setProgress(0)
  }, [tourEvents, onFlyTo])

  const nextEvent = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % tourEvents.length
      goToEvent(next)
      return next
    })
  }, [tourEvents.length, goToEvent])

  const prevEvent = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev === 0 ? tourEvents.length - 1 : prev - 1
      goToEvent(next)
      return next
    })
  }, [tourEvents.length, goToEvent])

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (isPaused || tourEvents.length === 0) return

    intervalRef.current = setInterval(() => {
      nextEvent()
    }, 4000)

    return () => clearInterval(intervalRef.current)
  }, [isPaused, nextEvent, tourEvents.length])

  // Progress bar animation
  useEffect(() => {
    if (isPaused || tourEvents.length === 0) return

    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      setProgress(Math.min(100, (elapsed / 4000) * 100))
      if (elapsed < 4000) {
        progressRef.current = requestAnimationFrame(tick)
      }
    }
    progressRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(progressRef.current)
  }, [currentIndex, isPaused, tourEvents.length])

  // Fly to first event on mount
  useEffect(() => {
    if (tourEvents.length > 0) {
      goToEvent(0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'n') {
        e.preventDefault()
        nextEvent()
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        e.preventDefault()
        prevEvent()
      } else if (e.key === ' ') {
        e.preventDefault()
        setIsPaused(prev => !prev)
      } else if (e.key === 'Escape') {
        onStop?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextEvent, prevEvent, onStop])

  if (tourEvents.length === 0 || !currentEvent) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8000,
        padding: '16px 24px',
        background: 'rgba(10,18,28,0.95)',
        border: '1px solid rgba(255,77,90,0.3)',
        borderRadius: '8px',
        fontFamily: 'monospace',
        color: '#ff4d5a',
        fontSize: '11px',
        letterSpacing: '0.1em',
        textAlign: 'center',
      }}>
        No events available for tour. Record some first!
        <button
          onClick={onStop}
          style={{
            display: 'block', margin: '8px auto 0',
            padding: '4px 16px', background: 'rgba(255,77,90,0.12)',
            border: '1px solid rgba(255,77,90,0.3)', borderRadius: '4px',
            color: '#ff4d5a', fontFamily: 'monospace', fontSize: '9px',
            cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase',
          }}
        >
          Close
        </button>
      </div>
    )
  }

  const cls = classifyEmission(currentEvent.duration, currentEvent.volume)
  const flag = FLAG_MAP[currentEvent.country] || '🌍'
  const countryName = COUNTRY_NAMES[currentEvent.country] || currentEvent.country || 'Unknown'

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 8000,
      width: '520px',
      maxWidth: '94vw',
      animation: 'cmdPaletteIn 0.25s ease-out',
    }}>
      {/* Tour card */}
      <div style={{
        background: 'rgba(10,18,28,0.95)',
        border: '1px solid rgba(56,243,255,0.2)',
        borderRadius: '10px',
        overflow: 'hidden',
        fontFamily: 'monospace',
        position: 'relative',
      }}>
        {/* Progress bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'rgba(56,243,255,0.1)',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: isPaused
              ? 'rgba(255,176,32,0.6)'
              : 'linear-gradient(90deg, #38f3ff, #ff64ff)',
            transition: 'width 0.1s linear',
          }} />
        </div>

        <div style={{ padding: '14px 18px 12px' }}>
          {/* Top row: tour label + counter + controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
          }}>
            <span style={{
              fontSize: '7px', letterSpacing: '0.3em', color: '#ff64ff',
              textTransform: 'uppercase', fontWeight: 'bold',
            }}>
              🔭 SPOTLIGHT TOUR
            </span>
            <span style={{
              fontSize: '9px', color: 'var(--text-dim)',
            }}>
              {currentIndex + 1} / {tourEvents.length}
            </span>

            {isPaused && (
              <span style={{
                fontSize: '8px', letterSpacing: '0.15em',
                color: '#ffb020', fontWeight: 'bold',
                animation: 'pulseOpacity 1.5s ease-in-out infinite',
              }}>
                PAUSED
              </span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
              <button
                onClick={prevEvent}
                style={{
                  padding: '3px 8px', background: 'rgba(56,243,255,0.06)',
                  border: '1px solid rgba(56,243,255,0.15)', borderRadius: '3px',
                  color: '#38f3ff', fontSize: '10px', cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                ◀
              </button>
              <button
                onClick={() => setIsPaused(prev => !prev)}
                style={{
                  padding: '3px 8px', background: isPaused
                    ? 'rgba(157,255,74,0.1)' : 'rgba(255,176,32,0.1)',
                  border: `1px solid ${isPaused
                    ? 'rgba(157,255,74,0.3)' : 'rgba(255,176,32,0.3)'}`,
                  borderRadius: '3px',
                  color: isPaused ? '#9dff4a' : '#ffb020',
                  fontSize: '10px', cursor: 'pointer', fontFamily: 'monospace',
                }}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
              <button
                onClick={nextEvent}
                style={{
                  padding: '3px 8px', background: 'rgba(56,243,255,0.06)',
                  border: '1px solid rgba(56,243,255,0.15)', borderRadius: '3px',
                  color: '#38f3ff', fontSize: '10px', cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                ▶
              </button>
              <button
                onClick={onStop}
                style={{
                  padding: '3px 8px', background: 'rgba(255,77,90,0.08)',
                  border: '1px solid rgba(255,77,90,0.2)', borderRadius: '3px',
                  color: '#ff4d5a', fontSize: '9px', cursor: 'pointer',
                  fontFamily: 'monospace', letterSpacing: '0.1em',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Event info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            {/* Flag */}
            <span style={{ fontSize: '32px' }}>{flag}</span>

            {/* Country + classification */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px', fontWeight: 'bold', color: '#fff',
                letterSpacing: '0.04em', marginBottom: '2px',
              }}>
                {countryName}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{
                  fontSize: '11px', fontWeight: 'bold',
                  color: cls.color,
                  textShadow: `0 0 8px ${cls.color}44`,
                }}>
                  {cls.label}
                </span>
                <span style={{
                  fontSize: '8px', color: 'var(--text-dim)',
                  padding: '1px 5px',
                  background: 'rgba(56,243,255,0.06)',
                  borderRadius: '3px',
                }}>
                  {cls.code}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '10px',
              color: 'var(--text-dim)',
              flexShrink: 0,
            }}>
              {currentEvent.duration != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffb020' }}>
                    {currentEvent.duration}s
                  </div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.15em' }}>DUR</div>
                </div>
              )}
              {currentEvent.volume != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38f3ff' }}>
                    {Math.round(currentEvent.volume)}
                  </div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.15em' }}>VOL</div>
                </div>
              )}
              {currentEvent.hasAudio && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', color: '#9dff4a' }}>♪</div>
                  <div style={{ fontSize: '7px', letterSpacing: '0.15em' }}>AUD</div>
                </div>
              )}
            </div>

            {/* Time */}
            <div style={{
              fontSize: '9px', color: 'var(--text-dim)', opacity: 0.6,
              textAlign: 'right', flexShrink: 0,
            }}>
              {relativeTime(currentEvent.timestamp)}
            </div>
          </div>

          {/* Description */}
          <div style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: `${cls.color}08`,
            border: `1px solid ${cls.color}15`,
            borderRadius: '4px',
            fontSize: '9px',
            color: 'var(--text-dim)',
            letterSpacing: '0.04em',
            lineHeight: 1.4,
          }}>
            {cls.description}
          </div>

          {/* Dot indicators */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '4px',
            marginTop: '10px',
          }}>
            {tourEvents.slice(0, 20).map((_, i) => (
              <div
                key={i}
                onClick={() => {
                  setCurrentIndex(i)
                  goToEvent(i)
                }}
                style={{
                  width: i === currentIndex ? '16px' : '4px',
                  height: '4px',
                  borderRadius: '2px',
                  background: i === currentIndex ? '#38f3ff' : 'rgba(56,243,255,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: i === currentIndex ? '0 0 6px rgba(56,243,255,0.4)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Keyboard hints */}
          <div style={{
            textAlign: 'center',
            marginTop: '6px',
            fontSize: '7px',
            color: 'rgba(255,255,255,0.12)',
            letterSpacing: '0.08em',
          }}>
            ← → navigate · SPACE pause · ESC exit
          </div>
        </div>
      </div>
    </div>
  )
}
