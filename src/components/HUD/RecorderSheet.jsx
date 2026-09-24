import { useCallback, useEffect, useRef, useState } from 'react'
import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'
import WaveformPlayer from './WaveformPlayer.jsx'
import { prepareRecording } from '../../utils/audioAnalysis.js'
import { locate } from '../../utils/location.js'
import { postRecording } from '../../data/recordingsApi.js'
import { pause as pausePlayback, stop as stopPlayback } from '../../utils/player.js'
import {
  countryName,
  flagEmoji,
  formatSeconds,
  loudnessLevel,
  loudnessWord,
  nickname,
  noteName,
} from '../../utils/recordings.js'

const MAX_SECONDS = 10
const COUNTDOWN_STEP_MS = 650
const RING_CIRCUMFERENCE = 2 * Math.PI * 56
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
]

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

function micErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        title: 'Microphone is blocked',
        body: "Allow microphone access for this site in your browser's settings, then try again.",
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { title: 'No microphone found', body: 'Plug one in (or try your phone) and give it another go.' }
    case 'NotReadableError':
    case 'AbortError':
      return { title: 'Microphone is busy', body: 'Another app is using it. Close that app and try again.' }
    case 'Unsupported':
      return {
        title: "This browser can't record",
        body: 'Open this page in Safari or Chrome to record. (In-app browsers usually block the mic.)',
      }
    default:
      return { title: "Couldn't start recording", body: error?.message || 'Something went wrong with the microphone.' }
  }
}

async function openMic() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw Object.assign(new Error('Recording is not supported here'), { name: 'Unsupported' })
  }
  // Voice-call processing (noise suppression etc.) tends to erase exactly the
  // sounds we're trying to capture, so ask for the raw signal.
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })
  } catch (error) {
    if (error?.name === 'OverconstrainedError' || error?.name === 'TypeError') {
      return navigator.mediaDevices.getUserMedia({ audio: true })
    }
    throw error
  }
}

function buzz(pattern) {
  try { navigator.vibrate?.(pattern) } catch { /* not supported */ }
}

