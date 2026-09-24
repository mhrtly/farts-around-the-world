// Helpers for turning raw recording events into things people can read:
// places, flags, times, loudness words, musical notes, and map "sites".

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

export function countryName(code) {
  if (!code || code === 'XX') return 'Somewhere on Earth'
  try {
    return regionNames?.of(code.toUpperCase()) || code
  } catch {
    return code
  }
}

export function flagEmoji(code) {
  if (!code || !/^[a-z]{2}$/i.test(code) || code.toUpperCase() === 'XX') return '🌍'
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// "Grand Canyon Village, Arizona" → { title: 'Grand Canyon Village', subtitle: 'Arizona, United States' }
export function describePlace(event, fallbackPlace = null) {
  const place = event?.place || fallbackPlace
  const country = countryName(event?.country)
  if (!place) {
    return { title: country, subtitle: null, full: country }
  }
  const [first, ...rest] = place.split(',').map(part => part.trim()).filter(Boolean)
  const subtitleParts = [...rest]
  if (!subtitleParts.includes(country)) subtitleParts.push(country)
  return {
    title: first,
    subtitle: subtitleParts.join(', '),
    full: [first, ...subtitleParts].join(', '),
  }
}

export function siteKey(lat, lng) {
  return `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`
}

// Groups recordings that share a (rounded) location into one map site.
export function groupIntoSites(events) {
  const sites = new Map()
  for (const event of events) {
    const key = siteKey(event.lat, event.lng)
    let site = sites.get(key)
    if (!site) {
      site = { key, lat: Number(event.lat), lng: Number(event.lng), country: event.country, events: [], latest: 0, place: null }
      sites.set(key, site)
    }
    site.events.push(event)
    if (event.timestamp > site.latest) site.latest = event.timestamp
    if (!site.place && event.place) site.place = event.place
  }
  for (const site of sites.values()) {
    site.events.sort((a, b) => b.timestamp - a.timestamp)
    site.country = site.events[0].country
  }
  return [...sites.values()].sort((a, b) => b.latest - a.latest)
}

export function timeAgo(timestamp, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  const date = new Date(timestamp)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 10) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds)} s`
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Loudness words keyed off peak level in dBFS (0 dB = the loudest the mic can capture).
const LOUDNESS_BANDS = [
  { max: -40, word: 'Whisper' },
  { max: -30, word: 'Soft' },
  { max: -21, word: 'Solid' },
  { max: -13, word: 'Loud' },
  { max: Infinity, word: 'Huge' },
]

export function volumeToDb(volume) {
  // Stored volume is RMS × 100 (0–100).
  if (!Number.isFinite(volume) || volume <= 0) return null
  return 20 * Math.log10(volume / 100)
}

export function loudnessWord(peakDb) {
  if (!Number.isFinite(peakDb)) return null
  return LOUDNESS_BANDS.find(band => peakDb <= band.max).word
}

// 0..1 meter position for a peak level between -50 dB and 0 dB.
export function loudnessLevel(peakDb) {
  if (!Number.isFinite(peakDb)) return 0
  return Math.max(0, Math.min(1, (peakDb + 50) / 50))
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

export function noteName(hz) {
  if (!Number.isFinite(hz) || hz <= 0) return null
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

// A playful name built only from what was actually measured.
export function nickname({ duration, peakDb }) {
  const d = Number.isFinite(duration) ? duration : null
  const word = loudnessWord(peakDb)
  if (d == null) return null
  const quiet = word === 'Whisper' || word === 'Soft'
  const loud = word === 'Loud' || word === 'Huge'
  if (d < 0.8) return quiet ? 'Tiny Squeak' : loud ? 'Firecracker' : 'Quick Pop'
  if (d < 2.5) return quiet ? 'Sneaky One' : loud ? 'Brass Section' : 'Standard Issue'
  if (d < 5) return quiet ? 'Slow Leak' : loud ? 'Foghorn' : 'Rolling Thunder'
  return quiet ? 'Marathon Leak' : loud ? 'Tectonic Event' : 'Grand Passage'
}

export function summarizeStats(events, totalAllTime) {
  const sites = new Set()
  const countries = new Set()
  for (const event of events) {
    sites.add(siteKey(event.lat, event.lng))
    if (event.country && event.country !== 'XX') countries.add(event.country)
  }
  return {
    total: Math.max(totalAllTime || 0, events.length),
    places: sites.size,
    countries: countries.size,
  }
}

export function recordingAudioUrl(id) {
  return `/api/events/${encodeURIComponent(id)}/audio`
}

export function recordingShareUrl(id) {
  return `${window.location.origin}/r/${encodeURIComponent(id)}`
}
