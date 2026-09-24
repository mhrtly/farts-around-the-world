import { useState, useEffect, useRef } from 'react'
import { classifyEmission } from '../../config/humor.ts'
import { playEventBlip } from '../../utils/notificationSound.js'

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

function Toast({ event, onDone, index }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Enter animation
    requestAnimationFrame(() => setVisible(true))

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onDone, 350)
    }, 4000)

    return () => clearTimeout(timer)
  }, [onDone])

  const cls = classifyEmission(event.duration, event.volume)
  const flag = FLAG_MAP[event.country] || '🌍'
  const country = COUNTRY_NAMES[event.country] || event.country || '???'

  return (
    <div style={{
      position: 'absolute',
      bottom: `${index * 56 + 8}px`,
      right: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 14px',
      background: 'rgba(10,18,28,0.92)',
      border: `1px solid ${cls.color}33`,
      borderLeft: `3px solid ${cls.color}`,
      borderRadius: '6px',
      fontFamily: 'monospace',
      backdropFilter: 'blur(8px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${cls.color}15`,
      opacity: visible && !exiting ? 1 : 0,
      transform: visible && !exiting
        ? 'translateX(0) scale(1)'
        : exiting
          ? 'translateX(60px) scale(0.95)'
          : 'translateX(40px) scale(0.95)',
      transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 7000 - index,
    }}>
      <span style={{ fontSize: '18px' }}>{flag}</span>
      <div>
        <div style={{
          fontSize: '10px', fontWeight: 'bold', color: '#fff',
          letterSpacing: '0.04em',
        }}>
          {country}
        </div>
        <div style={{
          fontSize: '9px', color: cls.color, fontWeight: 'bold',
          letterSpacing: '0.08em',
        }}>
          {cls.label}
          {event.duration != null && (
            <span style={{ color: 'var(--text-dim)', fontWeight: 'normal', marginLeft: '6px' }}>
              {event.duration}s
            </span>
          )}
          {event.hasAudio && (
            <span style={{ color: '#9dff4a', marginLeft: '4px' }}>♪</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EventToast({ events }) {
  const [toasts, setToasts] = useState([])
  const lastCountRef = useRef(events.length)
  const seenIdsRef = useRef(new Set())

  // Initialize seen IDs on first render
  useEffect(() => {
    for (const e of events) {
      seenIdsRef.current.add(e.id)
    }
    lastCountRef.current = events.length
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new events
  useEffect(() => {
    if (events.length <= lastCountRef.current && events.length > 0) {
      lastCountRef.current = events.length
      return
    }

    const newEvents = events.filter(e => !seenIdsRef.current.has(e.id))
    if (newEvents.length === 0) {
      lastCountRef.current = events.length
      return
    }

    for (const e of newEvents) {
      seenIdsRef.current.add(e.id)
    }
    lastCountRef.current = events.length

    // Only show toasts for max 3 at a time
    const toShow = newEvents.slice(0, 3)
    setToasts(prev => [
      ...prev,
      ...toShow.map(e => ({ id: e.id, event: e })),
    ].slice(-3))

    // Play subtle notification sound for the first new event
    if (toShow.length > 0) {
      playEventBlip()
    }
  }, [events])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '160px',
      right: '20px',
      zIndex: 7000,
      pointerEvents: 'none',
    }}>
      {toasts.map((t, i) => (
        <Toast
          key={t.id}
          event={t.event}
          index={i}
          onDone={() => removeToast(t.id)}
        />
      ))}
    </div>
  )
}
