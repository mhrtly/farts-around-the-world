import { v4 as uuidv4 } from 'uuid'

const VALID_TYPES = new Set(['standard', 'epic', 'silent-but-deadly'])

// Stored coordinates are rounded to ~1 km (2 decimals) — enough to put a
// recording on the map, not enough to find anyone's house.
const COORD_DECIMALS = 2
const MAX_DURATION_SECONDS = 12
const MAX_PLACE_LENGTH = 120

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

export function validateFartEvent(body) {
  const errors = []

  if (body == null || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'], event: null }
  }

  const { lat, lng, intensity, country, type, audioData, audioMimeType, duration, volume, peakVolume, place } = body

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
      finalDuration = Math.round(duration * 10) / 10
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
  }

  return { valid: true, errors: [], event }
}
