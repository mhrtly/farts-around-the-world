// Where did it happen? GPS and an approximate network location together, plus
// human-readable place names (cached so each spot is looked up only once).

const GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
const PLACE_CACHE_KEY = 'fatw:places:v1'
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

async function gpsLocation() {
  const coords = await getGpsPosition()
  const base = { lat: roundCoord(coords.latitude), lng: roundCoord(coords.longitude), country: 'XX', place: null, source: 'gps' }
  try {
    // ~100 m is plenty to name the neighborhood; no need to share the exact spot
    const named = await reverseGeocode(
      Math.round(coords.latitude * 1000) / 1000,
      Math.round(coords.longitude * 1000) / 1000,
    )
    return { ...base, ...named }
  } catch {
    return base
  }
}

// When both come back, a short wait lets a GPS fix that's nearly there win
// outright, so the place doesn't visibly change a moment later.
const GPS_GRACE_MS = 600
// GPS's own timeout only starts once permission is granted, so an unanswered
// prompt would otherwise keep us waiting forever.
const GPS_PROMPT_WAIT_MS = 12000

// Finds a posting location. GPS and an approximate network estimate start
// together; this resolves with whichever arrives first (so Post never waits on
// an unanswered permission prompt). If the network estimate wins, its value
// carries `upgrade` — a promise of the GPS fix (or null if GPS fails) — and
// `onUpdate` is called when the GPS fix arrives.
// Rejects when both fail, or when the network fails and GPS is still waiting
// (probably on a prompt) after 12 s; the error's `code` is 'denied',
// 'offline', 'waiting' or 'unavailable'. A GPS fix that arrives after a
// rejection still reaches `onUpdate`.
export function locate({ onUpdate } = {}) {
  const fromGps = gpsLocation()
  const fromNetwork = networkLocation()
  let gpsState = 'pending'
  let gpsError = null
  const gpsOrNull = fromGps.then(
    fix => { gpsState = 'done'; return fix },
    error => { gpsState = 'failed'; gpsError = error; return null },
  )

  return new Promise((resolve, reject) => {
    let done = false
    const finish = value => {
      if (done) return false
      done = true
      resolve(value)
      return true
    }

    fromGps.then(fix => {
      if (!finish(fix)) onUpdate?.(fix)
    }, () => {})

    fromNetwork.then(
      async estimate => {
        if (done) return
        if (gpsState === 'pending') {
          await Promise.race([gpsOrNull, new Promise(r => setTimeout(r, GPS_GRACE_MS))])
          if (done || gpsState === 'done') return
        }
        finish({
          ...estimate,
          gpsDenied: gpsError?.code === 'denied',
          upgrade: gpsState === 'pending' ? gpsOrNull : null,
        })
      },
      async networkError => {
        const gps = await Promise.race([gpsOrNull, new Promise(r => setTimeout(() => r(null), GPS_PROMPT_WAIT_MS))])
        if (gps || done) return
        done = true
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        const code = gpsError?.code === 'denied' ? 'denied'
          : offline ? 'offline'
            : gpsState === 'pending' ? 'waiting'
              : 'unavailable'
        reject(Object.assign(new Error(gpsError?.message || networkError?.message || 'Location unavailable'), { code }))
      },
    )
  })
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
