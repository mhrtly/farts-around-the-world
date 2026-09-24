import { useState, useEffect, useRef } from 'react'

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${String(secs).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

export default function SessionStats({ events }) {
  const startTimeRef = useRef(Date.now())
  const [uptime, setUptime] = useState(0)
  const initialCountRef = useRef(events.length)
  const [eventsWitnessed, setEventsWitnessed] = useState(0)

  // Tick uptime
  useEffect(() => {
    const id = setInterval(() => {
      setUptime(Date.now() - startTimeRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Track new events witnessed during session
  useEffect(() => {
    const newCount = Math.max(0, events.length - initialCountRef.current)
    setEventsWitnessed(newCount)
  }, [events.length])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '5px 14px',
      fontFamily: 'monospace',
      borderTop: '1px solid rgba(56,243,255,0.04)',
      background: 'rgba(6,9,13,0.4)',
    }}>
      <span style={{
        fontSize: '7px',
        letterSpacing: '0.2em',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        opacity: 0.5,
      }}>
        SESSION
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: '#9dff4a',
          boxShadow: '0 0 4px rgba(157,255,74,0.4)',
          animation: 'pulseOpacity 3s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em',
        }}>
          {formatUptime(uptime)}
        </span>
      </div>

      <span style={{
        fontSize: '8px', color: 'rgba(255,255,255,0.1)',
      }}>|</span>

      <span style={{
        fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em',
      }}>
        <span style={{ color: eventsWitnessed > 0 ? '#38f3ff' : 'var(--text-dim)' }}>
          {eventsWitnessed}
        </span>
        {' '}witnessed
      </span>

      <span style={{
        fontSize: '8px', color: 'rgba(255,255,255,0.1)',
      }}>|</span>

      <span style={{
        fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.05em',
      }}>
        {events.length} total loaded
      </span>

      <span style={{ marginLeft: 'auto', fontSize: '7px', color: 'rgba(255,255,255,0.08)', letterSpacing: '0.08em' }}>
        FATWA v2.0
      </span>
    </div>
  )
}
