import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GlobeCanvas from './components/Globe/GlobeCanvas.jsx'
import ZoomControls from './components/HUD/ZoomControls.jsx'
import TopBar from './components/HUD/TopBar.jsx'
import RecordingList from './components/HUD/RecordingList.jsx'
import RecordingCard from './components/HUD/RecordingCard.jsx'
import RecorderSheet from './components/HUD/RecorderSheet.jsx'
import AboutPanel from './components/HUD/AboutPanel.jsx'
import Sheet from './components/HUD/Sheet.jsx'
import Toasts from './components/HUD/Toasts.jsx'
import Icon from './components/HUD/Icon.jsx'
import HomeControls, { Hint, Whisper } from './components/HUD/HomeControls.jsx'
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

// Marked, so a reload of a fart you opened isn't greeted as a shared link
function replaceUrl(path) {
  if (window.location.pathname !== path) window.history.replaceState({ fatwOpened: true }, '', path)
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
  const loadStateRef = useRef('loading')
  loadStateRef.current = loadState
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
  const deepLinkTriesRef = useRef(0)
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

  // Poll while the live socket is down, and keep retrying (faster) until
  // the list has loaded at least once
  useEffect(() => {
    if (live && loadState !== 'error') return undefined
    const timer = setInterval(load, loadState === 'error' ? 10_000 : 30_000)
    return () => clearInterval(timer)
  }, [live, load, loadState])

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

  // The recording that's audibly playing (the globe pulses its marker)
  const playingEvent = player.status === 'playing' ? eventsById.get(player.id) : null

  // ── Camera ────────────────────────────────────────────────────────────────
  const fly = useCallback((target, style = 'push', ms, extra) => (
    globeRef.current?.flyTo(
      { lat: target.lat, lng: target.lng, altitude: target.altitude },
      { style, ms, ...extra },
    ) || Promise.resolve()
  ), [])

  // The tab title follows the open fart (shared links arrive titled by the server)
  useEffect(() => {
    if (route.page !== 'home') return
    document.title = selectedEvent ? `A fart from ${describePlace(selectedEvent).title}` : 'Farts Around the World'
  }, [selectedEvent, route.page])

  // ── Selection ─────────────────────────────────────────────────────────────
  const dismissHint = useCallback(() => {
    setShowHint(false)
    try { localStorage.setItem('fatw:hinted', '1') } catch { /* private mode */ }
  }, [])

  const tourRef = useRef(null) // { queue, index, id, timer, playing } while touring
  const [touring, setTouring] = useState(false)
  const endTour = useCallback(() => {
    const tour = tourRef.current
    if (!tour) return
    clearTimeout(tour.timer)
    tourRef.current = null
    setTouring(false)
  }, [])

  const select = useCallback((event, { autoplay = false, fly: shouldFly = true, style = 'push', flyMs, fromTour = false } = {}) => {
    if (!event) return
    if (!fromTour) endTour() // the user picked something: the tour's over
    setSelection({ key: siteKeyOf(event), id: event.id })
    setListOpen(false)
    globeRef.current?.highlight?.(null) // a touch "hover" from the list never ends by itself
    dismissHint()
    // Must run inside the tap for iOS to allow audio.
    if (autoplay) play(event.id, recordingAudioUrl(event.id), { duration: event.duration })
    if (shouldFly) fly({ lat: event.lat, lng: event.lng }, style, flyMs)
    replaceUrl(`/r/${event.id}`)
  }, [dismissHint, fly, siteKeyOf, endTour])

  // ── World tour: every fart, hands-free ─────────────────────────────────
  // Flies to each fart in a shuffled order (down to its petal), plays it on
  // arrival, holds a beat after it ends, and moves on. Anything you do ends it.
  const tourStepRef = useRef(null)
  const tourStep = useCallback(() => {
    const tour = tourRef.current
    if (!tour) return
    const list = eventsRef.current
    let event = null
    for (let tries = 0; tries < tour.queue.length && !event; tries++) {
      tour.index = (tour.index + 1) % tour.queue.length
      event = list.find(candidate => candidate.id === tour.queue[tour.index]) || null
    }
    if (!event) {
      endTour()
      return
    }
    // One fart isn't a tour: play it once and stop
    if (tour.queue.length < 2 && tour.id) {
      endTour()
      return
    }
    tour.id = event.id
    tour.playing = false
    clearTimeout(tour.timer)
    select(event, { fly: false, fromTour: true })
    Promise.resolve(fly({ lat: event.lat, lng: event.lng }, 'crane')).then(arrived => {
      if (tourRef.current !== tour || tour.id !== event.id) return
      // The flight was cut short: someone grabbed the globe
      if (arrived === false) {
        endTour()
        return
      }
      // Deleted while we were on the way
      if (!eventsRef.current.some(candidate => candidate.id === event.id)) {
        tourStepRef.current?.()
        return
      }
      tour.playing = true
      play(event.id, recordingAudioUrl(event.id), { duration: event.duration })
      // If it never gets going (blocked, broken), move on anyway
      tour.timer = setTimeout(() => { if (tourRef.current === tour) tourStepRef.current?.() }, (Math.min(12, event.duration || 5) + 6) * 1000)
    })
  }, [select, fly, endTour])
  tourStepRef.current = tourStep

  const startTour = useCallback(() => {
    endTour()
    const ids = eventsRef.current.map(event => event.id)
    if (!ids.length) return
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    tourRef.current = { queue: ids, index: -1, id: null, timer: 0, playing: false, failures: 0 }
    setTouring(true)
    setListOpen(false)
    dismissHint()
    tourStep()
  }, [tourStep, dismissHint, endTour])

  // Next stop a beat after each fart ends. Three that won't play in a row
  // (offline, audio refused) and the tour gives up rather than spin.
  useEffect(() => {
    const tour = tourRef.current
    if (!tour || !tour.playing || player.id !== tour.id) return
    if (player.status !== 'ended' && player.status !== 'error') return
    tour.playing = false
    tour.failures = player.status === 'error' ? tour.failures + 1 : 0
    clearTimeout(tour.timer)
    if (tour.failures >= 3) {
      endTour()
      return
    }
    tour.timer = setTimeout(() => { if (tourRef.current === tour) tourStepRef.current?.() }, player.status === 'ended' ? 1500 : 700)
  }, [player.status, player.id, endTour])

  // Any touch, click, scroll-zoom or key (or leaving the tab) ends the tour
  useEffect(() => {
    if (!touring) return undefined
    const end = () => endTour()
    const onVisibility = () => { if (document.hidden) endTour() }
    window.addEventListener('pointerdown', end, true)
    window.addEventListener('keydown', end, true)
    window.addEventListener('wheel', end, true)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', end, true)
      window.removeEventListener('keydown', end, true)
      window.removeEventListener('wheel', end, true)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [touring, endTour])

  // ── Whispers: a line at the top of the globe for a few seconds ─────────
  const [whisper, setWhisper] = useState(null) // { text, tone }
  const whisperTimerRef = useRef(0)
  const flashWhisper = useCallback((text, tone = 'sodium', ms = 5000) => {
    clearTimeout(whisperTimerRef.current)
    setWhisper({ text, tone, id: Date.now() })
    whisperTimerRef.current = setTimeout(() => setWhisper(null), ms)
  }, [])
  useEffect(() => () => clearTimeout(whisperTimerRef.current), [])

  // The easter egg (typing "potato", five taps on the wordmark, or the
  // credit in About): the planet turns out to have been a potato
  const potato = useCallback(() => {
    if (!globeRef.current?.potato?.()) return
    endTour()
    setListOpen(false)
    flashWhisper('It was a potato all along', 'sodium', 6200)
  }, [endTour, flashWhisper])

  // Flying over potato country (the globe says where)
  const onGlobeWhisper = useCallback(key => {
    const lines = {
      idaho: 'Idaho · the potato state',
      pei: 'Prince Edward Island · spud island',
      andes: 'The Andes · where potatoes began',
    }
    if (!lines[key] || tourRef.current) return false
    flashWhisper(lines[key], 'sodium', 5200)
    return true
  }, [flashWhisper])

  // A tap on the globe. The globe says which fart: the one tapped (a dot or
  // a petal), or for a cluster the newest there (or the next one, when it
  // holds the open fart) — and it moves the camera in on a cluster itself.
  const pickFromGlobe = useCallback(({ id, kind, again = false }) => {
    const event = eventsRef.current.find(candidate => candidate.id === id)
    if (!event) return
    select(event, { autoplay: true, fly: kind === 'recording' && !again })
  }, [select])

  const closeSelection = useCallback(() => {
    setSelection(null)
    stopPlayback()
    replaceUrl('/')
  }, [])

  const step = useCallback(direction => {
    if (!chronological.length) return
    const index = chronological.findIndex(event => event.id === selection?.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= chronological.length) return // no newer / older one
    select(chronological[target], { autoplay: true, style: 'crane' })
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
      // In view: it falls in from orbit like your own. Out of view: a flash
      // that's still going when you get there.
      const globe = globeRef.current
      if (globe?.screenPoint(event.lat, event.lng)?.visible) globe.land(event.lat, event.lng)
      else globe?.burst(event.lat, event.lng, { color: '#ffa537' })
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
    // The tour's current stop was deleted: on to the next one
    if (tourRef.current?.id === id) setTimeout(() => tourStepRef.current?.(), 0)
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
    let everLive = false
    return connectLive({
      onNew: event => liveHandlersRef.current.handleIncoming(event),
      onDeleted: id => liveHandlersRef.current.handleRemoved(id),
      onStatus: connected => {
        setLive(connected)
        // Catch up on anything missed while disconnected (not on the first
        // connect, unless the list never loaded)
        if (connected && !wasLive && (everLive || loadStateRef.current === 'error')) liveHandlersRef.current.load()
        if (connected) everLive = true
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
          const tries = (deepLinkTriesRef.current += 1)
          if (tries === 1) pushToast({ tone: 'error', text: "Couldn't load that fart. Trying again…" })
          setTimeout(() => { if (deepLinkRef.current === id) openDeepLinkRef.current({ autoplay: false }) }, Math.min(30_000, 4000 * 2 ** (tries - 1)))
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
    endTour()
    setListOpen(false)
    setAboutOpen(false)
    // Recording takes the stage: the open deck steps aside (the new post's
    // deck opens when it lands)
    if (selectionRef.current) {
      setSelection(null)
      replaceUrl('/')
    }
    setRecorderOpen(true)
  }, [endTour])

  // Where the new pin will be once the camera arrives: the launch move centres
  // it on the globe, which sits at the middle of the screen plus its offset
  // (no drawer or deck is open at that moment).
  const getLandingPoint = useCallback(() => ({
    x: window.innerWidth / 2 + (compact ? (landscapePhone ? -52 : 0) : narrowDesktop ? 158 : 170),
    y: window.innerHeight / 2,
  }), [compact, narrowDesktop, landscapePhone])

  const handleLaunch = useCallback(({ lat, lng }) => {
    // Start the camera now, so the pin is centred by the time the drawer is
    // gone (the globe keeps rendering under the drawer while it does). The
    // globe picks the height: where farts were already recorded at that spot,
    // low enough that the new one lands as a petal among them.
    setLaunching(true)
    globeRef.current?.expectLanding?.(lat, lng)
    const flight = fly({ lat, lng }, 'crane', 1300, { landing: true })
    launchRef.current = { lat, lng, at: Date.now(), flight }
  }, [fly])

  const handlePosted = useCallback(created => {
    const event = cleanEvent(created)
    rememberOwnRecording(event.id, created.deleteToken)
    setOwnIds(prev => new Set(prev).add(event.id))
    setEvents(prev => mergeEvents(prev, [event]))
    // The recorder closes itself as the slip flies; only tidy up if it's idle
    // (never cancel a new take someone started in the meantime).
    if (!recorderActiveRef.current) setRecorderOpen(false)
    const flight = launchRef.current?.flight || fly({ lat: event.lat, lng: event.lng }, 'crane', 1300, { landing: true })
    launchRef.current = { lat: event.lat, lng: event.lng, at: Date.now(), flight }
    Promise.resolve(flight)
      .then(() => globeRef.current?.land?.(event.lat, event.lng))
      .catch(() => {})
      .then(() => {
        // The fart plays as it lands (the audio element was unlocked by an
        // earlier tap; if the browser refuses, the deck's PLAY key is right there).
        setLaunching(false)
        select(event, { fly: false, autoplay: true })
        if (!compact) requestAnimationFrame(() => document.querySelector('.sheet--card .key-ceramic')?.focus({ preventScroll: true }))
        pushToast({ tone: 'success', text: 'Planted. Your fart is on the map.' })
      })
  }, [fly, select, pushToast, compact])

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
      pushToast({ tone: 'info', text: <>Copy this link: <strong>{url}</strong></>, duration: 10000 })
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
    const onPop = () => {
      endTour()
      setRoute(parseRoute(window.location.pathname))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [endTour])

  useEffect(() => {
    if (route.page !== 'home') endTour()
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
  }, [route.page, endTour])

  // ── Keyboard (desktop) ──────────────────────────────────────────────────
  const typedRef = useRef('')
  useEffect(() => {
    if (route.page !== 'home') return undefined
    const onKey = event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (recorderOpen || aboutOpen) return
      const key = event.key
      // The map knows a word
      if (key.length === 1) {
        typedRef.current = (typedRef.current + key.toLowerCase()).slice(-6)
        if (typedRef.current === 'potato') {
          typedRef.current = ''
          potato()
          return
        }
      }
      if (key === 'r' || key === 'R') {
        if (event.repeat) return
        event.preventDefault()
        openRecorder()
      } else if (key === 'Escape') {
        if (selection) closeSelection()
        else if (listOpen) setListOpen(false)
      } else if (key === ' ' && selectedEvent && !event.target.closest?.('button:not(.rrow__main)')) {
        event.preventDefault()
        toggle(selectedEvent.id, recordingAudioUrl(selectedEvent.id), { duration: selectedEvent.duration })
      } else if ((key === 'ArrowRight' || key === 'ArrowLeft') && selection) {
        if (event.repeat) return
        step(key === 'ArrowRight' ? 1 : -1)
      } else if (key === '+' || key === '=' || key === '-' || key === '_') {
        if (event.target.closest?.('[role="dialog"]')) return
        event.preventDefault()
        globeRef.current?.zoomBy?.(key === '+' || key === '=' ? 1 / 2 : 2)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.page, recorderOpen, aboutOpen, selection, selectedEvent, listOpen, openRecorder, closeSelection, step, potato])

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
      onHover={event => globeRef.current?.highlight(event ? event.id : null)}
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
          selectedId={selection?.id || null}
          playingId={playingEvent?.id || null}
          compact={compact}
          offsetX={globeOffsetX}
          offsetY={globeOffsetY}
          paused={recorderActive && compact && !launching}
          dimmed={recorderOpen}
          onPick={pickFromGlobe}
          onWhisper={onGlobeWhisper}
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
        onTour={events.length ? startTour : null}
        onPotato={potato}
      />

      {authEnabled && accountWanted && (
        <Suspense fallback={null}>
          <AccountHost publishableKey={CLERK_KEY} onChange={onAccountChange} />
        </Suspense>
      )}

      {/* Before the list in the DOM, so keyboard users reach REC right after the menu */}
      <HomeControls
        compact={compact}
        hidden={cardOpen || listOpen}
        canShuffle={events.length > 0}
        total={stats?.total ?? null}
        onRecord={openRecorder}
        onList={() => setListOpen(true)}
        onShuffle={shuffle}
      />

      <ZoomControls
        globeRef={globeRef}
        compact={compact}
        hidden={!globeWarm || recorderOpen || (compact && (cardOpen || listOpen))}
        onEarth={() => globeRef.current?.frameAll?.(1700)}
      />

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


      {loadState === 'error' && events.length === 0 && globeReady && !listOpen && !recorderOpen && (
        <Hint compact={compact} tone="sodium" text={compact ? 'No connection · tap to retry' : "Can't reach the fart server · click to retry"} onDismiss={load} />
      )}

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
        onPostFailed={message => setLaunching(false) || globeRef.current?.cancelLanding?.() || pushToast({
          tone: 'error',
          text: message,
          actionLabel: 'Open',
          action: openRecorder,
          duration: 12000,
        })}
        onActiveChange={active => {
          setRecorderActive(active)
          if (active) setLaunching(false)
        }}
      />

      {whisper ? (
        <Whisper key={whisper.id} text={whisper.text} tone={whisper.tone} onPress={() => setWhisper(null)} />
      ) : touring ? (
        <Whisper text="World tour · tap to stop" label="Stop the world tour" onPress={endTour} />
      ) : null}

      <AboutPanel
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onRecord={openRecorder}
        onPotato={() => {
          setAboutOpen(false)
          setTimeout(potato, 350) // once the panel is out of the way
        }}
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
