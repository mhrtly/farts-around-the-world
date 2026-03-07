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

/**
 * Unified status footer bar combining connection health + session stats.
 * Replaces the separate ConnectionStatus and SessionStats components.
 */
export default function StatusFooter({ isConnected, lastEventTimestamp, events }) {
  const [apiLatency, setApiLatency] = useState(null)
  const [apiOk, setApiOk] = useState(null)
  const [uptime, setUptime] = useState(0)
  const startTimeRef = useRef(Date.now())
  const initialCountRef = useRef(events.length)
  const pingRef = useRef(null)

  // Tick uptime + ping API health
  useEffect(() => {
    const id = setInterval(() => {
      setUptime(Date.now() - startTimeRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const ping = async () => {
      const start = Date.now()
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          setApiLatency(Date.now() - start)
          setApiOk(true)
        } else {
          setApiOk(false)
          setApiLatency(null)
        }
      } catch {
        setApiOk(false)
        setApiLatency(null)
      }
    }
    ping()
    pingRef.current = setInterval(ping, 30000)
    return () => clearInterval(pingRef.current)
  }, [])

  const eventsWitnessed = Math.max(0, events.length - initialCountRef.current)

  // Status colors
  const wsColor = isConnected ? '#9dff4a' : '#ff4d5a'
  const apiColor = apiOk === null ? 'var(--text-dim)' : apiOk ? '#9dff4a' : '#ff4d5a'
  const uplinkOk = isConnected && apiOk
  const uplinkPartial = isConnected || apiOk
  const uplinkColor = uplinkOk ? '#9dff4a' : uplinkPartial ? '#ffb020' : '#ff4d5a'

  const sep = (
    <span style={{ color: 'rgba(56,243,255,0.08)', fontSize: '8px', userSelect: 'none' }}>│</span>
  )

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '4px 14px',
      fontFamily: 'monospace',
      fontSize: '8px',
      letterSpacing: '0.1em',
      borderTop: '1px solid rgba(56,243,255,0.06)',
      background: 'linear-gradient(90deg, rgba(6,9,13,0.5), rgba(10,16,22,0.5), rgba(6,9,13,0.5))',
      flexShrink: 0,
      position: 'relative',
      zIndex: 5,
    }}>
      {/* Uplink status light */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <span style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: uplinkColor,
          boxShadow: `0 0 6px ${uplinkColor}88`,
          animation: uplinkOk ? 'pulseOpacity 3s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          color: uplinkColor,
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          fontSize: '7px',
        }}>
          {uplinkOk ? 'NOMINAL' : uplinkPartial ? 'DEGRADED' : 'OFFLINE'}
        </span>
      </div>

      {sep}

      {/* WS + API micro status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{
            width: '3px', height: '3px', borderRadius: '50%',
            background: wsColor,
          }} />
          <span style={{ color: wsColor, fontSize: '7px' }}>WS</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{
            width: '3px', height: '3px', borderRadius: '50%',
            background: apiColor,
          }} />
          <span style={{ color: apiColor, fontSize: '7px' }}>API</span>
          {apiLatency != null && (
            <span style={{ color: 'var(--text-dim)', fontSize: '7px' }}>
              {apiLatency}ms
            </span>
          )}
        </span>
      </div>

      {sep}

      {/* Session uptime */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: '7px', letterSpacing: '0.15em' }}>
          SESSION
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '8px' }}>
          {formatUptime(uptime)}
        </span>
      </div>

      {sep}

      {/* Events witnessed */}
      <span style={{ color: 'var(--text-dim)', fontSize: '8px' }}>
        <span style={{
          color: eventsWitnessed > 0 ? '#38f3ff' : 'var(--text-dim)',
          fontWeight: eventsWitnessed > 0 ? 'bold' : 'normal',
          textShadow: eventsWitnessed > 0 ? '0 0 6px rgba(56,243,255,0.3)' : 'none',
        }}>
          {eventsWitnessed}
        </span>
        {' '}witnessed
      </span>

      {sep}

      <span style={{ color: 'var(--text-dim)', fontSize: '8px' }}>
        {events.length} loaded
      </span>

      {/* Version stamp — right side */}
      <span style={{
        marginLeft: 'auto',
        fontSize: '7px',
        color: 'rgba(56,243,255,0.12)',
        letterSpacing: '0.12em',
        userSelect: 'none',
      }}>
        FATWA v2.0
      </span>
    </div>
  )
}
