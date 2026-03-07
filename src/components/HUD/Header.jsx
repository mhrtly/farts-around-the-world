import React, { useState, useEffect } from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'
import { isMuted, toggleMute } from '../../utils/notificationSound.js'

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function LivePulse({ lastEventTimestamp }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const secondsAgo = lastEventTimestamp
    ? Math.floor((Date.now() - lastEventTimestamp) / 1000)
    : Infinity

  // Active: event within last 30s
  // Warm: event within last 120s
  // Cold: no recent events
  const isActive = secondsAgo < 30
  const isWarm = secondsAgo < 120

  const color = isActive ? '#9dff4a' : isWarm ? '#ffb020' : '#ff4d5a'
  const label = isActive ? 'LIVE' : isWarm ? 'IDLE' : 'QUIET'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'monospace',
    }}>
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        boxShadow: isActive
          ? `0 0 8px ${color}, 0 0 16px ${color}55`
          : `0 0 4px ${color}88`,
        animation: isActive ? 'pulseOpacity 1.2s ease-in-out infinite' : 'none',
        transition: 'background 0.5s ease, box-shadow 0.5s ease',
      }} />
      <span style={{
        fontSize: '8px',
        letterSpacing: '0.2em',
        color,
        fontWeight: 'bold',
        transition: 'color 0.5s ease',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function Header({ totalToday, totalAllTime, timeWindowLabel, lastEventTimestamp }) {
  const now = useClock()
  const hh  = String(now.getUTCHours()).padStart(2, '0')
  const mm  = String(now.getUTCMinutes()).padStart(2, '0')
  const ss  = String(now.getUTCSeconds()).padStart(2, '0')
  const dateStr = now.toUTCString().split(' ').slice(1, 4).join(' ')
  const [muted, setMuted] = useState(isMuted)

  const handleToggleMute = () => {
    const nowMuted = toggleMute()
    setMuted(nowMuted)
  }

  // M key toggles mute
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'm' || e.key === 'M') {
        if (!e.metaKey && !e.ctrlKey) {
          handleToggleMute()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <header className="hud-header">
      <div className="hud-header__logo">
        <span className="logo-icon">{'\uD83D\uDCA8'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span className="logo-text" style={{ fontSize: '20px', letterSpacing: '0.35em' }}>FATWA</span>
          <span style={{
            fontSize: '8px',
            letterSpacing: '0.15em',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
          }}>Farts Around The World App</span>
        </div>
      </div>

      <div className="hud-header__center">
        <LivePulse lastEventTimestamp={lastEventTimestamp} />
        <span className="header-stat" style={{ marginLeft: '12px' }}>
          TODAY&nbsp;&nbsp;
          <strong className="glow-cyan">
            <AnimatedNumber value={totalToday} />
          </strong>
        </span>
        {totalAllTime > 0 && (
          <span className="header-stat" style={{ marginLeft: '20px' }}>
            ALL TIME&nbsp;&nbsp;
            <strong className="glow-cyan" style={{ opacity: 0.7 }}>
              <AnimatedNumber value={totalAllTime} />
            </strong>
          </span>
        )}
        {timeWindowLabel && (
          <span style={{
            marginLeft: '16px',
            fontSize: '9px',
            letterSpacing: '0.15em',
            padding: '2px 8px',
            borderRadius: '3px',
            background: 'rgba(255,176,32,0.12)',
            border: '1px solid rgba(255,176,32,0.3)',
            color: '#ffb020',
            fontWeight: 'bold',
          }}>
            {'\u23F1'} {timeWindowLabel}
          </span>
        )}

        {/* Sound toggle */}
        <button
          onClick={handleToggleMute}
          title={`${muted ? 'Unmute' : 'Mute'} notifications (M)`}
          style={{
            marginLeft: '12px',
            background: 'none',
            border: `1px solid ${muted ? 'rgba(255,77,90,0.2)' : 'rgba(157,255,74,0.2)'}`,
            borderRadius: '3px',
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: muted ? '#ff4d5a' : '#9dff4a',
            letterSpacing: '0.1em',
            transition: 'all 0.15s ease',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="hud-header__clock">
        <span className="clock-label">UTC</span>
        <span className="clock-time glow-cyan">
          {hh}<span className="clock-colon">:</span>{mm}<span className="clock-colon">:</span>{ss}
        </span>
        <span className="clock-date">{dateStr}</span>
      </div>
    </header>
  )
}
