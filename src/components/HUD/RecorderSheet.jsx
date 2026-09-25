import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'
import SevenSeg from './instrument/SevenSeg.jsx'
import VuMeter from './instrument/VuMeter.jsx'
import TapeStrip from './recorder/TapeStrip.jsx'
import TakeSlip from './recorder/TakeSlip.jsx'
import ReviewPlayer from './recorder/ReviewPlayer.jsx'
import SlipFlight from './recorder/SlipFlight.jsx'
import {
  androidChromeIntent,
  blip,
  buzz,
  copyText,
  explainMicError,
  geoPermissionState,
  openMic,
  pickMimeType,
  releaseWakeLock,
  requestWakeLock,
  setAudioSession,
  stalledCard,
} from './recorder/device.js'
import { prepareRecording } from '../../utils/audioAnalysis.js'
import { getAudioContext, suspendAudioContext, unlockAudioContext } from '../../utils/audioContext.js'
import { locate } from '../../utils/location.js'
import { newPostKey, postRecording } from '../../data/recordingsApi.js'
import { pause as pausePlayback, play as playTake, stop as stopPlayback } from '../../utils/player.js'
import { sunPhase } from '../../utils/sunPhase.js'
import { countryName, formatCoords, formatLength, loudnessLevel, loudnessWord, nickname, noteName } from '../../utils/recordings.js'
import { rememberOwnRecording } from '../../utils/ownRecordings.js'

const MAX_SECONDS = 10
const STEP_MS = 700 // countdown step
const SETTLE_MS = 420 // the drawer has docked by now
const PROMPT_SLOW_MS = 700 // longer than this, a permission prompt was probably shown…
const PROMPT_BEAT_MS = 350 // …so give a beat of "MIC IS LIVE" before 3
const WATCHDOG_MS = 8000
const HEAD_CUT_S = 0.12 // the "start now" tap
const TAIL_CUT_S = 0.18 // the "stop" tap
const GPS_WAIT_MS = 3000
const STALE_LOCATION_MS = 10 * 60 * 1000
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const CAPTURING = ['arming', 'countdown', 'recording', 'processing']

// Lamp test: the first time the recorder powers up in a session, every
// segment lights once.
let lampTested = false

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const pad2 = n => String(n).padStart(2, '0')
const formatDb = db => `${db < -0.5 ? '−' : ''}${Math.abs(Math.round(db))}`

function classify(duration, peakDb) {
  const db = Number.isFinite(peakDb) ? peakDb : null
  const intensity = db == null ? 5 : Math.min(10, Math.max(1, Math.round(loudnessLevel(db) * 10)))
  let type = 'standard'
  if (duration >= 6 || (db != null && db > -8)) type = 'epic'
  else if (db != null && db < -38) type = 'silent-but-deadly'
  return { intensity, type }
}

// A tiny store for the running clock, so ten updates a second only re-render the digits
function createTicker() {
  let value = 0
  const listeners = new Set()
  return {
    get: () => value,
    set(next) {
      if (next === value) return
      value = next
      listeners.forEach(listener => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const ClockDigits = memo(function ClockDigits({ ticker }) {
  const tenths = useSyncExternalStore(ticker.subscribe, ticker.get, ticker.get)
  const seconds = tenths / 10
  return <SevenSeg value={seconds.toFixed(1).padStart(4, ' ')} tone={seconds >= 8 ? 'sodium' : 'phosphor'} height={58} className="rec-seg rec-seg--clock" />
})

// "Default - MacBook Pro Microphone (Built-in)" → "MACBOOK PRO MICROPHONE"
function cleanMicLabel(label) {
  if (!label || /MediaStream|^audio\d*$/i.test(label)) return ''
  return label.replace(/^(Default|Communications)\s*-\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase()
}

// Why a post didn't go through, in plain words (the take is always kept)
function postFailure(error) {
  const status = error?.status
  let reason = error?.message || 'Something went wrong.'
  if (status === 429) reason = 'Too many posts from your network just now. Give it a minute.'
  else if (status === 413) reason = 'That take is too big to upload.'
  else if (status >= 500) reason = 'The server had a problem.'
  return `It didn't post. ${reason} Your take is still here.`
}

function locationReason(error) {
  if (error?.code === 'denied') return { title: 'LOCATION UNAVAILABLE', short: 'LOCATION IS OFF', long: "Location is off for this site, and your network didn't give a rough spot either. Allow location, then try again." }
  if (error?.code === 'offline') return { title: 'LOCATION UNAVAILABLE', short: "YOU'RE OFFLINE", long: "You're offline. Connect, then try again." }
  if (error?.code === 'waiting') return { title: 'NO LOCATION YET', short: 'ALLOW IT IF ASKED', long: 'Still waiting for your location. If your browser is asking, choose Allow.' }
  return { title: 'LOCATION UNAVAILABLE', short: 'NO FIX YET', long: "We couldn't work out where you are." }
}

const locKey = loc => (loc.status === 'ready' && loc.value ? `${loc.value.lat},${loc.value.lng},${loc.value.source}` : null)

// LENGTH as the slip prints it (and the review display shows it)
const lengthText = draft => (draft.analysisFailed ? `~${formatLength(draft.duration)}` : formatLength(draft.duration))

// The waveform, thinned out for printing on a narrow slip
function traceOf(peaks, bars = 44) {
  if (!peaks?.length) return null
  const out = []
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i / bars) * peaks.length)
    const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length))
    let max = 0
    for (let j = from; j < to; j++) max = Math.max(max, peaks[j] || 0)
    out.push(max)
  }
  return out
}

