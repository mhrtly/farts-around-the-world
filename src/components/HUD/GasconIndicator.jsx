import React, { useMemo, useRef, useState, useEffect } from 'react'

const LEVELS = [
  { level: 1, label: 'MAXIMUM',     color: '#ff2040', glow: 'rgba(255,32,64,0.7)',   threshold: 180 },
  { level: 2, label: 'CRITICAL',    color: '#ff8800', glow: 'rgba(255,136,0,0.65)',  threshold: 100 },
  { level: 3, label: 'SIGNIFICANT', color: '#ffee00', glow: 'rgba(255,238,0,0.55)',  threshold: 50  },
  { level: 4, label: 'ELEVATED',    color: '#38f3ff', glow: 'rgba(56,243,255,0.5)',  threshold: 20  },
  { level: 5, label: 'NOMINAL',     color: '#9dff4a', glow: 'rgba(157,255,74,0.45)', threshold: 0   },
]

function getGascon(epm) {
  for (const l of LEVELS) {
    if (epm >= l.threshold) return l
  }
  return LEVELS[4]
}

export default function GasconIndicator({ events }) {
  const prevLevelRef = useRef(5)
  const [flash, setFlash] = useState(false)
  const [burstMode, setBurstMode] = useState(false)
  const burstTimerRef = useRef(null)

  const { gascon, epm, burstCount } = useMemo(() => {
    const now = Date.now()
    const recent60 = events.filter(e => now - e.timestamp < 60000)
    const recent3  = events.filter(e => now - e.timestamp < 3000).length
    return { epm: recent60.length, gascon: getGascon(recent60.length), burstCount: recent3 }
  }, [events])

  // Detect level change → flash
  useEffect(() => {
    if (gascon.level < prevLevelRef.current) {
      setFlash(true)
      setTimeout(() => setFlash(false), 1200)
    }
    prevLevelRef.current = gascon.level
  }, [gascon.level])

  // Detect burst mode (>4 events in 3s)
  useEffect(() => {
    if (burstCount >= 4) {
      setBurstMode(true)
      clearTimeout(burstTimerRef.current)
      burstTimerRef.current = setTimeout(() => setBurstMode(false), 2000)
    }
  }, [burstCount])

  const isCritical = gascon.level <= 2

  return (
    <div
      className={`gascon-strip ${flash ? 'gascon-strip--flash' : ''} ${isCritical ? 'gascon-strip--critical' : ''}`}
      style={{ '--gascon-color': gascon.color, '--gascon-glow': gascon.glow }}
    >
      <span className="gascon-prefix">GASCON</span>

      <div className="gascon-blocks">
        {LEVELS.slice().reverse().map(l => (
          <div
            key={l.level}
            className={`gascon-block ${l.level <= gascon.level ? 'gascon-block--lit' : ''}`}
            style={l.level <= gascon.level ? {
              background: l.color,
              boxShadow: `0 0 8px ${l.glow}, 0 0 2px ${l.color}`,
            } : {}}
          />
        ))}
      </div>

      <span className="gascon-level">{gascon.level}</span>
      <span
        className="gascon-label"
        style={{
          color: gascon.color,
          textShadow: isCritical
            ? `0 0 10px ${gascon.glow}, 0 0 20px ${gascon.glow}, 0 0 4px ${gascon.color}`
            : `0 0 10px ${gascon.glow}`,
        }}
      >
        {gascon.label}
      </span>

      <span className="gascon-sep">|</span>
      <span className="gascon-stat">EPM <span style={{ color: gascon.color }}>{epm}</span></span>

      {burstMode && (
        <span className="gascon-burst">⚡ BURST DETECTED</span>
      )}
    </div>
  )
}
