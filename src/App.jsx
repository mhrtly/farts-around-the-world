import React, { useEffect, useRef, useState, useCallback } from 'react'
import GlobeCanvas from './components/Globe/GlobeCanvas.jsx'
import Header from './components/HUD/Header.jsx'
import KPIPanel from './components/HUD/KPIPanel.jsx'
import Leaderboard from './components/HUD/Leaderboard.jsx'
import Timeline from './components/HUD/Timeline.jsx'
import GasconIndicator from './components/HUD/GasconIndicator.jsx'
import SubmitPanel from './components/HUD/SubmitPanel.jsx'
import FartBrowser from './components/HUD/FartBrowser.jsx'
import { createStream } from './data/fartStreamFactory.js'

const btnBase = {
  fontFamily: 'monospace',
  fontWeight: 'bold',
  letterSpacing: '0.15em',
  border: '1px solid',
  borderRadius: '6px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'all 0.2s ease',
  width: '100%',
  padding: '24px 16px',
  fontSize: '16px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
}

export default function App() {
  const [events, setEvents]           = useState([])
  const [activeModal, setActiveModal] = useState(null)
  const [stats, setStats]             = useState({
    totalToday: 0,
    totalAllTime: 0,
    topCountry: '\u2014',
    topCountryCount: 0,
    uniqueCountries: 0,
    audioCount: 0,
    avgDuration: null,
    maxDuration: null,
    avgVolume: null,
    maxVolume: null,
    leaderboard: [],
  })
  const streamRef = useRef(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch { /* server not available */ }
  }, [])

  const handleNewEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 500))
    // Re-fetch stats when new events arrive
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    let cancelled = false
    createStream(handleNewEvent).then(stream => {
      if (!cancelled) streamRef.current = stream
    })
    // Initial stats fetch + periodic refresh
    fetchStats()
    const statsInterval = setInterval(fetchStats, 15000)
    return () => {
      cancelled = true
      streamRef.current?.stop()
      clearInterval(statsInterval)
    }
  }, [handleNewEvent, fetchStats])

  const closeModal = useCallback(() => setActiveModal(null), [])

  // Keyboard shortcuts: R to record, B to browse
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'r' || e.key === 'R') {
        setActiveModal(prev => prev === 'record' ? null : 'record')
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveModal(prev => prev === 'browse' ? null : 'browse')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="app-shell">
      <Header totalToday={stats.totalToday} />
      <GasconIndicator events={events} />

      <div className="app-body">
        <aside className="panel panel-left">
          <KPIPanel stats={stats} />
          <div className="panel-divider" />
          <Leaderboard events={events} serverLeaderboard={stats.leaderboard} />
        </aside>

        <main className="globe-container">
          <GlobeCanvas events={events} />

          {activeModal === 'record' && (
            <SubmitPanel onClose={closeModal} />
          )}
          {activeModal === 'browse' && (
            <FartBrowser events={events} onClose={closeModal} />
          )}
        </main>

        <aside className="panel panel-right" style={{ justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => setActiveModal('record')}
            style={{
              ...btnBase,
              background: 'rgba(255,77,90,0.12)',
              borderColor: '#ff6b6b',
              color: '#ff6b6b',
              boxShadow: '0 0 24px rgba(255,77,90,0.2), 0 0 48px rgba(255,77,90,0.08)',
              animation: 'pulseOpacity 2.5s ease-in-out infinite',
            }}
          >
            <span style={{ fontSize: '28px' }}>{'\uD83C\uDFA4'}</span>
            <span>Record a Fart</span>
            <span style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,107,107,0.6)', fontWeight: 'normal' }}>
              Contribute to the global dataset
            </span>
            <span style={{ fontSize: '8px', color: 'rgba(255,107,107,0.35)', fontWeight: 'normal', letterSpacing: '0.05em' }}>
              Press R
            </span>
          </button>

          <button
            onClick={() => setActiveModal('browse')}
            style={{
              ...btnBase,
              background: 'rgba(56,243,255,0.08)',
              borderColor: '#38f3ff',
              color: '#38f3ff',
              boxShadow: '0 0 24px rgba(56,243,255,0.15), 0 0 48px rgba(56,243,255,0.06)',
            }}
          >
            <span style={{ fontSize: '28px' }}>{'\uD83D\uDCA8'}</span>
            <span>Rate Emissions</span>
            <span style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(56,243,255,0.5)', fontWeight: 'normal' }}>
              Listen, rate, and classify
            </span>
            <span style={{ fontSize: '8px', color: 'rgba(56,243,255,0.3)', fontWeight: 'normal', letterSpacing: '0.05em' }}>
              Press B
            </span>
          </button>
        </aside>
      </div>

      <Timeline events={events} />
    </div>
  )
}