// The torn slip is turned and dropped a little. The flight copy starts from its
// unturned box (same centre) with the same turn, so nothing jumps at take-off.
function measureSlip(el) {
  const box = el.getBoundingClientRect()
  let x = 0
  let y = 0
  let angle = 0
  try {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    x = m.m41
    y = m.m42
    angle = (Math.atan2(m.m12, m.m11) * 180) / Math.PI
  } catch {
    // no transform
  }
  const width = el.offsetWidth
  const height = el.offsetHeight
  return {
    rect: { left: box.left + box.width / 2 - x - width / 2, top: box.top + box.height / 2 - y - height / 2, width, height },
    start: { x, y, angle },
  }
}

// Everything the take slip prints, from real measurements only.
function slipFor(draft, loc, stamp) {
  const at = new Date(draft.recordedAt)
  const where = loc.value
  const phase = where ? sunPhase(where.lat, where.lng, draft.recordedAt) : null
  const dateLine = [`${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`, `${pad2(at.getHours())}:${pad2(at.getMinutes())}`, phase]
    .filter(Boolean)
    .join(' · ')
  const word = loudnessWord(draft.peakDb)
  const note = noteName(draft.pitchHz)
  let pitch = '—'
  if (note) pitch = <><span className="note-name">{note}</span> · {Math.round(draft.pitchHz)} Hz</>
  else if (draft.peaks && !draft.quiet) pitch = 'NONE · ALL AIR'
  const rows = [
    { label: 'LENGTH', value: lengthText(draft) },
    { label: 'PEAK', value: Number.isFinite(draft.peakDb) && word ? `${formatDb(draft.peakDb)} dB · ${word.toUpperCase()}` : 'NOT MEASURED' },
    { label: 'PITCH', value: pitch },
  ]
  let place
  if (loc.status === 'ready' && where) {
    place = {
      status: 'ready',
      place: (where.place || countryName(where.country)).toUpperCase(),
      coords: formatCoords(where.lat, where.lng),
      note: where.source === 'network' ? 'APPROXIMATE (FROM YOUR NETWORK)' : 'ROUNDED TO ~1 KM',
    }
  } else if (loc.status === 'error') {
    const reason = locationReason(loc.error)
    place = { status: 'error', line1: reason.title, line2: reason.short }
  } else {
    place = { status: 'locating', line1: 'LOCATING…', line2: '' }
  }
  const name = nickname({ duration: draft.duration, peakDb: draft.peakDb })
  return { name: (name || 'Unnamed take').toUpperCase(), take: draft.take, dateLine, trace: traceOf(draft.peaks), rows, loc: place, stamp }
}

