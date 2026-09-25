// Talks to the Express backend: list/post/delete recordings and live updates.

import { io } from 'socket.io-client'

async function readJson(res) {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`
    const details = Array.isArray(body?.details) ? `: ${body.details.join('; ')}` : ''
    throw Object.assign(new Error(message + details), { status: res.status, code: body?.code || null })
  }
  return body
}

export async function fetchRecordings(limit = 500) {
  return readJson(await fetch(`/api/events?limit=${limit}`))
}

export async function fetchRecording(id) {
  return readJson(await fetch(`/api/events/${encodeURIComponent(id)}`))
}

export async function fetchStats() {
  return readJson(await fetch('/api/stats'))
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const encoded = result.split(',')[1] || ''
      if (encoded) resolve(encoded)
      else reject(new Error('Could not read the recording'))
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read the recording'))
    reader.readAsDataURL(blob)
  })
}

function randomHex(bytes) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return Array.from(values, value => value.toString(16).padStart(2, '0')).join('')
}

// One per recording, reused if the upload is retried, so the server can tell
// a retry from a new post (and the delete key keeps working either way).
export function newPostKey() {
  return {
    clientPostId: crypto.randomUUID ? crypto.randomUUID() : randomHex(16),
    deleteToken: randomHex(24),
  }
}

const UPLOAD_TIMEOUT_MS = 40000
// Waits before the 2nd and 3rd attempts. Retrying is safe: the server
// recognises the same clientPostId and returns the post it already has.
const RETRY_DELAYS_MS = [1500, 4000]

function isRetryable(error) {
  if (error.name === 'AbortError' || error instanceof TypeError) return true
  const status = error.status
  return status === 408 || status === 429 || status >= 500
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Offline: wait for the connection to come back (or give it one more go after a while).
function whenOnline(maxMs) {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('online', done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, maxMs)
    window.addEventListener('online', done)
  })
}

async function sendOnce(body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body,
    })
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('Retry-After'))
      try {
        await readJson(res)
      } catch (error) {
        if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterMs = Math.min(10, retryAfter) * 1000
        throw error
      }
    }
    return await readJson(res)
  } finally {
    clearTimeout(timeout)
  }
}

// `onRetry(attempt, attempts)` is called before each automatic retry.
export async function postRecording({ blob, mimeType, lat, lng, country, place, duration, volume, peakVolume, intensity, type, postKey, onRetry }) {
  const audioData = await blobToBase64(blob)
  const body = JSON.stringify({
    lat,
    lng,
    country,
    place,
    intensity,
    type,
    audioData,
    audioMimeType: mimeType || blob.type || null,
    duration,
    volume,
    peakVolume,
    clientPostId: postKey?.clientPostId,
    deleteToken: postKey?.deleteToken,
  })

  for (let attempt = 0; ; attempt++) {
    try {
      const created = await sendOnce(body)
      // Older servers generate their own token; otherwise it's the one we sent.
      return { ...created, deleteToken: created.deleteToken || postKey?.deleteToken }
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(error)) {
        if (error.name === 'AbortError') throw new Error('Upload timed out. Check your connection and try again.')
        if (error instanceof TypeError) throw new Error("Couldn't reach the server. Check your connection and try again.")
        throw error
      }
      onRetry?.(attempt + 2, RETRY_DELAYS_MS.length + 1)
      await wait(error.retryAfterMs || RETRY_DELAYS_MS[attempt])
      await whenOnline(15000)
    }
  }
}

export async function deleteRecording(id, token) {
  const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Delete-Token': token },
  })
  if (res.status === 204) return true
  await readJson(res)
  return true
}

// Socket.IO live feed: new recordings and deletions as they happen.
export function connectLive({ onNew, onDeleted, onStatus }) {
  const socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
  socket.on('connect', () => onStatus?.(true))
  socket.on('disconnect', () => onStatus?.(false))
  socket.on('connect_error', () => onStatus?.(false))
  socket.on('fart:new', event => onNew?.(event))
  socket.on('fart:burst', events => events.forEach(event => onNew?.(event)))
  socket.on('fart:deleted', payload => onDeleted?.(payload?.id))
  return () => socket.disconnect()
}
