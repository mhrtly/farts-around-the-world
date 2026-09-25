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
  if (!shared || shared.state === 'closed') create()
  if (shared?.state === 'suspended' || shared?.state === 'interrupted') {
    shared.resume().catch(() => {})
  }
  return shared
}

export function getAudioContext() {
  return shared && shared.state !== 'closed' ? shared : null
}