// Soft synthesized blips: countdown ticks (so you know when it starts even
// with the phone out of sight) and a little chime when a post lands.
// Ticks end well before capture begins, so they never end up in the recording.
function blip(ctx, { freq = 880, duration = 0.08, gain = 0.05, when = 0 } = {}) {
  if (!ctx || ctx.state === 'closed') return
  try {
    const start = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const envelope = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(gain, start + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(envelope).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  } catch {
    // audio feedback is optional
  }
}

function classify(duration, peakDb) {
  const intensity = Math.min(10, Math.max(1, Math.round(loudnessLevel(peakDb) * 10)))
  let type = 'standard'
  if (duration >= 6 || peakDb > -8) type = 'epic'
  else if (Number.isFinite(peakDb) && peakDb < -38) type = 'silent-but-deadly'
  return { intensity, type }
}

export default function RecorderSheet({ open, onClose, onPosted, onActiveChange }) {
  const [phase, setPhase] = useState('idle')
  const [count, setCount] = useState(3)
  const [micError, setMicError] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loc, setLoc] = useState({ status: 'idle', value: null })
  const [postError, setPostError] = useState(null)

  const phaseRef = useRef('idle')
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const canvasRef = useRef(null)
  const ringRef = useRef(null)
  const clockRef = useRef(null)
  const rafRef = useRef(0)
  const timersRef = useRef([])
  const startedAtRef = useRef(0)
  const levelsRef = useRef([])
  const levelPeakRef = useRef(0)
  const lastLevelAtRef = useRef(0)
  const sessionRef = useRef(0)
  const draftCountRef = useRef(0)
  const locateRunRef = useRef(0)
  const locStatusRef = useRef('idle')
  const recButtonRef = useRef(null)

  // Keyboard users land on the big button: Space/Enter starts recording
  useEffect(() => {
    if (!open || phaseRef.current !== 'idle') return undefined
    const timer = setTimeout(() => recButtonRef.current?.focus({ preventScroll: true }), 80)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    locStatusRef.current = loc.status
  }, [loc.status])

  const setPhaseBoth = useCallback(next => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  useEffect(() => {
    onActiveChange?.(phase === 'countdown' || phase === 'recording' || phase === 'processing')
  }, [phase, onActiveChange])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const releaseMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    analyserRef.current = null
  }, [])

  // ── Level meter (voice-memo style bars) ─────────────────────────────────
  const drawLevels = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (canvas && analyser) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth * dpr
      const height = canvas.clientHeight * dpr
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const data = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / data.length)
      const level = Math.min(1, Math.sqrt(rms * 4.5))
      const recording = phaseRef.current === 'recording'
      const levels = levelsRef.current

      // Keep the loudest moment of each slot so short bursts always show up
      const now = performance.now()
      const stepMs = recording ? 100 : 50
      levelPeakRef.current = Math.max(levelPeakRef.current, level)
      if (now - lastLevelAtRef.current >= stepMs) {
        levels.push(levelPeakRef.current)
        levelPeakRef.current = 0
        lastLevelAtRef.current = now
      }

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, width, height)
      const minBar = 2 * dpr
      if (recording) {
        // The whole take as a timeline, filling left → right over 10 seconds
        const slots = MAX_SECONDS * 10
        const slot = width / slots
        const barWidth = Math.max(dpr, slot * 0.6)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        for (let i = levels.length; i < slots; i++) ctx.fillRect(i * slot, (height - minBar) / 2, barWidth, minBar)
        ctx.fillStyle = '#ff5a67'
        for (let i = 0; i < Math.min(levels.length, slots); i++) {
          const h = Math.max(minBar, levels[i] * height * 0.92)
          ctx.fillRect(i * slot, (height - h) / 2, barWidth, h)
        }
      } else {
        // Live level scrolling in from the right while you get ready
        const barWidth = 3 * dpr
        const gap = 2 * dpr
        const maxBars = Math.floor(width / (barWidth + gap))
        if (levels.length > maxBars) levels.splice(0, levels.length - maxBars)
        ctx.fillStyle = 'rgba(120, 225, 255, 0.85)'
        for (let i = 0; i < levels.length; i++) {
          const x = width - (levels.length - i) * (barWidth + gap)
          const h = Math.max(minBar, levels[i] * height * 0.92)
          ctx.globalAlpha = 0.35 + 0.65 * (i / levels.length)
          ctx.fillRect(x, (height - h) / 2, barWidth, h)
        }
        ctx.globalAlpha = 1
      }
    }

    if (phaseRef.current === 'recording') {
      const elapsed = (performance.now() - startedAtRef.current) / 1000
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - Math.min(1, elapsed / MAX_SECONDS))}`
      }
      if (clockRef.current) clockRef.current.textContent = `${Math.min(elapsed, MAX_SECONDS).toFixed(1)} s`
    }
    rafRef.current = requestAnimationFrame(drawLevels)
  }, [])

  // ── Location ────────────────────────────────────────────────────────────
  const startLocating = useCallback(() => {
    const run = ++locateRunRef.current
    setLoc(prev => ({ status: 'locating', value: prev.value }))
    locate({
      onUpdate: better => {
        if (run === locateRunRef.current) setLoc({ status: 'ready', value: better })
      },
    })
      .then(value => {
        if (run === locateRunRef.current) setLoc({ status: 'ready', value })
      })
      .catch(error => {
        if (run === locateRunRef.current) setLoc({ status: 'error', value: null, error: error.message })
      })
  }, [])

  // If location permission was already granted, find it quietly up front.
  useEffect(() => {
    if (!open || loc.status !== 'idle') return
    navigator.permissions?.query({ name: 'geolocation' })
      .then(result => { if (result.state === 'granted') startLocating() })
      .catch(() => {})
  }, [open, loc.status, startLocating])

  // ── Capture ─────────────────────────────────────────────────────────────
  const finishRecording = useCallback(async (session, mimeType) => {
    if (session !== sessionRef.current) return
    clearTimers()
    setPhaseBoth('processing')
    const blob = new Blob(chunksRef.current, { type: mimeType || chunksRef.current[0]?.type || 'audio/webm' })
    const elapsed = (performance.now() - startedAtRef.current) / 1000
    releaseMic()

    if (!blob.size) {
      setMicError({ title: "We didn't catch anything", body: 'The recording came back empty. Give it another try.' })
      setPhaseBoth('idle')
      return
    }

    if (locStatusRef.current === 'idle' || locStatusRef.current === 'error') startLocating()

    let prepared
    try {
      prepared = await prepareRecording(blob)
    } catch {
      // Couldn't decode it here — post the original file untrimmed.
      prepared = {
        blob,
        mimeType: blob.type,
        duration: Math.round(Math.min(elapsed, MAX_SECONDS) * 10) / 10,
        peaks: null,
        quiet: false,
        peakDb: null,
        volume: null,
        peakVolume: null,
        pitchHz: null,
      }
    }
    if (session !== sessionRef.current) return

    draftCountRef.current += 1
    setDraft(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return { ...prepared, id: `draft-${draftCountRef.current}`, url: URL.createObjectURL(prepared.blob) }
    })
    buzz([12, 40, 12])
    setPhaseBoth('review')
  }, [releaseMic, setPhaseBoth, startLocating])

  const beginCapture = useCallback((session) => {
    if (session !== sessionRef.current || !streamRef.current) return
    clearTimers()
    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current)
    } catch {
      recorder = new MediaRecorder(streamRef.current)
    }
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = event => {
      if (event.data?.size) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => finishRecording(session, recorder.mimeType || mimeType)
    recorder.start(250)
    startedAtRef.current = performance.now()
    levelsRef.current = []
    levelPeakRef.current = 0
    lastLevelAtRef.current = startedAtRef.current
    buzz(20)
    setPhaseBoth('recording')
    timersRef.current.push(setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
      setPhaseBoth('processing')
    }, MAX_SECONDS * 1000 + 80))
  }, [finishRecording, setPhaseBoth])

  const startCountdown = useCallback((session) => {
    setCount(3)
    setPhaseBoth('countdown')
    buzz(8)
    blip(audioCtxRef.current, { freq: 880 })
    const steps = [2, 1]
    steps.forEach((value, index) => {
      timersRef.current.push(setTimeout(() => {
        if (session !== sessionRef.current) return
        setCount(value)
        buzz(8)
        blip(audioCtxRef.current, { freq: value === 1 ? 1320 : 880 })
      }, COUNTDOWN_STEP_MS * (index + 1)))
    })
    timersRef.current.push(setTimeout(() => beginCapture(session), COUNTDOWN_STEP_MS * 3))
  }, [beginCapture, setPhaseBoth])

  const arm = useCallback(async () => {
    const session = ++sessionRef.current
    setMicError(null)
    setPostError(null)
    pausePlayback()

    // Create/resume the audio context inside the tap (iOS requirement).
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx && (!audioCtxRef.current || audioCtxRef.current.state === 'closed')) audioCtxRef.current = new Ctx()
      audioCtxRef.current?.resume?.()
    } catch { /* metering is optional */ }

    setPhaseBoth('arming')
    try {
      const stream = await openMic()
      if (session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      })
      try {
        const ctx = audioCtxRef.current
        if (ctx) {
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 1024
          source.connect(analyser)
          analyserRef.current = analyser
        }
      } catch { /* no meter, still record */ }
      levelsRef.current = []
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(drawLevels)
      startCountdown(session)
    } catch (error) {
      if (session !== sessionRef.current) return
      releaseMic()
      setMicError(micErrorMessage(error))
      setPhaseBoth('idle')
    }
  }, [drawLevels, releaseMic, setPhaseBoth, startCountdown])

  const stopCapture = useCallback(() => {
    clearTimers()
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      setPhaseBoth('processing')
      recorder.stop()
    }
  }, [setPhaseBoth])

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
  }, [releaseMic])

  const onMainButton = () => {
    if (phase === 'idle') arm()
    else if (phase === 'countdown') {
      clearTimers()
      beginCapture(sessionRef.current)
    } else if (phase === 'recording') stopCapture()
  }

  const redo = () => {
    stopPlayback()
    setDraft(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url)
      return null
    })
    setPostError(null)
    setPhaseBoth('idle')
    arm()
  }

  const post = async () => {
    if (!draft || loc.status !== 'ready' || !loc.value) return
    setPostError(null)
    setPhaseBoth('posting')
    stopPlayback()
    const { intensity, type } = classify(draft.duration, draft.peakDb)
    try {
      const created = await postRecording({
        blob: draft.blob,
        mimeType: draft.mimeType,
        lat: loc.value.lat,
        lng: loc.value.lng,
        country: loc.value.country || 'XX',
        place: loc.value.place,
        duration: Math.min(draft.duration, MAX_SECONDS),
        volume: draft.volume,
        peakVolume: draft.peakVolume,
        intensity,
        type,
      })
      buzz([10, 60, 30])
      blip(audioCtxRef.current, { freq: 660, gain: 0.06, duration: 0.12 })
      blip(audioCtxRef.current, { freq: 990, gain: 0.06, duration: 0.22, when: 0.1 })
      setPhaseBoth('posted')
      onPosted?.(created)
    } catch (error) {
      setPostError(error.message || 'Posting failed. Try again?')
      setPhaseBoth('review')
    }
  }

  // Closing the sheet: stop any capture. A finished-but-unposted recording is
  // kept so it's still there if you reopen (you can't exactly re-do on demand).
  useEffect(() => {
    if (open) return
    const current = phaseRef.current
    if (current === 'arming' || current === 'countdown' || current === 'recording' || current === 'processing') {
      cancelCapture()
      setPhaseBoth('idle')
    }
    if (current === 'posted') {
      const timer = setTimeout(() => {
        setDraft(prev => {
          if (prev?.url) URL.revokeObjectURL(prev.url)
          return null
        })
        // Re-locate next time in case you've moved on (the browser caches a fresh fix).
        locateRunRef.current++
        setLoc({ status: 'idle', value: null })
        setPhaseBoth('idle')
      }, 500)
      return () => clearTimeout(timer)
    }
    stopPlayback()
    return undefined
  }, [open, cancelCapture, setPhaseBoth])

  useEffect(() => () => {
    cancelCapture()
    audioCtxRef.current?.close?.().catch(() => {})
    audioCtxRef.current = null
  }, [cancelCapture])

  const showCapture = phase === 'idle' || phase === 'arming' || phase === 'countdown' || phase === 'recording' || phase === 'processing'
  const peakDb = draft?.peakDb
  const draftName = draft ? nickname({ duration: draft.duration, peakDb }) : null
  const note = noteName(draft?.pitchHz)

  return (
    <Sheet open={open} onClose={onClose} variant="recorder" label="Record a fart" modal>
      <div className={`recorder recorder--${phase}`}>
        <header className="recorder__head">
          <div>
            <h2 className="recorder__title">
              {phase === 'review' || phase === 'posting' ? 'How did that sound?' : phase === 'posted' ? "It's on the map" : 'Record a fart'}
            </h2>
            <p className="recorder__lede">
              {phase === 'review' || phase === 'posting'
                ? 'Listen back, then post it to the map.'
                : phase === 'posted'
                  ? 'Thanks for your contribution to science.'
                  : 'Up to 10 seconds. It gets pinned to the map where you are.'}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close recorder">
            <Icon name="close" />
          </button>
        </header>

        {showCapture && (
          <div className="capture">
            <div className={`capture__meter ${phase === 'recording' ? 'is-hot' : ''}`}>
              <canvas ref={canvasRef} className="capture__canvas" aria-hidden="true" />
              {phase === 'idle' && !micError && <span className="capture__hint">Mic is off until you tap record</span>}
              {phase === 'arming' && <span className="capture__hint">Allow the microphone…</span>}
            </div>

            <button
              ref={recButtonRef}
              type="button"
              className={`rec-button rec-button--${phase}`}
              onClick={onMainButton}
              disabled={phase === 'arming' || phase === 'processing'}
              aria-label={
                phase === 'recording' ? 'Stop recording' : phase === 'countdown' ? 'Start recording now' : 'Start recording'
              }
            >
              <svg className="rec-button__ring" viewBox="0 0 128 128" aria-hidden="true">
                <circle className="rec-button__track" cx="64" cy="64" r="56" />
                <circle
                  ref={ringRef}
                  className="rec-button__progress"
                  cx="64"
                  cy="64"
                  r="56"
                  style={{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: RING_CIRCUMFERENCE }}
                />
              </svg>
              <span className="rec-button__core">
                {phase === 'countdown' && <span key={count} className="rec-button__count">{count}</span>}
                {phase === 'recording' && <Icon name="stop" size={34} />}
                {(phase === 'arming' || phase === 'processing') && <span className="spinner spinner--lg" />}
                {phase === 'idle' && <span className="rec-button__dot" />}
              </span>
            </button>

            <p className="capture__status" aria-live="polite">
              {phase === 'idle' && (micError ? '' : 'Tap to record')}
              {phase === 'arming' && 'Waking up the microphone'}
              {phase === 'countdown' && 'Get ready… (tap to start now)'}
              {phase === 'recording' && <><span ref={clockRef} className="capture__clock">0.0 s</span> · tap to stop</>}
              {phase === 'processing' && 'Trimming the silence…'}
            </p>

            {micError && (
              <div className="notice notice--error" role="alert">
                <strong>{micError.title}</strong>
                <span>{micError.body}</span>
              </div>
            )}
          </div>
        )}

        {draft && (phase === 'review' || phase === 'posting' || phase === 'posted') && (
          <div className="review">
            <WaveformPlayer
              id={draft.id}
              src={draft.url}
              peaks={draft.peaks}
              duration={draft.clipDuration || draft.duration}
              size="lg"
              tone={phase === 'posted' ? 'lime' : 'coral'}
              label="Play it back"
            />

            <div className="review__stats">
              <div className="stat">
                <span className="stat__label">Length</span>
                <strong className="stat__value">{formatSeconds(draft.duration)}</strong>
              </div>
              <div className="stat">
                <span className="stat__label">Loudness</span>
                <strong className="stat__value">{loudnessWord(peakDb) || '—'}</strong>
                <span className="meter" aria-hidden="true"><span style={{ width: `${loudnessLevel(peakDb) * 100}%` }} /></span>
              </div>
              <div className="stat">
                <span className="stat__label">Pitch</span>
                <strong className="stat__value">{note || (draft.peaks ? 'None' : '—')}</strong>
                <span className="stat__hint">{note ? `${Math.round(draft.pitchHz)} Hz` : draft.peaks ? 'all air' : ''}</span>
              </div>
            </div>

            {draftName && <p className="review__name">Field name: <strong>{draftName}</strong></p>}
            {draft.quiet && (
              <p className="notice notice--warn">We barely heard anything. You can post it anyway, or try again closer to the source.</p>
            )}

            <div className={`location location--${loc.status}`}>
              <Icon name="pin" size={18} />
              {loc.status === 'ready' && loc.value && (
                <span>
                  <strong>{flagEmoji(loc.value.country)} {loc.value.place || countryName(loc.value.country)}</strong>
                  <em>
                    {loc.value.source === 'network'
                      ? ' · approximate (from your network)'
                      : ' · rounded to about 1 km'}
                  </em>
                </span>
              )}
              {(loc.status === 'locating' || loc.status === 'idle') && <span>Finding where you are…</span>}
              {loc.status === 'error' && (
                <span>
                  Couldn't find your location.{' '}
                  <button type="button" className="link-button" onClick={startLocating}>Try again</button>
                </span>
              )}
            </div>

            {postError && <p className="notice notice--error" role="alert">{postError}</p>}

            {phase !== 'posted' ? (
              <div className="review__actions">
                <button type="button" className="pill-button pill-button--ghost" onClick={redo} disabled={phase === 'posting'}>
                  <Icon name="redo" size={18} /> Redo
                </button>
                <button
                  type="button"
                  className="big-button big-button--post"
                  onClick={post}
                  disabled={phase === 'posting' || loc.status !== 'ready'}
                >
                  {phase === 'posting'
                    ? <><span className="spinner" /> Posting…</>
                    : loc.status === 'ready' ? <>Post it to the map</> : <>Waiting for location…</>}
                </button>
              </div>
            ) : (
              <div className="posted">
                <span className="posted__icon"><Icon name="check" size={28} strokeWidth={2.4} /></span>
                <p>Posted! Flying you there now…</p>
              </div>
            )}

            <p className="review__fineprint">
              Anyone can listen to what you post. Your location is rounded to about 1 km.
              Posted by mistake? You can delete it from its card.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
