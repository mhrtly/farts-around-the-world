import { v4 as uuidv4 } from 'uuid'

const VALID_TYPES = new Set(['standard', 'epic', 'silent-but-deadly'])

const VALID_COUNTRIES = new Set([
  'US','GB','DE','FR','JP','CN','BR','IN','AU','CA',
  'MX','RU','NG','ZA','EG','AR','KR','ID','TR','IT',
])

export function validateFartEvent(body) {
  const errors = []

  if (body == null || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'], event: null }
  }

  const { lat, lng, intensity, country, type } = body

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

  // intensity
  if (typeof intensity !== 'number' || !Number.isInteger(intensity)) {
    errors.push('intensity must be an integer')
  } else if (intensity < 1 || intensity > 10) {
    errors.push('intensity must be between 1 and 10')
  }

  // country
  if (typeof country !== 'string') {
    errors.push('country must be a string')
  } else if (!VALID_COUNTRIES.has(country.toUpperCase())) {
    errors.push(`country must be one of: ${[...VALID_COUNTRIES].join(', ')}`)
  }

  // type
  if (typeof type !== 'string') {
    errors.push('type must be a string')
  } else if (!VALID_TYPES.has(type)) {
    errors.push(`type must be one of: ${[...VALID_TYPES].join(', ')}`)
  }

  if (errors.length > 0) {
    return { valid: false, errors, event: null }
  }

  // Build canonical event — id and timestamp are always server-generated
  const event = {
    id: uuidv4(),
    lat: Math.round(lat * 1e6) / 1e6,   // 6 decimal places (~0.1m precision)
    lng: Math.round(lng * 1e6) / 1e6,
    intensity: Math.round(intensity),
    country: country.toUpperCase(),
    timestamp: Date.now(),
    type,
  }

  return { valid: true, errors: [], event }
}
