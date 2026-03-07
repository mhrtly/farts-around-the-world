import React, { useEffect, useRef, useState, useCallback } from 'react'
import GlobeCanvas from './components/Globe/GlobeCanvas.jsx'
import Header from './components/HUD/Header.jsx'
import KPIPanel from './components/HUD/KPIPanel.jsx'
import Leaderboard from './components/HUD/Leaderboard.jsx'
import EventFeed from './components/HUD/EventFeed.jsx'
import Timeline from './components/HUD/Timeline.jsx'
import EpicAlert from './components/HUD/EpicAlert.jsx'
import GasconIndicator from './components/HUD/GasconIndicator.jsx'
import MethaneWaveform from './components/HUD/MethaneWaveform.jsx'
import NewsTicker from './components/HUD/NewsTicker.jsx'
import SubmitPanel from './components/HUD/SubmitPanel.jsx'
import { createStream } from './data/fartStreamFactory.js'

export default function App() {
  const [events, setEvents]         = useState([])
  const [alertEvent, setAlertEvent] = useState(null)
  const [stats, setStats]           = useState({
    totalToday: 0,
    activeFarters: 0,
    topCountry: '—',
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

    if (event.type === 'epic' || event.type === 'silent-but-deadly') {
      setAlertEvent(event)
    }
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

  const dismissAlert = useCallback(() => setAlertEvent(null), [])

  return (
    <div className="app-shell">
      <Header totalToday={stats.totalToday} />
      <NewsTicker />
      <GasconIndicator events={events} />

      <div className="app-body">
        <aside className="panel panel-left">
          <KPIPanel stats={stats} />
          <div className="panel-divider" />
          <Leaderboard events={events} />
        </aside>

        <main className="globe-container">
          <GlobeCanvas events={events} />
        </main>

        <aside className="panel panel-right">
          <SubmitPanel />
          <div className="panel-divider" />
          <MethaneWaveform events={events} />
          <div className="panel-divider" />
          <EventFeed events={events.slice(0, 40)} />
        </aside>
      </div>

      <Timeline events={events} />

      <EpicAlert event={alertEvent} onDismiss={dismissAlert} />
    </div>
  )
}
