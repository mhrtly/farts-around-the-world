/**
 * Synthesized notification sounds using Web Audio API.
 * No external files needed — all sounds are generated programmatically.
 * Supports global mute toggle stored in localStorage.
 */

let audioCtx = null
let _muted = localStorage.getItem('fatwa-sound-muted') === 'true'

/** Check if sounds are currently muted */
export function isMuted() { return _muted }

/** Toggle mute state, persists to localStorage */
export function toggleMute() {
  _muted = !_muted
  localStorage.setItem('fatwa-sound-muted', String(_muted))
  return _muted
}

/** Set mute state explicitly */
export function setMuted(val) {
  _muted = !!val
  localStorage.setItem('fatwa-sound-muted', String(_muted))
}

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

/**
 * Soft blip for new event arrivals.
 * Two quick ascending tones — sounds like a radar ping.
 */
export function playEventBlip() {
  if (_muted) return
  try {
    const ctx = getContext()
    const now = ctx.currentTime

    // First tone — lower
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.06)
    gain1.gain.setValueAtTime(0.08, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.12)

    // Second tone — higher, slight delay
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1320, now + 0.05)
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.11)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.setValueAtTime(0.06, now + 0.05)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.05)
    osc2.stop(now + 0.15)
  } catch {
    // Audio context not available
  }
}

/**
 * Achievement / milestone sound.
 * Triumphant ascending arpeggio.
 */
export function playMilestoneChime() {
  if (_muted) return
  try {
    const ctx = getContext()
    const now = ctx.currentTime

    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.08)
      gain.gain.setValueAtTime(0, now + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.3)
    })
  } catch {
    // Audio context not available
  }
}

/**
 * Subtle warning tone for connection status changes.
 */
export function playWarningTone() {
  if (_muted) return
  try {
    const ctx = getContext()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.2)
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  } catch {
    // Audio context not available
  }
}
