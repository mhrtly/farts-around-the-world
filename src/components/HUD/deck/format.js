import { formatDay, timeAgo } from '../../../utils/recordings.js'

const DAY = 24 * 60 * 60 * 1000

// "−11 dB" (a real minus sign), to the whole decibel unless asked for tenths
export function formatDb(db, digits = 0) {
  const scale = 10 ** digits
  const rounded = Math.round(db * scale) / scale
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(digits)} dB`
}

// Within a day: "12 MIN AGO"; after that the date ("MAR 25")
export function whenPosted(timestamp, now = Date.now()) {
  return now - timestamp < DAY ? timeAgo(timestamp, now).toUpperCase() : formatDay(timestamp)
}
