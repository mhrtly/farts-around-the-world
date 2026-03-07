import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import GlobeCanvas from './components/Globe/GlobeCanvas.jsx'
import Header from './components/HUD/Header.jsx'
import KPIPanel from './components/HUD/KPIPanel.jsx'
import Leaderboard from './components/HUD/Leaderboard.jsx'
import Timeline from './components/HUD/Timeline.jsx'
import GasconIndicator from './components/HUD/GasconIndicator.jsx'
import SubmitPanel from './components/HUD/SubmitPanel.jsx'
import FartBrowser from './components/HUD/FartBrowser.jsx'
import FATWAExpressPanel from './components/HUD/FATWAExpressPanel.jsx'
import CommandPalette from './components/HUD/CommandPalette.jsx'
import ShortcutsOverlay from './components/HUD/ShortcutsOverlay.jsx'
import HighlightsStrip from './components/HUD/HighlightsStrip.jsx'
import CountryDossier from './components/HUD/CountryDossier.jsx'
import SpotlightTour from './components/HUD/SpotlightTour.jsx'
import EventFeed from './components/HUD/EventFeed.jsx'
import ScienceTicker from './components/HUD/ScienceTicker.jsx'
import ActivitySparkline from './components/HUD/ActivitySparkline.jsx'
import EventToast from './components/HUD/EventToast.jsx'
import SessionStats from './components/HUD/SessionStats.jsx'
import GlobalCoverage from './components/HUD/GlobalCoverage.jsx'
import ConnectionStatus from './components/HUD/ConnectionStatus.jsx'
import MilestoneToast from './components/HUD/MilestoneToast.jsx'
import PanelSection from './components/HUD/PanelSection.jsx'
import CTAButton from './components/HUD/CTAButton.jsx'
import { createStream } from './data/fartStreamFactory.js'

const MAX_PERSISTED_EVENTS = 500

function mergeEvents(current, incoming) {
  const byId = new Map(current.map(event => [event.id, event]))

  for (const event of incoming) {
    byId.set(event.id, { ...byId.get(event.id), ...event })
  }

  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_PERSISTED_EVENTS)
}


