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

// Stop exactly at the end of the playback window.
function watchWindow() {
  cancelAnimationFrame(watchFrame)
  const tick = () => {
    const win = windowFor(state.id)
    if (win?.end != null && audio.currentTime >= win.end && !audio.paused) {
      stoppingAtWindowEnd = true
      audio.pause()
      emit({ status: 'ended' })
      return
    }
    if (!audio.paused) watchFrame = requestAnimationFrame(tick)
  }
  watchFrame = requestAnimationFrame(tick)
}

if (audio) {
  audio.addEventListener('playing', () => {
    emit({ status: 'playing', error: null })
    watchWindow()
  })
  audio.addEventListener('waiting', () => {
    if (state.status === 'playing') emit({ status: 'loading' })
  })
  audio.addEventListener('pause', () => {
    if (stoppingAtWindowEnd) {
      stoppingAtWindowEnd = false
      return
    }
    if (state.status !== 'ended' && state.status !== 'error') emit({ status: 'paused' })
  })
  audio.addEventListener('ended', () => emit({ status: 'ended' }))
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) emit({ duration: audio.duration })
  })
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return
    emit({ status: 'error', error: friendlyError() })
  })
}

function seekQuietly(seconds) {
  try {
    audio.currentTime = Math.max(0, seconds)
  } catch {
    // not seekable yet
  }
}

export function play(id, src, { duration } = {}) {
  if (!audio) return
  const win = windowFor(id)
  if (state.id !== id || audio.getAttribute('src') !== src) {
    audio.setAttribute('src', src)
    emit({ id, status: 'loading', duration: duration || 0, error: null })
    if (win?.start > 0.05) seekQuietly(win.start)
  } else {
    const atEnd = state.status === 'ended' || (win?.end != null && audio.currentTime >= win.end - 0.05)
    if (atEnd) seekQuietly(win?.start || 0)
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
