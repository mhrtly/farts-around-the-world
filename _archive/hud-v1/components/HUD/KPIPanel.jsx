import React, { useRef, useEffect, useState } from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'

function KPICard({ label, value, color = 'cyan', alert = false, isString = false, sub = null, trend = null, icon = null }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`kpi-card ${alert ? 'kpi-card--alert' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.2s ease',
      }}
    >
      <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon && <span style={{ fontSize: '8px', opacity: 0.6 }}>{icon}</span>}
        <span>{label}</span>
        {/* Trend arrow */}
        {trend === 'up' && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '8px',
            color: '#9dff4a',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            animation: 'fadeIn 0.3s ease',
          }}>
            ▲
          </span>
        )}
        {trend === 'down' && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '8px',
            color: '#ff4d5a',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            animation: 'fadeIn 0.3s ease',
          }}>
            ▼
          </span>
        )}
      </div>
      <div className={`kpi-value glow-${color}`}>
        {isString ? value : <AnimatedNumber value={value} />}
      </div>
      {sub && (
        <div className="kpi-sub" style={{
          fontSize: '8px',
          color: 'var(--text-dim)',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          marginTop: '2px',
        }}>{sub}</div>
      )}
    </div>
  )
}

export default function KPIPanel({ stats }) {
  const prevStatsRef = useRef({})
  const [trends, setTrends] = useState({})

  const FLAG_MAP = {
    US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪',
    FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
    BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺',
    CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
    NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬',
    AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
    TR:'🇹🇷', IT:'🇮🇹',
  }

  // Track stat changes for trend arrows
  useEffect(() => {
    const prev = prevStatsRef.current
    const newTrends = {}

    if (prev.totalToday !== undefined) {
      if (stats.totalToday > prev.totalToday) newTrends.today = 'up'
      else if (stats.totalToday < prev.totalToday) newTrends.today = 'down'
    }

    if (prev.uniqueCountries !== undefined) {
      if ((stats.uniqueCountries || 0) > (prev.uniqueCountries || 0)) newTrends.regions = 'up'
      else if ((stats.uniqueCountries || 0) < (prev.uniqueCountries || 0)) newTrends.regions = 'down'
    }

    if (prev.topCountry !== undefined && stats.topCountry !== prev.topCountry) {
      newTrends.top = 'up' // new leader
    }

    if (prev.avgDuration !== undefined && stats.avgDuration !== prev.avgDuration) {
      if (stats.avgDuration > prev.avgDuration) newTrends.duration = 'up'
      else if (stats.avgDuration < prev.avgDuration) newTrends.duration = 'down'
    }

    setTrends(newTrends)
    prevStatsRef.current = { ...stats }

    // Clear trends after 5 seconds
    if (Object.keys(newTrends).length > 0) {
      const timer = setTimeout(() => setTrends({}), 5000)
      return () => clearTimeout(timer)
    }
  }, [stats])

  const topDisplay = stats.topCountry !== '—'
    ? `${FLAG_MAP[stats.topCountry] || ''} ${stats.topCountry}`
    : '—'

  return (
    <div className="kpi-panel">
      <KPICard
        label="EMISSIONS TODAY"
        value={stats.totalToday}
        color="cyan"
        icon="◈"
        trend={trends.today}
        sub={stats.totalAllTime > 0 ? `${stats.totalAllTime} ALL TIME` : null}
      />
      <KPICard
        label="REGIONS ACTIVE"
        value={stats.uniqueCountries || 0}
        color="lime"
        icon="◉"
        trend={trends.regions}
        sub={stats.audioCount > 0 ? `${stats.audioCount} WITH AUDIO` : null}
      />
      <KPICard
        label="TOP TERRITORY"
        value={topDisplay}
        color="amber"
        isString
        icon="⊕"
        trend={trends.top}
        sub={stats.topCountryCount > 0 ? `${stats.topCountryCount} EMISSIONS` : null}
      />
      <KPICard
        label="AVG DURATION"
        value={stats.avgDuration != null ? `${stats.avgDuration}s` : '—'}
        color="pink"
        isString
        icon="◷"
        trend={trends.duration}
        sub={stats.maxDuration != null ? `PEAK: ${stats.maxDuration}s` : null}
      />

      <div className="panel-divider" />

      {/* Volume stats row */}
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span className="legend-pill" style={{
          color: '#38f3ff',
          borderColor: 'rgba(56,243,255,0.3)',
          boxShadow: '0 0 6px rgba(56,243,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ fontSize: '7px', opacity: 0.5 }}>◈</span>
          {stats.avgVolume != null ? `VOL ${stats.avgVolume}` : 'NO DATA'}
        </span>
        <span className="legend-pill" style={{
          color: '#ff64ff',
          borderColor: 'rgba(255,100,255,0.3)',
          boxShadow: '0 0 6px rgba(255,100,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ fontSize: '7px', opacity: 0.5 }}>▲</span>
          {stats.maxVolume != null ? `PEAK ${stats.maxVolume}` : '—'}
        </span>
      </div>
    </div>
  )
}
