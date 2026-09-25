// One Web Audio context for the app (recorder level meter, countdown ticks).
// iOS only lets a context start from inside a tap, so call unlockAudioContext()
// synchronously in the tap handler that leads to recording.

let shared = null

function create() {
  const Ctx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
  if (!Ctx) return null
  try {
    shared = new Ctx()
  } catch {
    shared = null
  }
  return shared
}

export function unlockAudioContext() {
  // After a phone call or Siri, iOS can leave a context 'interrupted' and
  // resume() never comes back. A fresh context started in this tap does.
  if (shared?.state === 'interrupted') {
    shared.close?.().catch(() => {})
    shared = null
  }
  if (!shared || shared.state === 'closed') create()
  if (shared?.state === 'suspended') {
    shared.resume().catch(() => {})
  }
  return shared
}

export function getAudioContext() {
  return shared && shared.state !== 'closed' ? shared : null
}

// Stop the audio thread while nothing needs it (it's resumed by the next tap).
export function suspendAudioContext() {
  if (shared?.state === 'running') shared.suspend().catch(() => {})
}
