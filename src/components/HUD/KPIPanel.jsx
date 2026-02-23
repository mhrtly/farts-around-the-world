import React from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'

function KPICard({ label, value, color = 'cyan', alert = false, isString = false }) {
  return (
    <div className={`kpi-card ${alert ? 'kpi-card--alert' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value glow-${color}`}>
        {isString ? value : <AnimatedNumber value={value} />}
      </div>
    </div>
  )
}

export default function KPIPanel({ stats }) {
  return (
    <div className="kpi-panel">
      <div className="panel-title">TELEMETRY</div>

      <KPICard label="TOTAL TODAY"    value={stats.totalToday}    color="cyan" />
      <KPICard label="ACTIVE FARTERS" value={stats.activeFarters} color="lime" />
      <KPICard label="EPIC EVENTS"    value={stats.epicCount}     color="pink" alert={stats.epicCount > 10} />
      <KPICard label="TOP TERRITORY"  value={stats.topCountry}    color="amber" isString />

      <div className="panel-divider" />

      <div className="legend-row">
        <span className="legend-pill" style={{ color: '#38f3ff', borderColor: 'rgba(56,243,255,0.3)', boxShadow: '0 0 6px rgba(56,243,255,0.2)' }}>● STD</span>
        <span className="legend-pill" style={{ color: '#ff64ff', borderColor: 'rgba(255,100,255,0.3)', boxShadow: '0 0 6px rgba(255,100,255,0.2)' }}>● EPIC</span>
        <span className="legend-pill" style={{ color: '#9dff4a', borderColor: 'rgba(157,255,74,0.3)',  boxShadow: '0 0 6px rgba(157,255,74,0.2)'  }}>● SBD</span>
      </div>
    </div>
  )
}
