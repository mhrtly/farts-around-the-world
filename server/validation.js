import { v4 as uuidv4 } from 'uuid'

const VALID_TYPES = new Set(['standard', 'epic', 'silent-but-deadly'])

// Stored coordinates are rounded to ~1 km (2 decimals) — enough to put a
// recording on the map, not enough to find anyone's house.
const COORD_DECIMALS = 2
const MAX_DURATION_SECONDS = 12
const MAX_PLACE_LENGTH = 120
const MIN_AUDIO_BASE64 = 1400 // ~1 KB; the shortest real clip is far bigger

function roundCoord(value) {
  const factor = 10 ** COORD_DECIMALS
  return Math.round(value * factor) / factor
}

function sanitizePlace(place) {
  if (typeof place !== 'string') return null
  const cleaned = place
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PLACE_LENGTH)
  return cleaned.length >= 2 ? cleaned : null
}

// The first bytes of every container browsers record or we encode.
function looksLikeAudio(base64) {
  let head
  try {
    head = Buffer.from(base64.slice(0, 64), 'base64')
  } catch {
    return false
  }
  if (head.length < 12) return false
  const ascii = (start, text) => head.toString('latin1', start, start + text.length) === text
  return (
    (ascii(0, 'RIFF') && ascii(8, 'WAVE')) || // WAV (every new post)
    (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) || // WebM / Matroska
    ascii(0, 'OggS') ||
    ascii(4, 'ftyp') || // MP4 / M4A (Safari)
    ascii(0, 'ID3') ||
    (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) // MP3 / AAC ADTS frame sync
  )
}

export function validateFartEvent(body) {
  const errors = []

  if (body == null || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'], event: null }
  }

  const { lat, lng, intensity, country, type, audioData, audioMimeType, duration, volume, peakVolume, place, clientPostId, deleteToken } = body

  // Optional: the client's own id for this post (so a retried upload is
  // recognized) and the secret it will use to delete it later.
  let finalClientPostId = null
  if (clientPostId !== undefined && clientPostId !== null) {
    if (typeof clientPostId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(clientPostId)) {
      errors.push('clientPostId must be 8-64 letters, digits or dashes')
    } else {
      finalClientPostId = clientPostId
    }
  }
  let finalDeleteToken = null
  if (deleteToken !== undefined && deleteToken !== null) {
    if (typeof deleteToken !== 'string' || !/^[a-f0-9]{32,128}$/i.test(deleteToken)) {
      errors.push('deleteToken must be 32-128 hex characters')
    } else {
      finalDeleteToken = deleteToken
    }
  }

  // lat
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    errors.push('lat must be a finite number')
  } else if (lat < -90 || lat > 90) {
    errors.push('lat must be between -90 and 90')
  }

  // lng
  if (typeof lng !== 'number' || !Number.isFinite(lng)) {
    errors.push('lng must be a finite number')
  } else if (lng < -180 || lng > 180) {
    errors.push('lng must be between -180 and 180')
  }

  // intensity — optional, defaults to 5
  const finalIntensity = (typeof intensity === 'number' && Number.isInteger(intensity) && intensity >= 1 && intensity <= 10)
    ? intensity : 5

  // country — accept any ISO 3166-1 alpha-2 code (2 uppercase letters)
  if (typeof country !== 'string') {
    errors.push('country must be a string')
  } else if (!/^[A-Za-z]{2}$/.test(country)) {
    errors.push('country must be a 2-letter ISO country code')
  }

  // type — optional, defaults to 'standard'
  const finalType = (typeof type === 'string' && VALID_TYPES.has(type)) ? type : 'standard'

  // All canonical events must include an audio recording.
  if (typeof audioData !== 'string' || audioData.trim().length === 0) {
    errors.push('audioData is required and must be a base64 string')
  } else if (audioData.length > 1_500_000) {
    errors.push('audioData too large (max ~1.1MB raw audio)')
  } else if (audioData.length < MIN_AUDIO_BASE64 || !looksLikeAudio(audioData)) {
    errors.push('audioData must be a real audio recording (WAV, WebM, Ogg, MP4/AAC or MP3)')
  }

  let finalAudioMimeType = null
  if (audioMimeType !== undefined && audioMimeType !== null) {
    if (typeof audioMimeType !== 'string') {
      errors.push('audioMimeType must be a string when provided')
    } else {
      const normalizedMimeType = audioMimeType.trim().slice(0, 128)
      if (!/^audio\/[a-z0-9.+-]+(?:\s*;.*)?$/i.test(normalizedMimeType)) {
        errors.push('audioMimeType must be a valid audio MIME type')
      } else {
        finalAudioMimeType = normalizedMimeType
      }
    }
  }

  // duration — optional (seconds). Recordings cap at 10s client-side; allow a
  // little slack for encoder padding so a full-length clip is never rejected.
  let finalDuration = null
  if (duration !== undefined && duration !== null) {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECONDS) {
      errors.push(`duration must be a number between 0 and ${MAX_DURATION_SECONDS}`)
    } else {
      finalDuration = duration < 1 ? Math.round(duration * 100) / 100 : Math.round(duration * 10) / 10
    }
  }

  // volume — optional (0-100, RMS average)
  let finalVolume = null
  if (volume !== undefined && volume !== null) {
    if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 100) {
      errors.push('volume must be a number between 0 and 100')
    } else {
      finalVolume = Math.round(volume * 10) / 10
    }
  }

  // peakVolume — optional (0-100)
  let finalPeakVolume = null
  if (peakVolume !== undefined && peakVolume !== null) {
    if (typeof peakVolume !== 'number' || !Number.isFinite(peakVolume) || peakVolume < 0 || peakVolume > 100) {
      errors.push('peakVolume must be a number between 0 and 100')
    } else {
      finalPeakVolume = Math.round(peakVolume * 10) / 10
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, event: null }
  }

  const event = {
    id: uuidv4(),
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    place: sanitizePlace(place),
    intensity: finalIntensity,
    country: country.toUpperCase(),
    timestamp: Date.now(),
    type: finalType,
    audioData,
    audioMimeType: finalAudioMimeType,
    duration: finalDuration,
    volume: finalVolume,
    peakVolume: finalPeakVolume,
    clientPostId: finalClientPostId,
  }

  return { valid: true, errors: [], event, clientDeleteToken: finalDeleteToken }
}
