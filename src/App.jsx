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
import HomeControls, { Hint } from './components/HUD/HomeControls.jsx'
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
  ordinalOf,
  recordingAudioUrl,
  recordingShareUrl,
  siteIndex,
  siteKey,
  summarizeStats,
} from './utils/recordings.js'
import { lookupPlace } from './utils/location.js'
import { play, stop as stopPlayback, toggle, usePlayer } from './utils/player.js'
import {
  forgetOwnRecording,
  ownRecordingIds,
  ownRecordingToken,
  rememberOwnRecording,
} from './utils/ownRecordings.js'

// Side projects and the (optional) account menu load only when needed.
const FartTagLab = lazy(() => import('./components/HUD/FartTagLab.jsx'))
const FartSommelierSalon = lazy(() => import('./components/HUD/FartSommelierSalon.jsx'))
const AccountHost = lazy(() => import('./components/HUD/AccountControls.jsx'))
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const MAX_EVENTS = 500
const COMPACT_QUERY = '(max-width: 859px)'
const TOP_STRIP = 64 // px under the safe area the top strip covers on phones

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
  const { deleteToken, ingest, audioData, duplicate, ...rest } = event
  return rest
}

// The recording a shared /r/:id page was served with (inlined by the server),
// so its card can open before the list has even loaded.
function sharedFromPage(recordingId) {
  const shared = typeof window !== 'undefined' ? window.__FATW_SHARED__ : null
  return shared && recordingId && shared.id === recordingId ? cleanEvent(shared) : null
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

function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight)
  useEffect(() => {
    const update = () => setHeight(window.innerHeight)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return height
}

// Does this browser already have a Clerk session? Then load accounts right away;
// otherwise only once someone opens the menu (Clerk is ~365 KB).
function hasClerkSession() {
  try {
    return /(?:^|;\s*)__client_uat(?:_[^=]+)?=(?!0(?:;|$))\d+/.test(document.cookie)
  } catch {
    return false
  }
}

// env(safe-area-inset-top) in px (the notch), read once per call
function safeTop() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const value = probe.offsetHeight
  probe.remove()
  return value
}

