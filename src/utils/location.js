// Where did it happen? GPS first, then an approximate network location, plus
// human-readable place names (cached so each spot is looked up only once).

const GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
const PLACE_CACHE_KEY = 'fatw:places:v1'
const GPS_GIVE_UP_MS = 12000
// Big federal countries read better as "Town, State"; elsewhere "District, City".
const STATE_FIRST = new Set(['US', 'CA', 'AU', 'BR', 'IN', 'MX', 'AR', 'RU', 'CN', 'NG', 'DE'])

export const PUBLIC_COORD_DECIMALS = 2

export function roundCoord(value) {
  const factor = 10 ** PUBLIC_COORD_DECIMALS
  return Math.round(value * factor) / factor
}

function readPlaceCache() {
  try {
    return JSON.parse(localStorage.getItem(PLACE_CACHE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

const placeCache = readPlaceCache()

function cacheKey(lat, lng) {
  return `${roundCoord(lat).toFixed(2)},${roundCoord(lng).toFixed(2)}`
}

function rememberPlace(lat, lng, value) {
  placeCache[cacheKey(lat, lng)] = value
  try {
    localStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(placeCache))
  } catch {
    // storage full or blocked — the in-memory cache still works
  }
}

export function cachedPlace(lat, lng) {
  return placeCache[cacheKey(lat, lng)] || null
}

export function formatPlace(data) {
  const country = (data?.countryCode || '').toUpperCase()
  const primary = data?.locality || data?.city || ''
  let secondary = ''
  if (STATE_FIRST.has(country)) {
    secondary = data?.principalSubdivision || data?.city || ''
  } else {
    secondary = data?.city && data.city !== primary ? data.city : data?.principalSubdivision || ''
  }
  const parts = [primary, secondary].filter(Boolean)
  const unique = parts.filter((part, index) => parts.indexOf(part) === index)
  return unique.join(', ') || data?.principalSubdivision || null
}

async function geocode(params = {}) {
  const query = new URLSearchParams({ localityLanguage: 'en', ...params })
  const res = await fetch(`${GEOCODE_URL}?${query}`)
  if (!res.ok) throw new Error('Place lookup failed')
  return res.json()
}

export async function reverseGeocode(lat, lng) {
  const cached = cachedPlace(lat, lng)
  if (cached) return cached
  const data = await geocode({ latitude: lat, longitude: lng })
  const result = {
    place: formatPlace(data),
    country: (data.countryCode || 'XX').toUpperCase() || 'XX',
  }
  rememberPlace(lat, lng, result)
  return result
}

function getGpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('Location is not available in this browser'), { code: 'unsupported' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      error => reject(Object.assign(new Error(error.message || 'Location unavailable'), {
        code: error.code === 1 ? 'denied' : 'unavailable',
      })),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

async function networkLocation() {
  const data = await geocode()
  if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
    throw new Error('Could not estimate your location')
  }
  return {
    lat: roundCoord(data.latitude),
    lng: roundCoord(data.longitude),
    country: (data.countryCode || 'XX').toUpperCase(),
    place: formatPlace(data),
    source: 'network',
  }
}

// Resolves a posting location. Tries GPS; if it's denied, unavailable, or the
// permission prompt is ignored, falls back to an approximate network location.
// `onUpdate` fires with each improvement (e.g. network first, then GPS).
export async function locate({ onUpdate } = {}) {
  let settled = false
  let gpsDenied = false

  const fromGps = getGpsPosition().then(async coords => {
    const lat = roundCoord(coords.latitude)
    const lng = roundCoord(coords.longitude)
    const base = { lat, lng, country: 'XX', place: null, source: 'gps' }
    try {
      const named = await reverseGeocode(coords.latitude, coords.longitude)
      return { ...base, ...named }
    } catch {
      return base
    }
  })

  const giveUp = new Promise(resolve => setTimeout(() => resolve('timeout'), GPS_GIVE_UP_MS))

  try {
    const first = await Promise.race([fromGps, giveUp])
    if (first !== 'timeout') {
      settled = true
      return first
    }
  } catch (error) {
    gpsDenied = error.code === 'denied'
  }

  const approximate = await networkLocation()
  const result = { ...approximate, gpsDenied }
  if (!settled) {
    // If GPS answers late (user finally tapped "Allow"), upgrade quietly.
    fromGps.then(better => onUpdate?.(better)).catch(() => {})
  }
  return result
}

// Background lookups for older recordings that were posted without a place name.
const pending = new Map()
const queue = []
let active = 0

function pump() {
  while (active < 2 && queue.length) {
    const job = queue.shift()
    active++
    reverseGeocode(job.lat, job.lng)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--
        pump()
      })
  }
}

export function lookupPlace(lat, lng) {
  const key = cacheKey(lat, lng)
  const cached = placeCache[key]
  if (cached) return Promise.resolve(cached)
  if (pending.has(key)) return pending.get(key)
  const promise = new Promise((resolve, reject) => {
    queue.push({ lat, lng, resolve, reject })
    pump()
  })
  pending.set(key, promise)
  promise.catch(() => {}).finally(() => pending.delete(key))
  return promise
}
