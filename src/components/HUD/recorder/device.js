// The recorder's contact with the device: microphone, recording format,
// ticks, haptics, screen wake lock, iOS audio session, and plain-English
// explanations for everything that can go wrong with a mic.

import { inAppBrowser, isAppleWebKit, isIOS } from '../../../utils/browserEnv.js'

// WebKit's WebM/Opus decoding has been flaky (iOS 18.4+ reports WebM as
// supported), so Apple devices record AAC in MP4. We re-encode to WAV anyway;
// only how reliably the take decodes matters.
const WEBM_FIRST = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus']
const MP4_FIRST = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm']

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  const candidates = isAppleWebKit() ? MP4_FIRST : WEBM_FIRST
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

export function canRecord() {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' }
  if (window.isSecureContext === false) return { ok: false, reason: 'insecure' }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return { ok: false, reason: 'unsupported' }
  return { ok: true }
}

// Must be called synchronously inside the tap (the browser ties the permission
// prompt to it). Voice-call processing (noise suppression etc.) tends to erase
// exactly the sounds we're trying to capture, so ask for the raw signal.
export function openMic() {
  const support = canRecord()
  if (!support.ok) {
    return Promise.reject(Object.assign(new Error('Recording is not supported here'), { name: support.reason === 'insecure' ? 'Insecure' : 'Unsupported' }))
  }
  return navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })
    .catch(error => {
      if (error?.name === 'OverconstrainedError' || error?.name === 'TypeError') {
        return navigator.mediaDevices.getUserMedia({ audio: true })
      }
      throw error
    })
}

export function micPermissionState() {
  try {
    return navigator.permissions?.query({ name: 'microphone' }).then(result => result.state, () => null) || Promise.resolve(null)
  } catch {
    return Promise.resolve(null)
  }
}

export function geoPermissionState() {
  try {
    return navigator.permissions?.query({ name: 'geolocation' }).then(result => result.state, () => null) || Promise.resolve(null)
  } catch {
    return Promise.resolve(null)
  }
}

// iOS 17+: record and play back through the speaker at full volume.
export function setAudioSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type
  } catch {
    // older iOS / other browsers
  }
}

export function requestWakeLock() {
  try {
    if (!navigator.wakeLock || document.visibilityState !== 'visible') return null
    return navigator.wakeLock.request('screen').catch(() => null)
  } catch {
    return null
  }
}

export function releaseWakeLock(pending) {
  pending?.then(lock => lock?.release?.()).catch(() => {})
}

export function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not supported (iPhone)
  }
}

// Soft synthesized blips for the countdown and the post chime. Never called
// between the last countdown tick and the end of a take: the mic would hear it.
export function blip(ctx, { freq = 880, duration = 0.08, gain = 0.05, when = 0 } = {}) {
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

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent)
}

// "Open in Chrome" from an Android in-app browser
export function androidChromeIntent() {
  if (!isAndroid()) return null
  const { host, pathname, search } = window.location
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`
}

// Where to switch the mic back on, in the words of the browser you're using.
function unblockSteps() {
  const ua = navigator.userAgent
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return "Allow the microphone for this site in your browser's settings, then press REC."
  if (isIOS()) return 'Tap aA in the address bar → Website Settings → Microphone → Allow. Then press REC.'
  if (isAndroid()) return 'Tap the icon left of the address → Permissions → Microphone → Allow. Then press REC.'
  if (/Firefox\//.test(ua)) return 'Click the mic icon in the address bar and remove the block. Then press REC.'
  if (isAppleWebKit()) return 'Safari → Settings for This Website → Microphone → Allow. Then press REC.'
  return 'Click the icon left of the address → Site settings → Microphone → Allow. Then press REC.'
}

// Turns a getUserMedia / MediaRecorder failure into { kind, title, body, canRetry }.
// `fast` = it failed before a prompt could have been shown.
export async function explainMicError(error, { fast = false } = {}) {
  const app = inAppBrowser()
  const name = error?.name
  if (name === 'Insecure') {
    return { kind: 'unsupported', title: 'The mic needs https', body: 'Browsers only allow the microphone on secure pages. Open the https:// address to record.', canRetry: false }
  }
  if (name === 'Unsupported') {
    return app ? inAppCard(app) : { kind: 'unsupported', title: "This browser can't record", body: 'Open this page in Safari or Chrome to record a fart.', canRetry: false }
  }
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    if (app) return inAppCard(app)
    const state = await micPermissionState()
    // A prompt that was closed (or answered "Don't allow" once) can be asked
    // again; an instant refusal with no prompt means the site is blocked.
    const dismissed = /dismiss/i.test(error?.message || '') || (state !== 'denied' && !fast)
    if (dismissed) {
      return { kind: 'dismissed', title: 'No mic, no fart', body: 'Press REC and choose Allow when your browser asks.', canRetry: true }
    }
    return { kind: 'blocked', title: 'The mic is blocked for this site', body: unblockSteps(), canRetry: true }
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return { kind: 'nomic', title: 'No microphone found', body: 'Plug one in, or open this page on your phone.', canRetry: true }
  }
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
    return { kind: 'busy', title: 'Your mic is busy', body: 'A call or another app is using it. Finish that, then press REC.', canRetry: true }
  }
  return { kind: 'other', title: "Couldn't start the mic", body: 'Press REC to try again.', canRetry: true }
}

export function inAppCard(app = inAppBrowser()) {
  const who = app === 'this app' ? "This app's browser" : `${app}'s browser`
  return {
    kind: 'inapp',
    title: `${who} can't use your mic`,
    body: app === 'this app'
      ? 'Open this page in Chrome or Safari to record.'
      : 'Tap ••• (top right) → Open in browser. Or copy the link and paste it into Safari or Chrome.',
    canRetry: false,
    escape: true,
  }
}

export function stalledCard() {
  const app = inAppBrowser()
  if (app) return inAppCard(app)
  return {
    kind: 'stalled',
    title: 'Still waiting for the mic',
    body: 'Look for a permission prompt near the address bar and choose Allow. If nothing popped up, reload the page.',
    canRetry: true,
    waiting: true,
  }
}