export default function App({ authEnabled = false }) {
  const compact = useMediaQuery(COMPACT_QUERY)
  const narrowDesktop = useMediaQuery('(max-width: 1100px)') // matches the CSS panel widths
  // Phones held sideways: the front panel becomes a rail on the right edge
  const landscapePhone = useMediaQuery('(max-width: 859px) and (max-height: 500px) and (orientation: landscape)')
  const viewportHeight = useViewportHeight()
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  const [events, setEvents] = useState(() => {
    const shared = sharedFromPage(parseRoute(window.location.pathname).recordingId)
    return shared ? [shared] : []
  })
  const [loadState, setLoadState] = useState('loading')
  const [serverTotal, setServerTotal] = useState(0)
  const [live, setLive] = useState(false)
  const [places, setPlaces] = useState({})
  const [selection, setSelection] = useState(null) // { key, id }
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [recorderActive, setRecorderActive] = useState(false)
  const [launching, setLaunching] = useState(false) // our post is flying to the globe
  const recorderActiveRef = useRef(false)
  recorderActiveRef.current = recorderActive
  const recorderOpenRef = useRef(false)
  recorderOpenRef.current = recorderOpen
  const [listOpen, setListOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [ownIds, setOwnIds] = useState(() => ownRecordingIds())
  const [globeReady, setGlobeReady] = useState(false)
  const [globeWarm, setGlobeWarm] = useState(false) // every dot has switched on
  const [sheetHeights, setSheetHeights] = useState({ card: 0, list: 0 })
  const [accountWanted, setAccountWanted] = useState(() => authEnabled && hasClerkSession())
  const [account, setAccount] = useState(null)
  const pendingSignInRef = useRef(false)
  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem('fatw:hinted') } catch { return true }
  })

  const globeRef = useRef(null)
  const recorderRef = useRef(null)
  const deepLinkRef = useRef(route.recordingId)
  const introDoneRef = useRef(false)
  const revealedRef = useRef(false)
  const deepLinkOpenedRef = useRef(false)
  const ownIdsRef = useRef(ownIds)
  const lastCardRef = useRef(null)
  const requestedPlacesRef = useRef(new Set())
  const toastIdRef = useRef(0)
  const launchRef = useRef(null) // { lat, lng, at, flight } while our own post is landing
  const safeTopRef = useRef(null)
  const player = usePlayer()

  ownIdsRef.current = ownIds

  // ── Toasts ────────────────────────────────────────────────────────────────
  const dismissToast = useCallback(id => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const pushToast = useCallback(toast => {
    const id = ++toastIdRef.current
    setToasts(list => [...list.slice(-2), { tone: 'info', ...toast, id }])
    setTimeout(() => dismissToast(id), toast.duration || 5000)
  }, [dismissToast])

  // ── Data ──────────────────────────────────────────────────────────────────
  const loadSeqRef = useRef(0)
  const selectionRef = useRef(null)
  const removedIdsRef = useRef(new Set())
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current
    try {
      const [list, stats] = await Promise.all([fetchRecordings(MAX_EVENTS), fetchStats().catch(() => null)])
      if (seq !== loadSeqRef.current) return // a newer refresh already answered
      const fresh = list.map(cleanEvent).filter(event => !removedIdsRef.current.has(event.id))
      const freshIds = new Set(fresh.map(event => event.id))
      setEvents(prev => mergeEvents(fresh, prev.filter(event => (
        // Keep what the server list can't know about yet: the open recording
        // (e.g. an older shared link) and anything that arrived in the last minutes.
        !freshIds.has(event.id) &&
        !removedIdsRef.current.has(event.id) &&
        (event.id === selectionRef.current?.id || event.id === deepLinkRef.current || Date.now() - event.timestamp < 3 * 60 * 1000)
      ))))
      if (stats) setServerTotal(stats.totalAllTime || 0)
      setLoadState('ready')
    } catch {
      if (seq !== loadSeqRef.current) return
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

  // Which map site each recording belongs to (nearby recordings share one)
  const siteOf = useMemo(() => siteIndex(sites), [sites])
  const siteOfRef = useRef(siteOf)
  siteOfRef.current = siteOf
  const siteKeyOf = useCallback(event => siteOfRef.current.get(event.id) || siteKey(event.lat, event.lng), [])

  // Place names by site key, and by each recording's own rounded cell (a
  // recording merged into a nearby site still finds its name)
  const placeByKey = useMemo(() => {
    const map = {}
    for (const site of sites) {
      map[site.key] = site.place
      for (const event of site.events) map[siteKey(event.lat, event.lng)] ??= site.place
    }
    return map
  }, [sites])

  // Recordings posted without a place name get looked up once.
  useEffect(() => {
    for (const site of sites) {
      if (site.place || requestedPlacesRef.current.has(site.key)) continue
      requestedPlacesRef.current.add(site.key)
      lookupPlace(site.lat, site.lng)
        .then(result => setPlaces(prev => ({ ...prev, [site.key]: result })))
        .catch(() => {})
    }
  }, [sites])

  const eventsRef = useRef(events)
  eventsRef.current = events
  selectionRef.current = selection

  const eventsById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const chronological = events // already newest-first
  const selectedEvent = selection ? eventsById.get(selection.id) || null : null
  const selectedSite = selection ? sites.find(site => site.key === selection.key) || null : null
  if (selectedEvent) lastCardRef.current = { event: selectedEvent, site: selectedSite }

  const stats = useMemo(() => (
    loadState === 'ready' ? { ...summarizeStats(events, serverTotal), places: sites.length } : null
  ), [events, serverTotal, loadState, sites])

  const ordinal = useMemo(() => (
    selectedEvent && loadState === 'ready' ? ordinalOf(events, selectedEvent.id) : null
  ), [events, selectedEvent, loadState])

  // The site whose recording is audibly playing (the globe pulses it)
  const playingEvent = player.status === 'playing' ? eventsById.get(player.id) : null
  const playingKey = playingEvent ? siteKeyOf(playingEvent) : null

  // ── Camera ────────────────────────────────────────────────────────────────
  const fly = useCallback((target, style = 'push', ms) => (
    globeRef.current?.flyTo(
      { lat: target.lat, lng: target.lng, altitude: target.altitude },
      { style, ms },
    ) || Promise.resolve()
  ), [])

  // ── Selection ─────────────────────────────────────────────────────────────
  const dismissHint = useCallback(() => {
    setShowHint(false)
    try { localStorage.setItem('fatw:hinted', '1') } catch { /* private mode */ }
  }, [])

  const select = useCallback((event, { autoplay = false, fly: shouldFly = true, style = 'push', flyMs } = {}) => {
    if (!event) return
    setSelection({ key: siteKeyOf(event), id: event.id })
    setListOpen(false)
    globeRef.current?.highlight?.(null) // a touch "hover" from the list never ends by itself
    dismissHint()
    // Must run inside the tap for iOS to allow audio.
    if (autoplay) play(event.id, recordingAudioUrl(event.id), { duration: event.duration })
    if (shouldFly) fly({ lat: event.lat, lng: event.lng }, style, flyMs)
    replaceUrl(`/r/${event.id}`)
  }, [dismissHint, fly, siteKeyOf])

  const selectSite = useCallback((key, { again = false } = {}) => {
    const site = sites.find(candidate => candidate.key === key)
    if (!site) return
    let event = site.events[0]
    // Tapping the dot that's already open plays the next fart recorded there
    if (again && selectionRef.current?.key === key) {
      const index = site.events.findIndex(candidate => candidate.id === selectionRef.current.id)
      event = site.events[(index + 1) % site.events.length]
    }
    select(event, { autoplay: true, fly: !again })
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
    select(next, { autoplay: true, style: 'crane' })
  }, [chronological, selection, select])

  const shuffle = useCallback(() => {
    if (!chronological.length) return
    const pool = chronological.length > 1 ? chronological.filter(event => event.id !== selection?.id) : chronological
    select(pool[Math.floor(Math.random() * pool.length)], { autoplay: true, style: 'whip' })
  }, [chronological, selection, select])

  // ── Live feed ─────────────────────────────────────────────────────────────
  const handleIncoming = useCallback(raw => {
    const event = cleanEvent(raw)
    if (removedIdsRef.current.has(event.id)) return
    const isNew = !eventsRef.current.some(existing => existing.id === event.id)
    setEvents(prev => mergeEvents(prev, [event]))
    if (isNew) setServerTotal(total => total + 1)
    // Give our own POST a moment to register so we don't announce ourselves.
    setTimeout(() => {
      if (ownIdsRef.current.has(event.id)) return
      const launch = launchRef.current
      if (launch && Math.abs(launch.lat - event.lat) <= 0.02 && Math.abs(launch.lng - event.lng) <= 0.05 && Date.now() - launch.at < 20_000) return
      globeRef.current?.burst(event.lat, event.lng, { color: '#ffa537' })
      // No "Listen" offers over an open recorder: playing one would end up in the take
      if (recorderOpenRef.current) return
      const place = describePlace(event)
      pushToast({
        tone: 'new',
        eventId: event.id,
        text: <>New fart from <strong>{place.title}</strong></>,
        actionLabel: 'Listen',
        action: () => select(event, { autoplay: true, style: 'crane' }),
        duration: 8000,
      })
    }, 1500)
  }, [pushToast, select])

  // Runs for our own deletes and again when the server broadcasts them.
  const playerIdRef = useRef(null)
  playerIdRef.current = player.id
  const handleRemoved = useCallback(id => {
    if (!id || removedIdsRef.current.has(id)) return
    removedIdsRef.current.add(id)
    setEvents(prev => prev.filter(event => event.id !== id))
    setToasts(list => list.filter(toast => toast.eventId !== id)) // no "Listen" to a deleted fart
    setServerTotal(total => Math.max(0, total - 1))
    setSelection(current => {
      if (current?.id !== id) return current
      replaceUrl('/')
      return null
    })
    if (playerIdRef.current === id) stopPlayback()
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

  // ── First view ────────────────────────────────────────────────────────────
  // 1. When the data and the globe are ready, tell the splash (fatw:ready).
  // 2. When the splash starts to leave (fatw:reveal), the instrument warms up
  //    and the camera frames every fart — or flies to a shared one.
  // 3. On a shared link, the splash's PLAY key fires fatw:play inside the tap,
  //    so the fart starts playing immediately (iOS needs the gesture).
  const openDeepLink = useCallback(({ autoplay }) => {
    const id = deepLinkRef.current
    if (!id) return false
    deepLinkOpenedRef.current = true
    const known = eventsRef.current.find(event => event.id === id)
    if (known) {
      deepLinkRef.current = null
      select(known, { autoplay, style: 'crane', flyMs: 1800 })
      return true
    }
    fetchRecording(id)
      .then(event => {
        if (deepLinkRef.current !== id) return
        deepLinkRef.current = null
        const clean = cleanEvent(event)
        setEvents(prev => mergeEvents(prev, [clean]))
        select(clean, { style: 'crane', flyMs: 1800 })
      })
      .catch(error => {
        if (deepLinkRef.current !== id) return
        if (error?.status === 404) {
          deepLinkRef.current = null
          replaceUrl('/')
          pushToast({ tone: 'error', text: 'That fart has left the building. It was deleted, or never existed.' })
          globeRef.current?.frameAll?.(2200)
        } else {
          pushToast({ tone: 'error', text: "Couldn't load that fart. Trying again…" })
          setTimeout(() => { if (deepLinkRef.current === id) openDeepLinkRef.current({ autoplay: false }) }, 4000)
        }
      })
    return true
  }, [select, pushToast])
  const openDeepLinkRef = useRef(openDeepLink)
  openDeepLinkRef.current = openDeepLink

  const reveal = useCallback(() => {
    if (revealedRef.current) return
    revealedRef.current = true
    globeRef.current?.warmUp?.()
    // A shared link (possibly already opened by the splash's PLAY key) flies
    // to its own pin; only a plain visit frames the whole map.
    if (openDeepLink({ autoplay: false }) || deepLinkOpenedRef.current) return
    const g = globeRef.current
    const framing = g?.frameAll ? g.frameAll(2400) : null
    if (framing?.then) framing.then(() => g.resumeAutoRotate?.())
    else setTimeout(() => g?.resumeAutoRotate?.(), 2600)
  }, [openDeepLink])

  useEffect(() => {
    if (loadState === 'loading' || !globeReady || introDoneRef.current) return
    introDoneRef.current = true
    window.dispatchEvent(new Event('fatw:ready'))
    // No splash on screen (already gone, or it never ran): reveal right away
    if (!document.getElementById('boot')) reveal()
  }, [loadState, globeReady, reveal])

  useEffect(() => {
    const onReveal = () => reveal()
    const onPlay = () => {
      // Inside the splash's tap: play first, then everything else
      openDeepLink({ autoplay: true })
      reveal()
    }
    window.addEventListener('fatw:reveal', onReveal)
    window.addEventListener('fatw:play', onPlay)
    return () => {
      window.removeEventListener('fatw:reveal', onReveal)
      window.removeEventListener('fatw:play', onPlay)
    }
  }, [reveal, openDeepLink])

  // Never leave the splash up forever if the globe texture is slow (or fails to
  // load) — carry on without it so shared links and the intro still happen.
  useEffect(() => {
    const timer = setTimeout(() => setGlobeReady(true), 6000)
    return () => clearTimeout(timer)
  }, [])

  // ── Recorder / posting ──────────────────────────────────────────────────
  // Call from inside a tap or key press: the recorder arms the microphone in
  // that same gesture (iOS), so one tap goes straight to the countdown.
  const openRecorder = useCallback(() => {
    recorderRef.current?.quickStart?.()
    setListOpen(false)
    setAboutOpen(false)
    setRecorderOpen(true)
  }, [])

  // Where the new pin will be once the camera arrives: the launch move centres
  // it on the globe, which sits at the middle of the screen plus its offset
  // (no drawer or deck is open at that moment).
  const getLandingPoint = useCallback(() => ({
    x: window.innerWidth / 2 + (compact ? 0 : narrowDesktop ? 158 : 170),
    y: window.innerHeight / 2,
  }), [compact, narrowDesktop])

  const handleLaunch = useCallback(({ lat, lng }) => {
    // Start the camera now, so the pin is centred by the time the drawer is
    // gone (the globe keeps rendering under the drawer while it does)
    setLaunching(true)
    const flight = fly({ lat, lng, altitude: compact ? 1.5 : 1.3 }, 'crane', 1300)
    launchRef.current = { lat, lng, at: Date.now(), flight }
  }, [fly, compact])

  const handlePosted = useCallback(created => {
    const event = cleanEvent(created)
    rememberOwnRecording(event.id, created.deleteToken)
    setOwnIds(prev => new Set(prev).add(event.id))
    setEvents(prev => mergeEvents(prev, [event]))
    // The recorder closes itself as the slip flies; only tidy up if it's idle
    // (never cancel a new take someone started in the meantime).
    if (!recorderActiveRef.current) setRecorderOpen(false)
    const flight = launchRef.current?.flight || fly({ lat: event.lat, lng: event.lng }, 'crane', 1300)
    launchRef.current = { lat: event.lat, lng: event.lng, at: Date.now(), flight }
    Promise.resolve(flight)
      .then(() => globeRef.current?.land?.(event.lat, event.lng))
      .catch(() => {})
      .then(() => {
        // The fart plays as it lands (the audio element was unlocked by an
        // earlier tap; if the browser refuses, the deck's PLAY key is right there).
        setLaunching(false)
        select(event, { fly: false, autoplay: true })
        pushToast({ tone: 'success', text: 'Posted. Your fart is on the map.' })
      })
  }, [fly, select, pushToast])

  const handleDelete = useCallback(async event => {
    const token = ownRecordingToken(event.id)
    if (!token) {
      pushToast({ tone: 'error', text: 'This one can only be deleted from the device that posted it.' })
      return
    }
    try {
      await deleteRecording(event.id, token)
    } catch (error) {
      if (error?.status !== 404) {
        pushToast({ tone: 'error', text: error.message || 'Could not delete it. Try again?' })
        return
      }
      // Already gone: treat it as deleted
    }
    forgetOwnRecording(event.id)
    setOwnIds(prev => {
      const next = new Set(prev)
      next.delete(event.id)
      return next
    })
    handleRemoved(event.id)
    stopPlayback()
    pushToast({ tone: 'info', text: 'Deleted. It never happened.' })
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
      pushToast({ tone: 'info', text: 'Link copied. Send it to someone who deserves it.' })
    } catch {
      pushToast({ tone: 'info', text: url, duration: 10000 })
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
    if (route.page === 'home') {
      // A fresh globe mounts: run its intro again (warm-up and framing)
      setGlobeReady(false)
      setGlobeWarm(false)
      introDoneRef.current = false
      revealedRef.current = false
      deepLinkOpenedRef.current = false
    }
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
        if (event.repeat) return
        event.preventDefault()
        openRecorder()
      } else if (key === 'Escape') {
        if (selection) closeSelection()
        else if (listOpen) setListOpen(false)
      } else if (key === ' ' && selectedEvent && !event.target.closest?.('button')) {
        event.preventDefault()
        toggle(selectedEvent.id, recordingAudioUrl(selectedEvent.id), { duration: selectedEvent.duration })
      } else if ((key === 'ArrowRight' || key === 'ArrowLeft') && selection) {
        if (event.repeat) return
        step(key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.page, recorderOpen, aboutOpen, selection, selectedEvent, listOpen, openRecorder, closeSelection, step])

  const onAccountChange = useCallback(next => {
    setAccount(next.status === 'loading' ? null : next)
    if (pendingSignInRef.current && next.status === 'signedOut') {
      pendingSignInRef.current = false
      next.openSignIn()
    }
  }, [])

  const onCardHeight = useCallback(height => setSheetHeights(prev => (prev.card === height ? prev : { ...prev, card: height })), [])
  const onListHeight = useCallback(height => setSheetHeights(prev => (prev.list === height ? prev : { ...prev, list: height })), [])

  // ── Render ────────────────────────────────────────────────────────────────
  if (route.page !== 'home') {
    return (
      <div className="subpage">
        <header className="subpage__bar">
          <button type="button" className="pill-button" onClick={() => navigate('/')}>
            <Icon name="back" size={18} /> Back to the map
          </button>
          <span className="subpage__brand">Farts Around the World</span>
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

  // Keep the selected pin centred in the space the panels leave free. On
  // phones that's between the top strip and the top of the open drawer.
  let globeOffsetY = 0
  if (compact) {
    const covered = cardOpen ? sheetHeights.card : listOpen ? sheetHeights.list : 0
    if (covered > 0) {
      if (safeTopRef.current == null) safeTopRef.current = safeTop()
      const top = safeTopRef.current + TOP_STRIP
      const freeCenter = top + (viewportHeight - covered - top) / 2
      globeOffsetY = Math.round(freeCenter - viewportHeight / 2)
    }
  }
  const globeOffsetX = compact
    ? (landscapePhone && !cardOpen && !listOpen && !recorderOpen ? -52 : 0)
    : cardOpen ? (narrowDesktop ? -29 : -32) : (narrowDesktop ? 158 : 170)

  const list = (
    <RecordingList
      events={events}
      places={placeByKey}
      selectedId={selection?.id}
      loadState={loadState}
      ownIds={ownIds}
      onSelect={(event, options) => select(event, { ...options, style: 'crane' })}
      onHover={event => globeRef.current?.highlight(event ? siteKeyOf(event) : null)}
      onRecord={openRecorder}
      onRetry={load}
    />
  )

  const menuExtra = authEnabled ? (
    account?.status === 'signedIn' ? (
      <>
        <div className="menu__divider" />
        <button type="button" role="menuitem" onClick={() => account.openProfile()}>
          <Icon name="link" size={18} />
          <span><strong>{account.name || 'Your account'}</strong><em>Signed in</em></span>
        </button>
        <button type="button" role="menuitem" onClick={() => account.signOut()}>
          <Icon name="back" size={18} />
          <span><strong>Sign out</strong><em>Your farts stay on the map</em></span>
        </button>
      </>
    ) : (
      <>
        <div className="menu__divider" />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            if (account?.openSignIn) account.openSignIn()
            else pendingSignInRef.current = true
          }}
        >
          <Icon name="link" size={18} />
          <span><strong>Sign in</strong><em>{account ? 'Optional — not needed to record' : 'Loading…'}</em></span>
        </button>
      </>
    )
  ) : null

  return (
    <div className={`home ${compact ? 'home--compact' : 'home--wide'} ${cardOpen ? 'has-card' : ''} ${recorderOpen ? 'has-recorder' : ''}`}>
      <div className="home__globe">
        <GlobeCanvas
          ref={globeRef}
          sites={sites}
          selectedKey={selection?.key || null}
          playingKey={playingKey}
          compact={compact}
          offsetX={globeOffsetX}
          offsetY={globeOffsetY}
          paused={recorderActive && compact && !launching}
          dimmed={recorderOpen}
          onSiteSelect={(key, options) => selectSite(key, options)}
          onBackgroundClick={() => { if (selection) closeSelection() }}
          onReady={() => setGlobeReady(true)}
          onWarmupDone={() => setGlobeWarm(true)}
        />
      </div>

      <TopBar
        stats={stats}
        live={live}
        onNavigate={navigate}
        onAbout={() => {
          setListOpen(false)
          setAboutOpen(true)
        }}
        menuExtra={menuExtra}
        onMenuOpen={() => { if (authEnabled) setAccountWanted(true) }}
      />

      {authEnabled && accountWanted && (
        <Suspense fallback={null}>
          <AccountHost publishableKey={CLERK_KEY} onChange={onAccountChange} />
        </Suspense>
      )}

      {!compact && <aside className="side-panel chassis" aria-label="All farts">{list}</aside>}
      {compact && (
        <Sheet
          open={listOpen}
          onClose={() => setListOpen(false)}
          variant="list"
          label="All farts"
          modal
          initialFocus=".presets--sort [aria-pressed='true']"
          onHeightChange={onListHeight}
        >
          {list}
        </Sheet>
      )}

      <Sheet open={cardOpen} onClose={closeSelection} variant="card" label="Selected fart" onHeightChange={onCardHeight}>
        {card?.event && (
          <RecordingCard
            site={card.site}
            recording={card.event}
            isOwn={ownIds.has(card.event.id)}
            ordinal={ordinal}
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

      <HomeControls
        compact={compact}
        hidden={cardOpen || listOpen}
        canShuffle={events.length > 0}
        total={stats?.total ?? null}
        onRecord={openRecorder}
        onList={() => setListOpen(true)}
        onShuffle={shuffle}
      />

      {showHint && globeReady && globeWarm && events.length > 0 && !cardOpen && !listOpen && !recorderOpen && !launching && (
        <Hint compact={compact} onDismiss={dismissHint} />
      )}

      <RecorderSheet
        ref={recorderRef}
        open={recorderOpen}
        totalCount={stats?.total ?? null}
        onClose={() => setRecorderOpen(false)}
        onLaunch={handleLaunch}
        onPosted={handlePosted}
        getLandingPoint={getLandingPoint}
        onPostFailed={message => setLaunching(false) || pushToast({
          tone: 'error',
          text: `Your fart didn't post (${message}). It's still saved in the recorder.`,
          actionLabel: 'Open',
          action: openRecorder,
          duration: 12000,
        })}
        onActiveChange={active => {
          setRecorderActive(active)
          if (active) setLaunching(false)
        }}
      />

      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} onRecord={openRecorder} />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
