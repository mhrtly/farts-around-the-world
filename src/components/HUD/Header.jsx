import React, { useState, useEffect } from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Header({ totalToday }) {
  const now = useClock()
  const hh  = String(now.getUTCHours()).padStart(2, '0')
  const mm  = String(now.getUTCMinutes()).padStart(2, '0')
  const ss  = String(now.getUTCSeconds()).padStart(2, '0')
  const dateStr = now.toUTCString().split(' ').slice(1, 4).join(' ')

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
        <span className="header-stat">
          EVENTS TODAY&nbsp;&nbsp;
          <strong className="glow-cyan">
            <AnimatedNumber value={totalToday} />
          </strong>
        </span>
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
