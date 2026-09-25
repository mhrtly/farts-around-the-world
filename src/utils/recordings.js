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

// Recordings within about 2 km of each other share one map site, so GPS
// jitter across a rounding line doesn't stack two dots on the same spot. The
// first recording made there anchors (and names) the site.
const NEAR_DEGREES = 0.02

export function groupIntoSites(events) {
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const sites = []
  const byKey = new Map()
  for (const event of ordered) {
    const lat = Number(event.lat)
    const lng = Number(event.lng)
    const key = siteKey(lat, lng)
    let site = byKey.get(key)
    if (!site) {
      const lngSpan = NEAR_DEGREES / Math.max(0.3, Math.cos((lat * Math.PI) / 180))
      site = sites.find(candidate => (
        Math.abs(candidate.lat - lat) <= NEAR_DEGREES &&
        Math.abs(((candidate.lng - lng + 540) % 360) - 180) <= lngSpan
      ))
      if (!site) {
        site = { key, lat, lng, country: event.country, events: [], latest: 0, place: null }
        sites.push(site)
      }
      byKey.set(key, site)
    }
    site.events.push(event)
    if (event.timestamp > site.latest) site.latest = event.timestamp
    if (!site.place && event.place) site.place = event.place
  }
  for (const site of sites) {
    site.events.sort((a, b) => b.timestamp - a.timestamp)
    site.country = site.events[0].country
  }
  return sites.sort((a, b) => b.latest - a.latest)
}

// event id → the key of the map site it belongs to
export function siteIndex(sites) {
  const index = new Map()
  for (const site of sites) for (const event of site.events) index.set(event.id, site.key)
  return index
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

// Length of a sound: hundredths under a second ("0.16 s"), tenths under ten
// ("4.6 s"), whole seconds after that ("10 s").
export function formatLength(seconds) {
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 0.995) return `${Math.max(0.01, seconds).toFixed(2)} s`
  if (seconds < 9.95) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds)} s`
}

// Playback position for short clips: "0.7" / "1.6" (tenths), "0.16" under a second.
export function formatPlayhead(seconds, total = seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  if (Number.isFinite(total) && total < 0.995) return seconds.toFixed(2)
  return seconds.toFixed(1)
}

export function formatCoords(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return ''
  const la = Number(lat)
  const lo = Number(lng)
  return `${Math.abs(la).toFixed(2)}°${la >= 0 ? 'N' : 'S'} ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? 'E' : 'W'}`
}

// "No. 9 of 30": a recording's real position in time order (oldest = 1).
export function ordinalOf(events, id) {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const index = sorted.findIndex(event => event.id === id)
  return index < 0 ? null : { n: index + 1, total: sorted.length }
}

export function formatDay(timestamp) {
  const date = new Date(timestamp)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).toUpperCase()
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Loudness words keyed off peak level in dBFS (0 dB = the loudest the mic can
// capture). Calibrated on real recordings: most phone farts peak between
// −16 and −10 dBFS, so HUGE is kept for the ones that nearly clip.
export const LOUDNESS_BANDS = [
  { max: -40, word: 'Whisper' },
  { max: -30, word: 'Soft' },
  { max: -20, word: 'Solid' },
  { max: -9, word: 'Loud' },
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