export default function App() {
  const [events, setEvents]           = useState([])
  const [activeModal, setActiveModal] = useState(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showDossier, setShowDossier] = useState(null) // country code or null
  const [showTour, setShowTour] = useState(false)
  const [timeWindow, setTimeWindow]   = useState(null) // null = all, or ms duration
  const [isExpressViewport, setIsExpressViewport] = useState(() => window.innerWidth <= 900)
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
  const [wsConnected, setWsConnected] = useState(false)
  const streamRef = useRef(null)
  const globeCanvasRef = useRef(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events?limit=${MAX_PERSISTED_EVENTS}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(prev => mergeEvents(prev, data))
      }
    } catch {
      // Backend not available
    }
  }, [])

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
    setEvents(prev => mergeEvents(prev, [event]))
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    let cancelled = false
    createStream({
      onEvent: handleNewEvent,
      onConnect: () => setWsConnected(true),
      onDisconnect: () => setWsConnected(false),
    }).then(stream => {
      if (!cancelled) streamRef.current = stream
    })
    fetchEvents()
    fetchStats()
    const statsInterval = setInterval(fetchStats, 15000)
    const eventsInterval = setInterval(fetchEvents, 30000)
    return () => {
      cancelled = true
      streamRef.current?.stop()
      clearInterval(statsInterval)
      clearInterval(eventsInterval)
    }
  }, [handleNewEvent, fetchEvents, fetchStats])

  useEffect(() => {
    const handleRecordedEvent = (e) => {
      if (e.detail) {
        handleNewEvent(e.detail)
      } else {
        fetchEvents()
        fetchStats()
      }
    }

    window.addEventListener('fatwa:recorded', handleRecordedEvent)
    return () => window.removeEventListener('fatwa:recorded', handleRecordedEvent)
  }, [fetchEvents, fetchStats, handleNewEvent])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const updateViewport = () => setIsExpressViewport(media.matches)
    updateViewport()
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  const closeModal = useCallback(() => setActiveModal(null), [])

  // Filter events by time window
  const filteredEvents = useMemo(() => {
    if (!timeWindow) return events
    const cutoff = Date.now() - timeWindow
    return events.filter(e => e.timestamp >= cutoff)
  }, [events, timeWindow])

  // Globe fly-to helper
  const flyToLocation = useCallback((coords) => {
    if (globeCanvasRef.current?.flyTo && coords?.lat != null && coords?.lng != null) {
      globeCanvasRef.current.flyTo(coords)
    }
  }, [])

  // Command palette action handler
  const handleCommandAction = useCallback((type, payload) => {
    switch (type) {
      case 'modal':
        setActiveModal(payload)
        break
      case 'flyTo':
        flyToLocation(payload)
        break
      case 'timeWindow':
        setTimeWindow(payload)
        break
      case 'tour':
        setShowTour(true)
        break
      case 'toggleRotate':
        globeCanvasRef.current?.toggleAutoRotate?.()
        break
    }
  }, [flyToLocation])

  // Keyboard shortcuts: R to record, B to browse, Cmd+K / for command palette
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger if user is typing in an input (except for Cmd+K and Escape)
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'

      // Cmd+K or Ctrl+K → command palette (always works)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
        return
      }

      if (isInput) return

      // / → open command palette (when not in an input)
      if (e.key === '/' && !showCommandPalette && !activeModal) {
        e.preventDefault()
        setShowCommandPalette(true)
        return
      }

      // ? → toggle shortcuts overlay
      if (e.key === '?' && !showCommandPalette && !activeModal) {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
        return
      }

      if (e.key === 'Escape') {
        setShowDossier(null)
        setShowTour(false)
        return
      }

      if (showTour) return // Let SpotlightTour handle its own keys

      if (e.key === 'r' || e.key === 'R') {
        setActiveModal(prev => prev === 'record' ? null : 'record')
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveModal(prev => prev === 'browse' ? null : 'browse')
      } else if (e.key === 't' || e.key === 'T') {
        setShowTour(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showCommandPalette, activeModal])

  // Time window label for display
  const timeWindowLabel = timeWindow === 3600000 ? '1H' :
    timeWindow === 21600000 ? '6H' :
    timeWindow === 86400000 ? '24H' :
    timeWindow === 604800000 ? '7D' : null

  return (
    <div className={`app-shell ${isExpressViewport ? 'app-shell--express' : ''}`}>
      <Header totalToday={stats.totalToday} totalAllTime={stats.totalAllTime} timeWindowLabel={timeWindowLabel} lastEventTimestamp={filteredEvents[0]?.timestamp} />
      <GasconIndicator events={filteredEvents} />

      <div className={`app-body ${isExpressViewport ? 'app-body--express' : ''}`}>
        <aside className="panel panel-left">
          <PanelSection id="telemetry" title="Telemetry">
            <KPIPanel stats={stats} />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <ActivitySparkline events={filteredEvents} minutes={30} width={160} height={24} />
            </div>
          </PanelSection>

          {/* Time window filter chips — always visible */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { label: 'ALL', value: null },
              { label: '1H', value: 3600000 },
              { label: '6H', value: 21600000 },
              { label: '24H', value: 86400000 },
              { label: '7D', value: 604800000 },
            ].map(tw => (
              <button
                key={tw.label}
                onClick={() => setTimeWindow(tw.value)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: '8px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  letterSpacing: '0.15em',
                  border: '1px solid',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  background: timeWindow === tw.value
                    ? 'rgba(56,243,255,0.15)'
                    : 'rgba(56,243,255,0.03)',
                  borderColor: timeWindow === tw.value
                    ? 'rgba(56,243,255,0.5)'
                    : 'rgba(56,243,255,0.12)',
                  color: timeWindow === tw.value
                    ? '#38f3ff'
                    : 'var(--text-dim)',
                  boxShadow: timeWindow === tw.value
                    ? '0 0 8px rgba(56,243,255,0.2)'
                    : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tw.label}
              </button>
            ))}
          </div>

          <PanelSection id="leaderboard" title="Leaderboard">
            <Leaderboard events={filteredEvents} serverLeaderboard={stats.leaderboard} onCountryClick={(code) => setShowDossier(code)} />
          </PanelSection>

          <PanelSection id="coverage" title="Coverage" defaultOpen={false}>
            <GlobalCoverage
              events={events}
              onCountryClick={(code) => setShowDossier(code)}
            />
          </PanelSection>

          <PanelSection id="feed" title="Event Feed" defaultOpen={false}>
            <EventFeed
              events={filteredEvents}
              onEventClick={(e) => flyToLocation({ lat: e.lat, lng: e.lng, altitude: 1.2 })}
            />
          </PanelSection>
        </aside>

        <main className="globe-container">
          <GlobeCanvas ref={globeCanvasRef} events={filteredEvents} />

          {isExpressViewport && (
            <FATWAExpressPanel
              stats={stats}
              latestEvent={filteredEvents[0] || null}
              activeModal={activeModal}
              onOpenRecord={() => setActiveModal('record')}
              onOpenBrowse={() => setActiveModal('browse')}
            />
          )}

          {activeModal === 'record' && (
            <SubmitPanel onClose={closeModal} />
          )}
          {activeModal === 'browse' && (
            <FartBrowser events={filteredEvents} onClose={closeModal} />
          )}
        </main>

        <aside className="panel panel-right" style={{ justifyContent: 'center', gap: '16px' }}>
          <CTAButton
            onClick={() => setActiveModal('record')}
            icon={'\uD83C\uDFA4'}
            label="Record a Fart"
            sublabel="Contribute to the global dataset"
            shortcut="R"
            color="#ff6b6b"
            pulse
          />

          <CTAButton
            onClick={() => setActiveModal('browse')}
            icon={'\uD83D\uDCA8'}
            label="Rate Emissions"
            sublabel="Listen, rate, and classify"
            shortcut="B"
            color="#38f3ff"
          />

          <CTAButton
            onClick={() => setShowTour(prev => !prev)}
            icon="🔭"
            label={showTour ? 'End Tour' : 'Spotlight Tour'}
            shortcut="T"
            color="#ff64ff"
            compact
            active={showTour}
          />

          {/* Command Palette hint */}
          <div
            onClick={() => setShowCommandPalette(true)}
            style={{
              textAlign: 'center',
              fontSize: '9px',
              fontFamily: 'monospace',
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid rgba(56,243,255,0.06)',
              background: 'rgba(56,243,255,0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ color: 'rgba(56,243,255,0.3)', fontSize: '8px', letterSpacing: '0.15em' }}>
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K
            </span>
            <span style={{ marginLeft: '6px' }}>Command Deck</span>
          </div>
        </aside>
      </div>

      {!isExpressViewport && (
        <>
          {filteredEvents.length >= 2 && <HighlightsStrip events={filteredEvents} />}
          <Timeline events={filteredEvents} />
          <ScienceTicker />
          <ConnectionStatus isConnected={wsConnected} lastEventTimestamp={filteredEvents[0]?.timestamp} />
          <SessionStats events={filteredEvents} />
        </>
      )}

      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onAction={handleCommandAction}
        />
      )}

      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}

      {showDossier && (
        <CountryDossier
          countryCode={showDossier}
          events={filteredEvents}
          allEvents={events}
          onClose={() => setShowDossier(null)}
          onFlyTo={(coords) => {
            flyToLocation(coords)
            setShowDossier(null)
          }}
        />
      )}

      {showTour && (
        <SpotlightTour
          events={filteredEvents}
          onFlyTo={flyToLocation}
          onStop={() => setShowTour(false)}
        />
      )}

      {!isExpressViewport && <EventToast events={filteredEvents} />}
      <MilestoneToast events={events} />
    </div>
  )
}
