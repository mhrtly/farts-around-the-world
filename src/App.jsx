import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GlobeCanvas from './components/Globe/GlobeCanvas.jsx'
import TopBar from './components/HUD/TopBar.jsx'
import RecordingList from './components/HUD/RecordingList.jsx'
import RecordingCard from './components/HUD/RecordingCard.jsx'
import RecorderSheet from './components/HUD/RecorderSheet.jsx'
import AboutPanel from './components/HUD/AboutPanel.jsx'
import Sheet from './components/HUD/Sheet.jsx'
import Toasts from './components/HUD/Toasts.jsx'
import Icon from './components/HUD/Icon.jsx'
import { AccountAvatar, AccountMenuItem } from './components/HUD/AccountControls.jsx'
import {
  connectLive,
  deleteRecording,
  fetchRecording,
  fetchRecordings,
  fetchStats,
} from './data/recordingsApi.js'
import {
  describePlace,
  groupIntoSites,
  recordingAudioUrl,
  recordingShareUrl,
  siteKey,
  summarizeStats,
} from './utils/recordings.js'
import { lookupPlace } from './utils/location.js'
import { play, stop as stopPlayback, toggle } from './utils/player.js'
import {
  forgetOwnRecording,
  ownRecordingIds,
  ownRecordingToken,
  rememberOwnRecording,
} from './utils/ownRecordings.js'

// Side projects load only when someone visits them.
const FartTagLab = lazy(() => import('./components/HUD/FartTagLab.jsx'))
const FartSommelierSalon = lazy(() => import('./components/HUD/FartSommelierSalon.jsx'))

const MAX_EVENTS = 500
const COMPACT_QUERY = '(max-width: 859px)'

function parseRoute(pathname) {
  if (pathname.startsWith('/sommelier')) return { page: 'sommelier' }
  if (pathname.startsWith('/archive-lab')) return { page: 'archive' }
  const match = pathname.match(/^\/r\/([A-Za-z0-9-]{8,64})\/?$/)
  return { page: 'home', recordingId: match ? match[1] : null }
}

function replaceUrl(path) {
  if (window.location.pathname !== path) window.history.replaceState(null, '', path)
}

function mergeEvents(current, incoming) {
  const byId = new Map(current.map(event => [event.id, event]))
  for (const event of incoming) byId.set(event.id, { ...byId.get(event.id), ...event })
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_EVENTS)
}

