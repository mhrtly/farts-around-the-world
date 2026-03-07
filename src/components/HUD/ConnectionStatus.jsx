import { useState, useEffect, useRef } from 'react'

/**
 * Compact connection health indicator.
 * Shows WebSocket + API connection state with latency.
 */
export default function ConnectionStatus({ isConnected, lastEventTimestamp }) {
  const [apiLatency, setApiLatency] = useState(null)
  const [apiOk, setApiOk] = useState(null)
  const pingRef = useRef(null)

  // Ping the health endpoint every 30s to track API health
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

  // Determine overall status
  const wsLabel = isConnected ? 'WS OK' : 'WS DOWN'
  const wsColor = isConnected ? '#9dff4a' : '#ff4d5a'
  const apiLabel = apiOk === null ? 'API ...' : apiOk ? 'API OK' : 'API DOWN'
  const apiColor = apiOk === null ? 'var(--text-dim)' : apiOk ? '#9dff4a' : '#ff4d5a'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '3px 10px',
      fontFamily: 'monospace',
      fontSize: '7px',
      letterSpacing: '0.12em',
      borderTop: '1px solid rgba(56,243,255,0.04)',
      background: 'rgba(6,9,13,0.3)',
    }}>
      {/* WebSocket status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          background: wsColor,
          boxShadow: `0 0 4px ${wsColor}66`,
          animation: isConnected ? 'pulseOpacity 3s ease-in-out infinite' : 'none',
        }} />
        <span style={{ color: wsColor, fontWeight: 'bold' }}>
          {wsLabel}
        </span>
      </div>

      <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>

      {/* API status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          background: apiColor,
          boxShadow: `0 0 4px ${apiColor}66`,
        }} />
        <span style={{ color: apiColor, fontWeight: 'bold' }}>
          {apiLabel}
        </span>
        {apiLatency != null && (
          <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>
            {apiLatency}ms
          </span>
        )}
      </div>

      <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>

      {/* Uplink quality indicator */}
      <span style={{
        color: isConnected && apiOk
          ? '#9dff4a'
          : isConnected || apiOk
            ? '#ffb020'
            : '#ff4d5a',
        fontWeight: 'bold',
      }}>
        {isConnected && apiOk ? 'UPLINK NOMINAL' :
         isConnected || apiOk ? 'UPLINK DEGRADED' :
         'UPLINK OFFLINE'}
      </span>
    </div>
  )
}
