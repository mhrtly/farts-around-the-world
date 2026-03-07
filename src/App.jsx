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
    activeFarters: 0,
    topCountry: '\u2014',
    epicCount: 0,
  })
  const streamRef = useRef(null)

  const handleNewEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 500))

    setStats(prev => ({
      totalToday:    prev.totalToday + 1,
      activeFarters: Math.min(prev.activeFarters + (Math.random() > 0.7 ? 1 : 0), 9999),
      topCountry:    event.country,
      epicCount:     prev.epicCount + (event.type === 'epic' ? 1 : 0),
    }))
  }, [])

  useEffect(() => {
    let cancelled = false
    createStream(handleNewEvent).then(stream => {
      if (!cancelled) streamRef.current = stream
    })
    return () => {
      cancelled = true
      streamRef.current?.stop()
    }
  }, [handleNewEvent])

  const closeModal = useCallback(() => setActiveModal(null), [])

  return (
    <div className="app-shell">
      <Header totalToday={stats.totalToday} />
      <GasconIndicator events={events} />

      <div className="app-body">
        <aside className="panel panel-left">
          <KPIPanel stats={stats} />
          <div className="panel-divider" />
          <Leaderboard events={events} />
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
          </button>
        </aside>
      </div>

      <Timeline events={events} />
    </div>
  )
}