const RecorderSheet = forwardRef(function RecorderSheet({
  open,
  onClose,
  onPosted,
  onPostFailed,
  onActiveChange,
  onLaunch,
  getLandingPoint,
  totalCount,
}, ref) {
  const [phase, setPhase] = useState('idle')
  const [count, setCount] = useState(3)
  const [micLive, setMicLive] = useState(false)
  const [micLabel, setMicLabel] = useState('')
  const [lampTest, setLampTest] = useState(false)
  const [notice, setNotice] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loc, setLoc] = useState({ status: 'idle', value: null, error: null, at: 0 })
  const [postError, setPostError] = useState(null)
  const [postStatus, setPostStatus] = useState('Posting…')
  const [reviewNote, setReviewNote] = useState(null)
  const [printed, setPrinted] = useState(false)
  const [inkKey, setInkKey] = useState(null)
  const printedLocRef = useRef(null)
  const [stamp, setStamp] = useState(null)
  const [torn, setTorn] = useState(false)
  const [flight, setFlight] = useState(null)
  const [copied, setCopied] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const phaseRef = useRef('idle')
  const sessionRef = useRef(0)
  const finishedRef = useRef(0) // the last session whose take was processed
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const sourceRef = useRef(null)
  const analyserRef = useRef(null)
  const sampleBufRef = useRef(null)
  const levelRef = useRef({ at: 0, db: null })
  const tapeRef = useRef(null)
  const rafRef = useRef(0)
  const timersRef = useRef([])
  const startedAtRef = useRef(0)
  const stoppedAtRef = useRef(0)
  const stopInfoRef = useRef({ byTap: false, reason: null })
  const headCutRef = useRef(0)
  const wakeRef = useRef(null)
  const detachRef = useRef(null)
  const locateRunRef = useRef(0)
  const locRef = useRef(loc)
  const geoGrantedRef = useRef(false)
  const takeRef = useRef(1)
  const draftCountRef = useRef(0)
  const draftRef = useRef(null)
  const autoPlayedRef = useRef(null)
  const userPlayedRef = useRef(false)
  const totalAtPostRef = useRef(null)
  const slipRef = useRef(null)
  const playKeyRef = useRef(null)
  const recKeyRef = useRef(null)
  const stopRef = useRef(null)
  const flightRef = useRef(null)
  const tickerRef = useRef(null)
  if (!tickerRef.current) tickerRef.current = createTicker()
  const openRef = useRef(open)
  openRef.current = open
  locRef.current = loc
  draftRef.current = draft

  const setPhaseBoth = useCallback(next => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const announce = useCallback(text => setAnnouncement(text), [])

  useEffect(() => {
    onActiveChange?.(phase === 'countdown' || phase === 'recording' || phase === 'processing')
  }, [phase, onActiveChange])

  // Know up front whether location is already allowed (then we locate while you record)
  useEffect(() => {
    geoPermissionState().then(state => { geoGrantedRef.current = state === 'granted' })
  }, [open])

  const schedule = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  // ── Mic level (dBFS of the last ~20 ms), shared by the VU needle and the tape
  const readDb = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return null
    const now = performance.now()
    const cache = levelRef.current
    if (now - cache.at < 8) return cache.db
    let buf = sampleBufRef.current
    if (!buf || buf.length !== analyser.fftSize) {
      buf = new Float32Array(analyser.fftSize)
      sampleBufRef.current = buf
    }
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / buf.length)
    cache.at = now
    cache.db = rms > 0.00001 ? 20 * Math.log10(rms) : -100
    return cache.db
  }, [])

  const releaseMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    detachRef.current?.()
    detachRef.current = null
    try { sourceRef.current?.disconnect() } catch { /* already gone */ }
    sourceRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    releaseWakeLock(wakeRef.current)
    wakeRef.current = null
    // Play the take back through the speaker at full volume (iOS)
    setAudioSession('playback')
  }, [])

  const cancelCapture = useCallback(() => {
    sessionRef.current++
    clearTimers()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      try { recorder.stop() } catch { /* already stopped */ }
    }
    recorderRef.current = null
    releaseMic()
    setMicLive(false)
  }, [releaseMic])

  // ── Location ────────────────────────────────────────────────────────────
  const startLocating = useCallback(() => {
    const run = ++locateRunRef.current
    setLoc(prev => (prev.value ? prev : { status: 'locating', value: null, error: null, at: 0 }))
    const frozen = () => phaseRef.current === 'posting' || phaseRef.current === 'posted'
    locate({
      onUpdate: better => {
        if (run === locateRunRef.current && !frozen()) setLoc({ status: 'ready', value: better, error: null, at: Date.now() })
      },
    })
      .then(value => {
        if (run === locateRunRef.current && !frozen()) setLoc({ status: 'ready', value, error: null, at: Date.now() })
      })
      .catch(error => {
        if (run === locateRunRef.current) setLoc(prev => (prev.value ? prev : { status: 'error', value: null, error, at: 0 }))
      })
  }, [])

  // The location prints onto the slip when it arrives (or changes) after the
  // slip did; a location that printed with the slip isn't inked again
  useEffect(() => {
    if (!printed || loc.status !== 'ready' || !loc.value) return
    const key = locKey(loc)
    if (key !== printedLocRef.current) setInkKey(key)
  }, [printed, loc])

  // ── Capture ─────────────────────────────────────────────────────────────
  const finishRecording = useCallback(async (session, mimeType) => {
    // Once per take, whichever way it ended (stop event, track loss, timeout)
    if (session !== sessionRef.current || finishedRef.current === session) return
    finishedRef.current = session
    clearTimers()
    const blob = new Blob(chunksRef.current, { type: mimeType || chunksRef.current[0]?.type || 'audio/webm' })
    const elapsed = Math.min(MAX_SECONDS, ((stoppedAtRef.current || performance.now()) - startedAtRef.current) / 1000)
    releaseMic()
    setMicLive(false)

    if (!blob.size) {
      setNotice({ kind: 'empty', title: "We didn't catch anything", body: 'The take came back empty. Press REC to try again.', canRetry: true })
      setPhaseBoth('idle')
      announce("We didn't catch anything. Press REC to try again.")
      return
    }
    const status = locRef.current.status
    if (status === 'idle' || status === 'error') startLocating()

    const { byTap, reason } = stopInfoRef.current
    let prepared
    try {
      prepared = await prepareRecording(blob, { headCut: headCutRef.current, tailCut: byTap ? TAIL_CUT_S : 0 })
    } catch (error) {
      console.warn('Could not measure this take', blob.type, blob.size, error?.message)
      // Post the original file untrimmed; it just won't have measurements
      prepared = {
        blob,
        mimeType: blob.type,
        duration: Math.round(elapsed * 10) / 10,
        clipDuration: elapsed,
        trimmedSeconds: 0,
        peaks: null,
        quiet: false,
        peakDb: null,
        volume: null,
        peakVolume: null,
        pitchHz: null,
        analysisFailed: true,
      }
    }
    if (session !== sessionRef.current) return

    draftCountRef.current += 1
    const next = {
      ...prepared,
      id: `draft-${draftCountRef.current}`,
      url: URL.createObjectURL(prepared.blob),
      postKey: newPostKey(),
      recordedAt: Date.now(),
      take: takeRef.current,
    }
    setDraft(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return next
    })
    setReviewNote(
      reason === 'hidden' ? 'Stopped early because you left the page. The take is kept.'
        : reason === 'mic' ? 'Stopped early: the mic was interrupted (a call?). The take is kept.'
          : null,
    )

    // Show what was trimmed on the tape, then hand over to the review
    if (!prepared.analysisFailed && openRef.current) {
      await tapeRef.current?.revealTrim(prepared, { reducedMotion: reducedMotion() })
    }
    if (session !== sessionRef.current) return
    suspendAudioContext()
    setPrinted(false)
    setInkKey(null)
    setStamp(null)
    setTorn(false)
    userPlayedRef.current = false
    setPhaseBoth('review')
    buzz([12, 40, 12])
    announce(`Recorded ${formatLength(next.duration)}. Listen back, then post it to the map.`)
  }, [announce, releaseMic, setPhaseBoth, startLocating])

  const stopCapture = useCallback(({ byTap = false, reason = null } = {}) => {
    if (phaseRef.current !== 'recording') return
    clearTimers()
    cancelAnimationFrame(rafRef.current)
    tapeRef.current?.stop()
    stoppedAtRef.current = performance.now()
    stopInfoRef.current = { byTap, reason }
    const elapsed = (stoppedAtRef.current - startedAtRef.current) / 1000
    tickerRef.current.set(Math.min(100, Math.floor(elapsed * 10)))
    setPhaseBoth('processing')
    announce('Stopped. Trimming the silence.')
    const recorder = recorderRef.current
    try {
      if (recorder?.state === 'recording' || recorder?.state === 'paused') recorder.stop()
      else if (recorder) {
        // The browser already stopped it (e.g. the mic went away): its stop
        // event, carrying the last chunk, is still on its way. Give it a moment.
        const session = sessionRef.current
        setTimeout(() => finishRecording(session, recorder.mimeType), 400)
      } else finishRecording(sessionRef.current, recorder?.mimeType)
    } catch {
      finishRecording(sessionRef.current, recorder?.mimeType)
    }
  }, [announce, finishRecording, setPhaseBoth])
  stopRef.current = stopCapture

  const captureLoop = useCallback(() => {
    if (phaseRef.current !== 'recording') return
    const elapsed = (performance.now() - startedAtRef.current) / 1000
    tapeRef.current?.push(Math.min(elapsed, MAX_SECONDS - 0.001), readDb())
    tickerRef.current.set(Math.min(100, Math.floor(elapsed * 10)))
    // The cap comes from the real clock (timers can run late on phones)
    if (elapsed >= MAX_SECONDS) {
      stopRef.current?.({ reason: 'max' })
      return
    }
    rafRef.current = requestAnimationFrame(captureLoop)
  }, [readDb])

  const failStart = useCallback((title = "Couldn't start recording", body = 'Press REC to try again.') => {
    sessionRef.current++
    clearTimers()
    releaseMic()
    setMicLive(false)
    setNotice({ kind: 'other', title, body, canRetry: true }) // announced by its role="alert"
    setPhaseBoth('idle')
  }, [announce, releaseMic, setPhaseBoth])

  const beginCapture = useCallback((session, { byTap = false } = {}) => {
    if (session !== sessionRef.current) return
    clearTimers()
    const stream = streamRef.current
    const track = stream?.getAudioTracks()[0]
    if (!track || track.readyState !== 'live') {
      failStart('The mic stopped', 'A call or another app took it. Press REC to try again.')
      return
    }
    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        failStart()
        return
      }
    }
    chunksRef.current = []
    recorder.ondataavailable = event => {
      if (event.data?.size) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => finishRecording(session, recorder.mimeType || mimeType)
    try {
      recorder.start(250)
    } catch {
      failStart()
      return
    }
    recorderRef.current = recorder
    headCutRef.current = byTap ? HEAD_CUT_S : 0
    stopInfoRef.current = { byTap: false, reason: null }
    startedAtRef.current = performance.now()
    stoppedAtRef.current = 0
    tapeRef.current?.reset()
    tickerRef.current.set(0)
    setPhaseBoth('recording')
    announce('') // nothing may be spoken while the mic is recording
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(captureLoop)
    schedule(() => stopRef.current?.({ reason: 'max' }), MAX_SECONDS * 1000 + 150)
  }, [announce, captureLoop, failStart, finishRecording, setPhaseBoth])

  const tick = useCallback(step => {
    const ctx = getAudioContext()
    if (step === 1) {
      buzz(30)
      blip(ctx, { freq: 1320, duration: 0.18, gain: 0.08 })
    } else {
      buzz(12)
      blip(ctx, { freq: 880, duration: 0.09, gain: 0.05 })
    }
  }, [])

  const startCountdown = useCallback(session => {
    if (session !== sessionRef.current) return
    setCount(3)
    setPhaseBoth('countdown')
    // Short, so a screen reader finishes speaking before capture starts (the
    // mic records everything; echo cancellation is off)
    announce('Recording after three beeps.')
    tick(3)
    schedule(() => { if (session === sessionRef.current) { setCount(2); tick(2) } }, STEP_MS)
    schedule(() => { if (session === sessionRef.current) { setCount(1); tick(1) } }, STEP_MS * 2)
    schedule(() => beginCapture(session), STEP_MS * 3)
  }, [announce, beginCapture, setPhaseBoth, tick])

  // Leaving the page (or a call taking the mic) mid-take: keep what we have.
  // Mid-countdown: stop and say why.
  const interrupt = useCallback(reason => {
    const current = phaseRef.current
    if (current === 'recording') {
      stopRef.current?.({ reason })
    } else if (current === 'countdown') {
      cancelCapture()
      setNotice(reason === 'hidden'
        ? { kind: 'paused', title: 'Countdown stopped', body: 'You left the page. Press REC when you’re ready.', canRetry: true }
        : { kind: 'busy', title: 'The mic stopped', body: 'A call or another app took it. Press REC to try again.', canRetry: true })
      setPhaseBoth('idle')
    }
  }, [cancelCapture, setPhaseBoth])

  const attachInterruptions = useCallback(stream => {
    const track = stream.getAudioTracks()[0]
    const onVisibility = () => { if (document.visibilityState === 'hidden') interrupt('hidden') }
    const onPageHide = () => interrupt('hidden')
    const onTrackGone = () => interrupt('mic')
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    track?.addEventListener('ended', onTrackGone)
    track?.addEventListener('mute', onTrackGone)
    detachRef.current = () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      track?.removeEventListener('ended', onTrackGone)
      track?.removeEventListener('mute', onTrackGone)
    }
  }, [interrupt])

  // Everything up to getUserMedia runs synchronously inside the tap (iOS).
  const arm = useCallback(({ tapAt = performance.now(), drawerSettled = false } = {}) => {
    const session = ++sessionRef.current
    clearTimers()
    setNotice(null)
    setPostError(null)
    setReviewNote(null)
    pausePlayback()
    unlockAudioContext()
    setAudioSession('play-and-record')
    let mic
    try {
      mic = openMic()
    } catch (error) {
      mic = Promise.reject(error)
    }
    const askedAt = performance.now()
    releaseWakeLock(wakeRef.current)
    wakeRef.current = requestWakeLock()
    const firstPowerUp = !lampTested
    lampTested = true
    setLampTest(firstPowerUp)
    setMicLive(false)
    setCount(3)
    tickerRef.current.set(0)
    tapeRef.current?.reset()
    setPhaseBoth('arming')
    announce('Opening the microphone.')

    const watchdog = setTimeout(() => {
      if (session === sessionRef.current && phaseRef.current === 'arming') setNotice(stalledCard())
    }, WATCHDOG_MS)

    mic.then(
      stream => {
        clearTimeout(watchdog)
        if (session !== sessionRef.current || phaseRef.current !== 'arming') {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        try {
          const ctx = getAudioContext()
          if (ctx) {
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 1024
            source.connect(analyser)
            sourceRef.current = source
            analyserRef.current = analyser
          }
        } catch {
          // no meter; still records
        }
        attachInterruptions(stream)
        if (document.visibilityState === 'hidden') {
          // They left while the mic was opening: don't count down unseen
          setPhaseBoth('countdown')
          interrupt('hidden')
          return
        }
        setMicLabel(cleanMicLabel(stream.getAudioTracks()[0]?.label))
        setNotice(null)
        setMicLive(true)
        if (geoGrantedRef.current && locRef.current.status !== 'ready') startLocating()
        const waited = performance.now() - tapAt
        const settle = drawerSettled ? 0 : Math.max(0, SETTLE_MS - waited)
        if (waited > PROMPT_SLOW_MS) {
          setCount(null)
          setPhaseBoth('countdown')
          announce('Mic is live.')
          schedule(() => startCountdown(session), settle + PROMPT_BEAT_MS)
        } else {
          schedule(() => startCountdown(session), settle)
        }
      },
      async error => {
        clearTimeout(watchdog)
        if (session !== sessionRef.current) return
        releaseMic()
        const info = await explainMicError(error, { fast: performance.now() - askedAt < 150 })
        if (session !== sessionRef.current) return
        setNotice(info) // announced by its role="alert"
        setPhaseBoth('idle')
      },
    )
  }, [announce, attachInterruptions, interrupt, releaseMic, setPhaseBoth, startCountdown, startLocating])

  // ── Keys ────────────────────────────────────────────────────────────────
  const onRecKey = () => {
    const current = phaseRef.current
    if (current === 'idle') arm({ drawerSettled: true })
    else if (current === 'countdown') beginCapture(sessionRef.current, { byTap: true })
    else if (current === 'recording') {
      // A double tap on REC during the countdown is one press, not a 0.04 s take
      if (performance.now() - startedAtRef.current < 500) return
      stopCapture({ byTap: true })
    }
  }

  // ✕ never loses a take: while recording it stops and keeps it.
  const onCloseKey = () => {
    const current = phaseRef.current
    if (current === 'recording') {
      stopCapture({ byTap: true })
      return
    }
    if (current === 'processing' || current === 'posted') return
    if (current === 'arming' || current === 'countdown') {
      cancelCapture()
      setNotice(null)
      setPhaseBoth('idle')
    }
    onClose?.()
  }

  // Esc while the drawer can't be dismissed
  const onEscape = () => {
    const current = phaseRef.current
    if (current === 'recording') stopCapture({ byTap: true })
    else if (current === 'arming' || current === 'countdown') {
      cancelCapture()
      setNotice(null)
      setPhaseBoth('idle')
    }
  }

  const redo = () => {
    stopPlayback()
    setDraft(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
    setPostError(null)
    takeRef.current += 1
    setPhaseBoth('idle')
    arm({ drawerSettled: true })
    // The Redo key disappears with the review; keep keyboard focus on REC
    requestAnimationFrame(() => recKeyRef.current?.focus({ preventScroll: true }))
  }

  const onCopyLink = async () => {
    const ok = await copyText(window.location.href)
    setCopied(ok ? 'Copied' : 'Copy failed')
    setTimeout(() => setCopied(false), 2200)
  }

  const retryLocation = () => {
    setLoc({ status: 'idle', value: null, error: null, at: 0 })
    startLocating()
  }

  // ── Post ────────────────────────────────────────────────────────────────
  const post = async () => {
    const take = draftRef.current
    if (!take || phaseRef.current !== 'review' || !locRef.current.value) return
    unlockAudioContext() // inside the tap, so the chime can play later
    setPostError(null)
    stopPlayback()
    setPhaseBoth('posting')
    totalAtPostRef.current = Number.isFinite(totalCount) ? totalCount : null
    let where = locRef.current.value
    if (where.source === 'network' && where.upgrade) {
      // A precise fix may be seconds away (the prompt was just answered)
      setPostStatus('Pinning your spot…')
      const better = await Promise.race([where.upgrade, delay(GPS_WAIT_MS)])
      if (better) {
        where = better
        setLoc({ status: 'ready', value: better, error: null, at: Date.now() })
      }
    }
    setPostStatus('Posting…')
    onLaunch?.({ lat: where.lat, lng: where.lng })
    const { intensity, type } = classify(take.duration, take.peakDb)
    try {
      const created = await postRecording({
        blob: take.blob,
        mimeType: take.mimeType,
        lat: where.lat,
        lng: where.lng,
        country: where.country || 'XX',
        place: where.place,
        duration: Math.min(take.duration, MAX_SECONDS),
        volume: take.volume,
        peakVolume: take.peakVolume,
        intensity,
        type,
        postKey: take.postKey,
        onRetry: (attempt, attempts) => setPostStatus(`Retrying (${attempt} of ${attempts})…`),
      })
      landed(created)
    } catch (error) {
      const message = postFailure(error)
      setPostError(message)
      setPhaseBoth('review')
      announce(`Didn't post. ${message}`)
      // If they closed the sheet mid-upload, tell them (the take is kept).
      if (!openRef.current) onPostFailed?.(message)
    }
  }

  // Stamp the slip, tear it off and throw it at the globe while the drawer closes.
  const landed = async created => {
    // Keep the delete token right away, before any animation can be interrupted
    rememberOwnRecording(created.id, created.deleteToken)
    buzz([10, 60, 30])
    const ctx = getAudioContext()
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    blip(ctx, { freq: 660, gain: 0.06, duration: 0.12 })
    blip(ctx, { freq: 990, gain: 0.06, duration: 0.24, when: 0.1 })
    setPhaseBoth('posted')
    announce('Posted. Your fart is on the map.')
    if (!openRef.current) {
      onPosted?.(created)
      return
    }
    setStamp({ n: totalAtPostRef.current != null ? totalAtPostRef.current + 1 : null })
    const still = reducedMotion()
    await delay(still ? 500 : 460)
    if (!openRef.current || !slipRef.current) {
      onPosted?.(created)
      return
    }
    setTorn(true)
    await delay(still ? 0 : 130)
    const { rect, start } = measureSlip(slipRef.current)
    const target = getLandingPoint?.({ lat: created.lat, lng: created.lng }) || { x: window.innerWidth / 2, y: window.innerHeight * 0.3 }
    const current = draftRef.current
    if (!current) {
      onPosted?.(created)
      return
    }
    const next = {
      slip: slipFor(current, locRef.current, { n: totalAtPostRef.current != null ? totalAtPostRef.current + 1 : null }),
      rect,
      start,
      target,
      reducedMotion: still,
      created,
    }
    flightRef.current = next
    setFlight(next)
    onClose?.()
  }

  const onFlightDone = useCallback(() => {
    const done = flightRef.current
    flightRef.current = null
    setFlight(null)
    if (done) onPosted?.(done.created)
  }, [onPosted])

  // ── Open / close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // A take left waiting a while: you may have moved, so look again
      const current = locRef.current
      if (draftRef.current && current.value && Date.now() - current.at > STALE_LOCATION_MS) startLocating()
      return
    }
    const current = phaseRef.current
    if (current === 'arming' || current === 'countdown') {
      cancelCapture()
      setNotice(null)
      setPhaseBoth('idle')
    } else if (current === 'recording') {
      stopRef.current?.({ reason: null })
    }
    if (current !== 'posted' && current !== 'posting') stopPlayback()
    if (!CAPTURING.includes(current)) setAudioSession('auto')
    setCopied(false)
  }, [open, cancelCapture, setPhaseBoth, startLocating])

  // After a post: clear the take so the recorder is ready for the next one
  const resetForNext = useCallback(() => {
    draftRef.current = null
    setDraft(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
    // Locate afresh next time in case you've moved on
    locateRunRef.current++
    setLoc({ status: 'idle', value: null, error: null, at: 0 })
    takeRef.current = 1
    setStamp(null)
    setTorn(false)
    setPhaseBoth('idle')
  }, [setPhaseBoth])

  // Once a post has landed and the sheet is closed, get ready for the next one.
  // (Also covers an upload that finishes after someone closed the sheet.)
  useEffect(() => {
    if (open || phase !== 'posted') return undefined
    const timer = setTimeout(resetForNext, 500)
    return () => clearTimeout(timer)
  }, [open, phase, resetForNext])

  useEffect(() => () => cancelCapture(), [cancelCapture])

  // Review: focus the PLAY key (keyboard / screen reader users land on it)
  useEffect(() => {
    if (phase !== 'review' || !open) return
    const active = document.activeElement
    if (!active || active === document.body || active === recKeyRef.current || active.closest?.('.rec-capture')) {
      playKeyRef.current?.focus({ preventScroll: true })
    }
  }, [phase, open])

  // Auto-play the take once, when the slip has printed (quietly gives up if the browser says no)
  const onSlipPrinted = event => {
    if (event.target !== event.currentTarget) return
    printedLocRef.current = locKey(locRef.current)
    setPrinted(true)
    const take = draftRef.current
    if (!take || autoPlayedRef.current === take.id || userPlayedRef.current) return
    if (!openRef.current || phaseRef.current !== 'review' || document.visibilityState !== 'visible') return
    autoPlayedRef.current = take.id
    playTake(take.id, take.url, { duration: take.clipDuration || take.duration })
  }

  useImperativeHandle(ref, () => ({
    // Called synchronously inside the tap/key press that opens the recorder
    quickStart() {
      // Straight back in right after posting: the old take is done with
      if (phaseRef.current === 'posted') resetForNext()
      if (phaseRef.current !== 'idle' || draftRef.current) return false
      arm({ drawerSettled: openRef.current })
      return true
    },
  }))

  // ── Render ──────────────────────────────────────────────────────────────
  const inReview = phase === 'review' || phase === 'posting' || phase === 'posted'
  const showReview = inReview && !!draft
  const dismissible = !CAPTURING.includes(phase) && phase !== 'posting' && phase !== 'posted'
  const slip = useMemo(() => (draft ? slipFor(draft, loc, stamp) : null), [draft, loc, stamp])
  const blocked = notice && !notice.canRetry
  const intent = blocked ? androidChromeIntent() : null
  const where = loc.value

  let status = { text: 'READY', tone: '' }
  let unit = 'OF 10.0 SECONDS'
  let display = <SevenSeg value=" 0.0" height={58} className="rec-seg rec-seg--clock" />
  if (phase === 'arming') {
    status = { text: 'OPENING MIC', tone: '' }
    if (lampTest) display = <SevenSeg value="88.8" height={58} className="rec-seg rec-seg--clock" />
  } else if (phase === 'countdown') {
    if (count == null) {
      status = { text: 'MIC IS LIVE', tone: '' }
      unit = 'GET READY'
      display = <SevenSeg value=" " tone="sodium" height={92} className="rec-seg rec-seg--count" />
    } else {
      status = { text: 'STARTING IN', tone: 'vfd--sodium' }
      unit = 'MIC IS LIVE'
      display = <SevenSeg value={String(count)} tone="sodium" height={92} className="rec-seg rec-seg--count" />
    }
  } else if (phase === 'recording') {
    status = { text: '● REC', tone: 'vfd--tally rec-status--blink' }
    display = <ClockDigits ticker={tickerRef.current} />
  } else if (phase === 'processing' || inReview) {
    status = { text: 'TRIMMING SILENCE', tone: '' }
    display = <ClockDigits ticker={tickerRef.current} />
  }

  let caption = 'Press REC. Up to 10 seconds.'
  if (phase === 'idle' && notice?.canRetry) caption = 'Press REC to try again'
  if (phase === 'arming') caption = notice?.waiting ? 'Still waiting for the mic…' : 'Opening the mic…'
  if (phase === 'countdown') caption = 'Press again to start now'
  if (phase === 'recording') caption = 'Press again to stop'
  if (phase === 'processing') caption = 'Measuring…'

  let plateSub = (
    <span className="rec-plate__place">
      UP TO 10<span className="rec-plate__long"> SECONDS</span><span className="rec-plate__short"> S</span> · PINNED WHERE YOU ARE
    </span>
  )
  if (where) plateSub = <><span className="rec-plate__place">{(where.place?.split(',')[0] || countryName(where.country)).toUpperCase()}</span><span className="rec-plate__coords">&nbsp;· {formatCoords(where.lat, where.lng)}</span></>
  else if (loc.status === 'locating') plateSub = <span className="rec-plate__place">LOCATING…</span>

  const recLabel = phase === 'recording' ? 'Stop recording' : phase === 'countdown' ? 'Start recording now' : 'Start recording'
  const recBusy = phase === 'arming' || phase === 'processing'

  let postLed = 'led--phosphor'
  let postLabel = 'Post it to the map'
  const canPost = phase === 'review' && !!where
  if (phase === 'posting') {
    postLed = 'led--sodium is-blink-fast'
    postLabel = postStatus
  } else if (phase === 'posted') {
    postLabel = 'Posted'
  } else if (!where && loc.status !== 'error') {
    postLed = 'led--sodium is-blink'
    postLabel = 'Waiting for location…'
  } else if (!where) {
    postLed = ''
  }

  let note = null
  if (postError) note = { text: postError }
  else if (loc.status === 'error' && !where) note = { text: locationReason(loc.error).long, action: { label: 'Try again', run: retryLocation } }
  else if (reviewNote) note = { text: reviewNote }
  else if (draft?.quiet) note = { text: 'We barely heard anything. Post it anyway, or redo it closer to the source.' }
  else if (draft?.analysisFailed) note = { text: "This device couldn't measure the take. It'll still post." }

  let trimNote = 'NOTHING TO TRIM'
  if (draft?.analysisFailed) trimNote = 'NOT MEASURED'
  else if (draft?.trimmedSeconds >= 0.1) trimNote = `CUT ${formatLength(draft.trimmedSeconds)} OF SILENCE`

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        onEscape={onEscape}
        variant="recorder"
        label="Fart recorder"
        modal
        dismissible={dismissible}
        initialFocus={showReview ? '.rplay__key' : '.rec-key'}
      >
        <div className={`recorder recorder--${phase} ${showReview ? 'is-review' : 'is-capture'}`}>
          <header className="rec-plate">
            <div className="rec-plate__text">
              <h2 className="plate-title">Fart recorder</h2>
              <p className="rec-plate__sub">{plateSub}</p>
            </div>
            <button
              type="button"
              className="key key--sm rec-close"
              onClick={onCloseKey}
              aria-label={phase === 'recording' ? 'Stop and keep the take' : 'Close recorder'}
            >
              <Icon name="close" size={16} strokeWidth={2} />
            </button>
          </header>

          <div className="rec-stage">
            <section className="rec-layer rec-capture" aria-hidden={showReview || undefined} inert={showReview ? '' : undefined}>
              <div className={`well rec-well ${notice ? 'has-notice' : ''}`}>
                <div className="rec-well__row">
                  <div className="rec-vu">
                    <VuMeter
                      getDb={readDb}
                      active={micLive && (phase === 'countdown' || phase === 'recording')}
                      lit={micLive}
                    />
                  </div>
                  <div className="rec-readout">
                    <span className={`vfd rec-status ${status.tone}`}>{status.text}</span>
                    <div className="rec-display">{display}</div>
                    <span className="rec-readout__unit">{unit}</span>
                  </div>
                </div>
                <TapeStrip ref={tapeRef} />
                {notice && (
                  <div className="rec-notice" role="alert">
                    <p className="vfd vfd--sodium rec-notice__title">{notice.title}</p>
                    <p className="rec-notice__body">{notice.body}</p>
                  </div>
                )}
              </div>

              <p className="rec-input" aria-hidden={!micLabel && takeRef.current < 2}>
                <span className="rec-input__label">{micLabel ? <>INPUT&nbsp; <b>{micLabel}</b></> : '\u00a0'}</span>
                {takeRef.current > 1 && <span className="rec-input__take">TAKE {takeRef.current}</span>}
              </p>

              <div className="rec-controls">
                {blocked ? (
                  <div className="rec-escape">
                    <button type="button" className="key key--wide rec-escape__key" onClick={onCopyLink}>
                      <Icon name="link" size={18} />
                      <span>{copied || 'Copy link'}</span>
                    </button>
                    {intent && (
                      <a className="key key--wide rec-escape__key" href={intent}>
                        <span>Open in Chrome</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    <span className={`bezel rec-bezel ${phase === 'recording' ? 'is-live' : phase === 'countdown' || phase === 'arming' ? 'is-armed' : ''}`}>
                      <button
                        ref={recKeyRef}
                        type="button"
                        className="key-ceramic key-ceramic--round rec-key"
                        onClick={recBusy ? undefined : onRecKey}
                        aria-pressed={phase === 'recording'}
                        aria-disabled={recBusy || undefined}
                        aria-label={recLabel}
                      >
                        <span className="rec-dot" />
                      </button>
                    </span>
                    <p className="rec-caption" aria-hidden="true">{caption}</p>
                  </>
                )}
              </div>
            </section>

            {showReview && (
              <section className="rec-layer rec-review">
                <ReviewPlayer
                  ref={playKeyRef}
                  id={draft.id}
                  src={draft.url}
                  peaks={draft.peaks}
                  duration={draft.clipDuration || draft.duration}
                  length={lengthText(draft)}
                  note={trimNote}
                  showError={userPlayedRef.current}
                  onUserPlay={() => { userPlayedRef.current = true }}
                />

                <div className="rec-printer">
                  <div className="rec-printer__slot" />
                  <div className="rec-printer__window">
                    <div
                      key={draft.id}
                      ref={slipRef}
                      className={`rec-printer__slip ${torn ? 'is-torn' : ''} ${flight ? 'is-gone' : ''}`}
                      onAnimationEnd={onSlipPrinted}
                    >
                      <TakeSlip slip={slip} inkKey={inkKey} />
                    </div>
                  </div>
                </div>

                <div className="rec-note" aria-live="polite">
                  {note && (
                    <>
                      <span className="led led--sodium" />
                      <span className="rec-note__text">{note.text}</span>
                      {note.action && (
                        <button type="button" className="key key--sm rec-note__key" onClick={note.action.run}>{note.action.label}</button>
                      )}
                    </>
                  )}
                </div>

                <div className="rec-actions">
                  <button type="button" className="key rec-redo" onClick={redo} disabled={phase !== 'review'}>
                    <Icon name="redo" size={17} strokeWidth={2} />
                    <span>Redo</span>
                  </button>
                  <button
                    type="button"
                    className={`key-ceramic rec-post ${phase === 'posting' || phase === 'posted' ? 'is-latched' : ''}`}
                    onClick={post}
                    disabled={!canPost}
                    aria-busy={phase === 'posting' || undefined}
                  >
                    <span className={`led ${postLed}`} />
                    <span>{postLabel}</span>
                  </button>
                </div>

                <p className="rec-fine">
                  Anyone can listen to what you post. It&rsquo;s pinned within about 1 km of where you are.
                  Posted by mistake? Delete it from its card.
                </p>
              </section>
            )}
          </div>

          <p className="sr-only" aria-live="polite">{announcement}</p>
        </div>
      </Sheet>
      {flight && <SlipFlight flight={flight} onDone={onFlightDone} />}
    </>
  )
})

export default RecorderSheet
