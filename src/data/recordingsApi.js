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

export async function postRecording({ blob, mimeType, lat, lng, country, place, duration, volume, peakVolume, intensity, type, postKey }) {
  const audioData = await blobToBase64(blob)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
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
      }),
    })
    const created = await readJson(res)
    // Older servers generate their own token; otherwise it's the one we sent.
    return { ...created, deleteToken: created.deleteToken || postKey?.deleteToken }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Upload timed out — check your connection and try again.')
    if (error instanceof TypeError) throw new Error("Couldn't reach the server — check your connection and try again.")
    throw error
  } finally {
    clearTimeout(timeout)
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