function cleanEvent(event) {
  const { deleteToken, ingest, audioData, ...rest } = event
  return rest
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

export default function App({ authEnabled = false }) {
  const compact = useMediaQuery(COMPACT_QUERY)
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  const [events, setEvents] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [serverTotal, setServerTotal] = useState(0)
  const [live, setLive] = useState(false)
  const [places, setPlaces] = useState({})
  const [selection, setSelection] = useState(null) // { key, id }
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [recorderActive, setRecorderActive] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [ownIds, setOwnIds] = useState(() => ownRecordingIds())
  const [globeReady, setGlobeReady] = useState(false)

  const globeRef = useRef(null)
  const deepLinkRef = useRef(route.recordingId)
  const introDoneRef = useRef(false)
  const ownIdsRef = useRef(ownIds)
  const lastCardRef = useRef(null)
  const requestedPlacesRef = useRef(new Set())
  const toastIdRef = useRef(0)

  ownIdsRef.current = ownIds

  // ── Toasts ────────────────────────────────────────────────────────────────
  const dismissToast = useCallback(id => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const pushToast = useCallback(toast => {
    const id = ++toastIdRef.current
    setToasts(list => [...list.slice(-2), { ...toast, id }])
    setTimeout(() => dismissToast(id), toast.duration || 5000)
  }, [dismissToast])

  // ── Data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([fetchRecordings(MAX_EVENTS), fetchStats().catch(() => null)])
      setEvents(list.map(cleanEvent))
      if (stats) setServerTotal(stats.totalAllTime || 0)
      setLoadState('ready')
    } catch {
      setLoadState(state => (state === 'ready' ? 'ready' : 'error'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Resync when the tab comes back after a while
  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [load])

  // Poll only while the live socket is down
  useEffect(() => {
    if (live) return undefined
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [live, load])

  const sites = useMemo(() => groupIntoSites(events).map(site => (
    site.place ? site : { ...site, place: places[site.key]?.place || null }
  )), [events, places])

  const placeByKey = useMemo(() => {
    const map = {}
    for (const site of sites) map[site.key] = site.place
    return map
  }, [sites])

  // Older recordings were posted without a place name — look them up once.
  useEffect(() => {
    for (const site of sites) {
      if (site.place || requestedPlacesRef.current.has(site.key)) continue
      requestedPlacesRef.current.add(site.key)
      lookupPlace(site.lat, site.lng)
        .then(result => setPlaces(prev => ({ ...prev, [site.key]: result })))
        .catch(() => {})
    }
  }, [sites])

  const eventsById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const chronological = events // already newest-first
  const selectedEvent = selection ? eventsById.get(selection.id) || null : null
  const selectedSite = selection ? sites.find(site => site.key === selection.key) || null : null
  if (selectedEvent) lastCardRef.current = { event: selectedEvent, site: selectedSite }

  const stats = useMemo(() => (
    loadState === 'ready' || events.length ? summarizeStats(events, serverTotal) : null
  ), [events, serverTotal, loadState])

  // ── Selection ─────────────────────────────────────────────────────────────
  const select = useCallback((event, { autoplay = false, fly = true, flyMs } = {}) => {
    if (!event) return
    setSelection({ key: siteKey(event.lat, event.lng), id: event.id })
    setListOpen(false)
    // Must run inside the tap for iOS to allow audio.
    if (autoplay) play(event.id, recordingAudioUrl(event.id), { duration: event.duration })
    if (fly) globeRef.current?.flyTo({ lat: event.lat, lng: event.lng, altitude: compact ? 1.3 : 1.2 }, flyMs)
    replaceUrl(`/r/${event.id}`)
  }, [compact])

  const selectSite = useCallback((key, options) => {
    const site = sites.find(candidate => candidate.key === key)
    if (site) select(site.events[0], options)
  }, [sites, select])

  const closeSelection = useCallback(() => {
    setSelection(null)
    stopPlayback()
    replaceUrl('/')
  }, [])

  const step = useCallback(direction => {
    if (!chronological.length) return
    const index = chronological.findIndex(event => event.id === selection?.id)
    const next = chronological[(index + direction + chronological.length) % chronological.length]
    select(next, { autoplay: true })
  }, [chronological, selection, select])

  const shuffle = useCallback(() => {
    if (!chronological.length) return
    const pool = chronological.length > 1 ? chronological.filter(event => event.id !== selection?.id) : chronological
    select(pool[Math.floor(Math.random() * pool.length)], { autoplay: true })
  }, [chronological, selection, select])

  // ── Live feed ─────────────────────────────────────────────────────────────
  const handleIncoming = useCallback(raw => {
    const event = cleanEvent(raw)
    setEvents(prev => mergeEvents(prev, [event]))
    setServerTotal(total => total + 1)
    // Give our own POST a moment to register so we don't announce ourselves.
    setTimeout(() => {
      if (ownIdsRef.current.has(event.id)) return
      globeRef.current?.burst(event.lat, event.lng, { color: '#9dff4a' })
      const place = describePlace(event)
      pushToast({
        icon: '💨',
        text: <>New fart from <strong>{place.title}</strong></>,
        actionLabel: 'Listen',
        action: () => select(event, { autoplay: true }),
        duration: 8000,
      })
    }, 1200)
  }, [pushToast, select])

  const handleRemoved = useCallback(id => {
    if (!id) return
    setEvents(prev => prev.filter(event => event.id !== id))
    setServerTotal(total => Math.max(0, total - 1))
    setSelection(current => {
      if (current?.id !== id) return current
      replaceUrl('/')
      return null
    })
  }, [])

  // One socket for the app's lifetime; handlers are read through a ref.
  const liveHandlersRef = useRef({})
  liveHandlersRef.current = { handleIncoming, handleRemoved, load }
  useEffect(() => {
    let wasLive = false
    return connectLive({
      onNew: event => liveHandlersRef.current.handleIncoming(event),
      onDeleted: id => liveHandlersRef.current.handleRemoved(id),
      onStatus: connected => {
        setLive(connected)
        // Catch up on anything missed while disconnected
        if (connected && !wasLive && introDoneRef.current) liveHandlersRef.current.load()
        wasLive = connected
      },
    })
  }, [])

  // ── First view: shared link, or the most recent fart ─────────────────────
  useEffect(() => {
    if (loadState === 'loading' || !globeReady || introDoneRef.current) return
    introDoneRef.current = true
    window.dispatchEvent(new Event('fatw:ready'))

    const id = deepLinkRef.current
    deepLinkRef.current = null
    if (id) {
      const known = eventsById.get(id)
      if (known) {
        select(known, { flyMs: 1800 })
      } else {
        fetchRecording(id)
          .then(event => {
            const clean = cleanEvent(event)
            setEvents(prev => mergeEvents(prev, [clean]))
            select(clean, { flyMs: 1800 })
          })
          .catch(() => {
            replaceUrl('/')
            pushToast({ icon: '🫥', text: 'That fart has left the building (it was deleted or never existed).' })
          })
      }
      return
    }

    const latest = events[0]
    if (latest) {
      globeRef.current?.flyTo({ lat: latest.lat - (compact ? 8 : 4), lng: latest.lng + 10, altitude: compact ? 2.5 : 2.1 }, 2200)
      setTimeout(() => globeRef.current?.resumeAutoRotate(), 2600)
    }
  }, [loadState, globeReady, events, eventsById, select, compact, pushToast])

  // Never leave the splash up forever if the globe texture is slow
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('fatw:ready')), 6000)
    return () => clearTimeout(timer)
  }, [])

  // ── Recorder / posting ──────────────────────────────────────────────────
  const openRecorder = useCallback(() => {
    setListOpen(false)
    setAboutOpen(false)
    setRecorderOpen(true)
  }, [])

  const handlePosted = useCallback(created => {
    const event = cleanEvent(created)
    rememberOwnRecording(event.id, created.deleteToken)
    setOwnIds(prev => new Set(prev).add(event.id))
    setEvents(prev => mergeEvents(prev, [event]))
    setTimeout(() => {
      setRecorderOpen(false)
      setTimeout(() => {
        select(event, { flyMs: 1600 })
        setTimeout(() => globeRef.current?.burst(event.lat, event.lng, { color: '#9dff4a', big: true }), 1400)
        pushToast({ icon: '🎉', tone: 'success', text: 'Posted! Your fart is officially on the map.' })
      }, 380)
    }, 1100)
  }, [select, pushToast])

  const handleDelete = useCallback(async event => {
    const token = ownRecordingToken(event.id)
    if (!token) {
      pushToast({ icon: '🔒', text: 'This one can only be deleted from the device that posted it.' })
      return
    }
    try {
      await deleteRecording(event.id, token)
      forgetOwnRecording(event.id)
      setOwnIds(prev => {
        const next = new Set(prev)
        next.delete(event.id)
        return next
      })
      handleRemoved(event.id)
      stopPlayback()
      pushToast({ icon: '🧹', text: 'Deleted. It never happened.' })
    } catch (error) {
      pushToast({ icon: '⚠️', tone: 'error', text: error.message || 'Could not delete it. Try again?' })
    }
  }, [handleRemoved, pushToast])

  const handleShare = useCallback(async (event, place) => {
    const url = recordingShareUrl(event.id)
    const title = `A fart from ${place.title}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title}. Listen:`, url })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      pushToast({ icon: '🔗', text: 'Link copied. Send it to someone who deserves it.' })
    } catch {
      pushToast({ icon: '🔗', text: url, duration: 10000 })
    }
  }, [pushToast])

  // ── Routing ───────────────────────────────────────────────────────────────
  const navigate = useCallback(path => {
    window.history.pushState(null, '', path)
    setRoute(parseRoute(path))
    setSelection(null)
    setRecorderOpen(false)
    setListOpen(false)
    stopPlayback()
  }, [])

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.routeMode = route.page === 'home' ? 'home' : 'subpage'
    if (route.page !== 'home') window.dispatchEvent(new Event('fatw:ready'))
    if (route.page === 'home') setGlobeReady(false)
  }, [route.page])

  // ── Keyboard (desktop) ──────────────────────────────────────────────────
  useEffect(() => {
    if (route.page !== 'home') return undefined
    const onKey = event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (recorderOpen || aboutOpen) return
      const key = event.key
      if (key === 'r' || key === 'R') {
        event.preventDefault()
        openRecorder()
      } else if (key === 'Escape') {
        if (selection) closeSelection()
        else if (listOpen) setListOpen(false)
      } else if (key === ' ' && selectedEvent && !event.target.closest?.('button')) {
        event.preventDefault()
        toggle(selectedEvent.id, recordingAudioUrl(selectedEvent.id), { duration: selectedEvent.duration })
      } else if (key === 'ArrowRight' && selection) {
        step(1)
      } else if (key === 'ArrowLeft' && selection) {
        step(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.page, recorderOpen, aboutOpen, selection, selectedEvent, listOpen, openRecorder, closeSelection, step])

  // ── Render ────────────────────────────────────────────────────────────────
  if (route.page !== 'home') {
    return (
      <div className="subpage">
        <header className="subpage__bar">
          <button type="button" className="pill-button" onClick={() => navigate('/')}>
            <Icon name="back" size={18} /> Back to the map
          </button>
          <span className="subpage__brand">💨 Farts Around the World</span>
        </header>
        <main className={`route-stage route-stage--${route.page}`}>
          <div className="route-stage__inner">
            <Suspense fallback={<div className="subpage__loading"><span className="spinner" /> Loading…</div>}>
              {route.page === 'sommelier'
                ? <FartSommelierSalon onClose={() => navigate('/')} pageMode />
                : <FartTagLab onClose={() => navigate('/')} pageMode />}
            </Suspense>
          </div>
        </main>
      </div>
    )
  }

  const card = selectedEvent ? { event: selectedEvent, site: selectedSite } : lastCardRef.current
  const cardOpen = Boolean(selectedEvent)
  const globeOffset = compact
    ? cardOpen ? -Math.round(window.innerHeight * 0.2) : listOpen ? -Math.round(window.innerHeight * 0.24) : 0
    : 0

  const list = (
    <RecordingList
      events={events}
      places={placeByKey}
      selectedId={selection?.id}
      loadState={loadState}
      ownIds={ownIds}
      onSelect={select}
      onRecord={openRecorder}
      onRetry={load}
    />
  )

  return (
    <div className={`home ${compact ? 'home--compact' : 'home--wide'} ${cardOpen ? 'has-card' : ''}`}>
      <div className="home__globe">
        <GlobeCanvas
          ref={globeRef}
          sites={sites}
          selectedKey={selection?.key || null}
          compact={compact}
          offsetY={globeOffset}
          paused={recorderActive && compact}
          onSiteSelect={key => selectSite(key, { autoplay: true })}
          onBackgroundClick={() => { if (selection) closeSelection() }}
          onReady={() => setGlobeReady(true)}
        />
      </div>

      <TopBar
        stats={stats}
        live={live}
        onNavigate={navigate}
        onAbout={() => setAboutOpen(true)}
        accountSlot={authEnabled ? <AccountAvatar /> : null}
        menuExtra={authEnabled ? <AccountMenuItem /> : null}
      />

      {!compact && <aside className="side-panel" aria-label="Latest farts">{list}</aside>}
      {compact && (
        <Sheet open={listOpen} onClose={() => setListOpen(false)} variant="list" label="Latest farts" modal>
          {list}
        </Sheet>
      )}

      <Sheet open={cardOpen} onClose={closeSelection} variant="card" label="Selected fart">
        {card?.event && (
          <RecordingCard
            site={card.site}
            recording={card.event}
            isOwn={ownIds.has(card.event.id)}
            onSelectRecording={event => select(event, { autoplay: true, fly: false })}
            onClose={closeSelection}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onShuffle={shuffle}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        )}
      </Sheet>

      {compact ? (
        <nav className={`dock ${cardOpen || listOpen ? 'is-hidden' : ''}`} aria-label="Actions">
          <button type="button" className="dock__side" onClick={() => setListOpen(true)}>
            <Icon name="list" size={22} />
            <span>Latest</span>
          </button>
          <button type="button" className="dock__rec" onClick={openRecorder} aria-label="Record a fart">
            <span className="dock__rec-ring" aria-hidden="true" />
            <span className="dock__rec-core" aria-hidden="true" />
          </button>
          <button type="button" className="dock__side" onClick={shuffle} disabled={!events.length}>
            <Icon name="shuffle" size={22} />
            <span>Random</span>
          </button>
        </nav>
      ) : (
        <div className="record-cta-wrap">
          <button type="button" className="record-cta" onClick={openRecorder}>
            <span className="record-cta__dot" aria-hidden="true" />
            Record a fart
            <kbd>R</kbd>
          </button>
          <button type="button" className="shuffle-cta" onClick={shuffle} disabled={!events.length} title="Play a random fart">
            <Icon name="shuffle" size={18} /> Random
          </button>
        </div>
      )}

      <RecorderSheet
        open={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onPosted={handlePosted}
        onActiveChange={setRecorderActive}
      />

      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} onRecord={openRecorder} />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
