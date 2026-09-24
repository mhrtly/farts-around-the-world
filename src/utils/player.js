// One shared <audio> element for the whole app, so only one fart plays at a
// time. play() must be called straight from a tap/click: iOS only allows audio
// that starts inside a user gesture (and then keeps this element unlocked).
//
// A recording can have a playback window (start/end in seconds) so older,
// untrimmed clips skip their leading silence and stop when the sound ends.

import { useSyncExternalStore } from 'react'

const audio = typeof Audio !== 'undefined' ? new Audio() : null
if (audio) {
  audio.preload = 'auto'
  audio.setAttribute('playsinline', '')
  if (import.meta.env.DEV) window.__fatwAudio = audio // handy in the console while developing
}

let state = { id: null, status: 'idle', duration: 0, error: null }
let playbackWindow = { id: null, start: 0, end: null }
let stoppingAtWindowEnd = false
let watchFrame = 0
const listeners = new Set()

function emit(patch) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function windowFor(id) {
  return playbackWindow.id === id ? playbackWindow : null
}

function friendlyError(error) {
  const mediaError = audio?.error
  if (mediaError?.code === 4 || error?.name === 'NotSupportedError') {
    return "This browser can't play this recording's format."
  }
  if (error?.name === 'NotAllowedError') {
    return 'Tap play again to listen.'
  }
  if (mediaError?.code === 2) return 'Network hiccup — try again.'
  return 'Could not play this recording.'
}

// Stop at the end of the playback window. Checked every frame for precision,
// and on timeupdate as a backup (animation frames don't run in background tabs).
function reachedWindowEnd() {
  const win = windowFor(state.id)
  if (win?.end != null && audio.currentTime >= win.end && !audio.paused) {
    stoppingAtWindowEnd = true
    audio.pause()
    emit({ status: 'ended' })
    return true
  }
  return false
}

function watchWindow() {
  cancelAnimationFrame(watchFrame)
  const tick = () => {
    if (reachedWindowEnd()) return
    if (!audio.paused) watchFrame = requestAnimationFrame(tick)
  }
  watchFrame = requestAnimationFrame(tick)
}

if (audio) {
  // While the silent unlock clip is playing, none of these events are ours.
  const on = (name, handler) => audio.addEventListener(name, event => {
    if (!unlocking) handler(event)
  })
  on('playing', () => {
    emit({ status: 'playing', error: null })
    watchWindow()
  })
  on('waiting', () => {
    if (state.status === 'playing') emit({ status: 'loading' })
  })
  on('pause', () => {
    if (stoppingAtWindowEnd) {
      stoppingAtWindowEnd = false
      return
    }
    if (state.status !== 'ended' && state.status !== 'error') emit({ status: 'paused' })
  })
  on('ended', () => emit({ status: 'ended' }))
  on('timeupdate', reachedWindowEnd)
  on('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) emit({ duration: audio.duration })
  })
  on('error', () => {
    if (!audio.getAttribute('src') || state.id === null) return
    emit({ status: 'error', error: friendlyError() })
  })
}

// iOS only lets an <audio> element play from a user gesture until it has
// played once. Globe marker taps arrive a frame after the tap (globe.gl defers
// clicks), so unlock the element on the very first touch/click anywhere by
// playing a silent, zero-length clip.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let unlocking = false

function unlockOnFirstGesture() {
  if (!audio || typeof document === 'undefined') return
  const events = ['touchend', 'pointerup', 'keydown']
  const unlock = () => {
    events.forEach(name => document.removeEventListener(name, unlock, true))
    if (state.status !== 'idle' || audio.getAttribute('src')) return // real playback already started
    unlocking = true
    audio.muted = true
    audio.setAttribute('src', SILENT_WAV)
    const done = () => {
      // If real playback started in the meantime (play() clears the flag), leave it alone
      if (!unlocking) return
      audio.pause()
      audio.removeAttribute('src')
      audio.muted = false
      // Media events from the silent clip are queued; let them pass before listening again
      setTimeout(() => { unlocking = false }, 0)
    }
    const attempt = audio.play()
    if (attempt?.then) attempt.then(done, done)
    else done()
  }
  events.forEach(name => document.addEventListener(name, unlock, { capture: true, passive: true }))
}

unlockOnFirstGesture()

function seekQuietly(seconds) {
  try {
    audio.currentTime = Math.max(0, seconds)
  } catch {
    // not seekable yet
  }
}

export function play(id, src, { duration } = {}) {
  if (!audio) return
  unlocking = false
  audio.muted = false
  const win = windowFor(id)
  if (state.id !== id || audio.getAttribute('src') !== src) {
    audio.setAttribute('src', src)
    emit({ id, status: 'loading', duration: duration || 0, error: null })
    if (win?.start > 0.05) seekQuietly(win.start)
  } else {
    const atEnd = state.status === 'ended' || (win?.end != null && audio.currentTime >= win.end - 0.05)
    if (atEnd) {
      // Reload rather than seek back: older recordings (browser WebM files
      // without a seek index) can't always seek, but a reload always restarts.
      audio.setAttribute('src', src)
      if (win?.start > 0.05) seekQuietly(win.start)
    }
    emit({ status: 'loading', error: null })
  }
  const attempt = audio.play()
  if (attempt?.catch) {
    attempt.catch(error => {
      if (error?.name === 'AbortError') return
      emit({ status: 'error', error: friendlyError(error) })
    })
  }
}

// Called once a recording has been analyzed. If it's already playing from the
// top of a long silence, hop straight to the sound.
export function setPlaybackWindow(id, start, end) {
  playbackWindow = { id, start: start || 0, end: end ?? null }
  if (!audio || state.id !== id) return
  if ((state.status === 'playing' || state.status === 'loading') && audio.currentTime < start - 0.25) {
    seekQuietly(start)
  }
}

export function pause() {
  audio?.pause()
}

export function toggle(id, src, options) {
  if (state.id === id && (state.status === 'playing' || state.status === 'loading')) {
    pause()
  } else {
    play(id, src, options)
  }
}

export function stop() {
  if (!audio) return
  audio.pause()
  cancelAnimationFrame(watchFrame)
  emit({ id: null, status: 'idle', duration: 0, error: null })
}

export function seekTo(seconds) {
  if (!audio || !Number.isFinite(seconds)) return
  seekQuietly(seconds)
  if (state.status === 'ended') emit({ status: 'paused' })
}

export function currentTime() {
  return audio?.currentTime || 0
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function usePlayer() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
