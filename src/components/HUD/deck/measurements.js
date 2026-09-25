import { useSyncExternalStore } from 'react'
import { soundSeconds } from '../../../utils/audioAnalysis.js'
import { volumeToDb } from '../../../utils/recordings.js'

// One source of truth for a recording's length and loudness.
// Rows posted since the rebuild store the real measurements (volume != null);
// they win. Older rows only have the whole clip length, so their numbers come
// from the client's own analysis once somebody opens or plays them — and the
// list picks that up too, so the list and the deck never disagree.

const measured = new Map() // id → { duration, peakDb }
const listeners = new Set()
let version = 0

export function rememberAnalysis(id, analysis) {
  if (!id || !analysis) return
  const next = { duration: soundSeconds(analysis), peakDb: analysis.peakDb }
  const previous = measured.get(id)
  if (previous && previous.duration === next.duration && previous.peakDb === next.peakDb) return
  measured.set(id, next)
  version++
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getVersion = () => version

// Re-render when a new measurement lands.
export function useMeasurements() {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

export function hasStoredMeasurements(event) {
  return event?.volume != null
}

// { duration, peakDb } — either may be null while unknown.
export function measurementsOf(event, analysis = null) {
  if (!event) return { duration: null, peakDb: null }
  const storedPeak = volumeToDb(event.peakVolume)
  if (hasStoredMeasurements(event)) {
    return {
      duration: Number.isFinite(event.duration) ? event.duration : null,
      peakDb: storedPeak ?? analysis?.peakDb ?? null,
    }
  }
  const known = analysis
    ? { duration: soundSeconds(analysis), peakDb: analysis.peakDb }
    : measured.get(event.id)
  return {
    duration: known?.duration ?? null,
    // A stored peak (without a stored length) was still measured before upload
    peakDb: storedPeak ?? (Number.isFinite(known?.peakDb) ? known.peakDb : null),
  }
}
