import React from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'

function KPICard({ label, value, color = 'cyan', alert = false, isString = false, sub = null }) {
  return (
    <div className={`kpi-card ${alert ? 'kpi-card--alert' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value glow-${color}`}>
        {isString ? value : <AnimatedNumber value={value} />}
      </div>
      {sub && <div className="kpi-sub" style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

export default function KPIPanel({ stats }) {
  const FLAG_MAP = {
    US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA',
    FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5', CN:'\uD83C\uDDE8\uD83C\uDDF3',
    BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA',
    CA:'\uD83C\uDDE8\uD83C\uDDE6', MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA',
    NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
    AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9',
    TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
  }

  const topDisplay = stats.topCountry !== '\u2014'
    ? `${FLAG_MAP[stats.topCountry] || ''} ${stats.topCountry}`
    : '\u2014'

  return (
    <div className="kpi-panel">
      <div className="panel-title">TELEMETRY</div>

      <KPICard label="EMISSIONS TODAY" value={stats.totalToday} color="cyan"
        sub={stats.totalAllTime > 0 ? `${stats.totalAllTime} ALL TIME` : null} />
      <KPICard label="REGIONS ACTIVE" value={stats.uniqueCountries || 0} color="lime"
        sub={stats.audioCount > 0 ? `${stats.audioCount} WITH AUDIO` : null} />
      <KPICard label="TOP TERRITORY" value={topDisplay} color="amber" isString
        sub={stats.topCountryCount > 0 ? `${stats.topCountryCount} EMISSIONS` : null} />
      <KPICard label="AVG DURATION" value={stats.avgDuration != null ? `${stats.avgDuration}s` : '\u2014'} color="pink" isString
        sub={stats.maxDuration != null ? `PEAK: ${stats.maxDuration}s` : null} />

      <div className="panel-divider" />

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span className="legend-pill" style={{ color: '#38f3ff', borderColor: 'rgba(56,243,255,0.3)', boxShadow: '0 0 6px rgba(56,243,255,0.2)' }}>
          {stats.avgVolume != null ? `VOL ${stats.avgVolume}` : 'NO DATA'}
        </span>
        <span className="legend-pill" style={{ color: '#ff64ff', borderColor: 'rgba(255,100,255,0.3)', boxShadow: '0 0 6px rgba(255,100,255,0.2)' }}>
          {stats.maxVolume != null ? `PEAK ${stats.maxVolume}` : '\u2014'}
        </span>
      </div>
    </div>
  )
}
