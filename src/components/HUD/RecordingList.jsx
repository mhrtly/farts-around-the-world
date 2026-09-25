import { useEffect, useMemo, useRef, useState } from 'react'
import Glyph from './deck/Glyph.jsx'
import { rovingKeyDown } from './deck/roving.js'
import { measurementsOf, rememberAnalysis, useMeasurements } from './deck/measurements.js'
import { formatDb, whenPosted } from './deck/format.js'
import { usePlayer, toggle, setPlaybackWindow } from '../../utils/player.js'
import { loadRecordingAnalysis } from '../../utils/audioAnalysis.js'
import {
  describePlace,
  formatLength,
  recordingAudioUrl,
  siteKey,
} from '../../utils/recordings.js'

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'longest', label: 'Longest' },
  { key: 'loudest', label: 'Loudest' },
  { key: 'mine', label: 'Mine' },
]

const PAGE = 60
const HOUR = 60 * 60 * 1000

// On phones the log lives in a sheet that unmounts when it closes; the sort
// you picked should still be there when it opens again.
let lastSort = 'newest'

// Measured rows first (biggest first), then the ones nobody has measured yet.
function byMeasurement(field) {
  return (a, b) => {
    const aKnown = Number.isFinite(a[field])
    const bKnown = Number.isFinite(b[field])
    if (aKnown !== bKnown) return aKnown ? -1 : 1
    if (aKnown && a[field] !== b[field]) return b[field] - a[field]
    return b.event.timestamp - a.event.timestamp
  }
}

function playRow(event) {
  toggle(event.id, recordingAudioUrl(event.id), { duration: event.duration })
  loadRecordingAnalysis(event.id)
    .then(analysis => {
      setPlaybackWindow(event.id, analysis.trimStart, analysis.trimEnd, analysis.peaks)
      rememberAnalysis(event.id, analysis)
    })
    .catch(() => {})
}

// The log: every fart, sortable, each row playable in place.
export default function RecordingList({
  events,
  places,
  selectedId,
  loadState,
  ownIds,
  onSelect,
  onHover,
  onRecord,
  onRetry,
}) {
  const [sort, setSortState] = useState(() => lastSort)
  const [limit, setLimit] = useState(PAGE)
  const setSort = next => {
    lastSort = next
    setSortState(next)
    setLimit(PAGE)
  }
  const player = usePlayer()
  const measuredVersion = useMeasurements()

  const rows = useMemo(
    () => events.map(event => ({ event, ...measurementsOf(event) })),
    [events, measuredVersion], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const sorted = useMemo(() => {
    const list = sort === 'mine' ? rows.filter(row => ownIds.has(row.event.id)) : [...rows]
    if (sort === 'longest') list.sort(byMeasurement('duration'))
    else if (sort === 'loudest') list.sort(byMeasurement('peakDb'))
    else list.sort((a, b) => b.event.timestamp - a.event.timestamp)
    return list
  }, [rows, sort, ownIds])

  // Keep the open fart's row in view when it changes from elsewhere (globe, keys)
  const scrollRef = useRef(null)
  useEffect(() => {
    const scroller = scrollRef.current
    const row = scroller?.querySelector('.rrow.is-selected')
    if (!row || !scroller.offsetParent) return
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top >= scroller.scrollTop && bottom <= scroller.scrollTop + scroller.clientHeight) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 2 + row.offsetHeight / 2), behavior: reduced ? 'auto' : 'smooth' })
  }, [selectedId])

  // A new sort starts at the top: LOUDEST should show the loudest first
  const sortRef = useRef(sort)
  useEffect(() => {
    if (sortRef.current === sort) return
    sortRef.current = sort
    scrollRef.current?.scrollTo({ top: 0 })
  }, [sort])

  const now = Date.now()
  const loading = loadState === 'loading' && events.length === 0
  const failed = loadState === 'error' && events.length === 0
  const empty = loadState === 'ready' && events.length === 0

  return (
    <div className="rlist">
      <div className="rlist__head">
        <div className="rlist__plate">
          <h2 className="plate-title" id="log-title">All farts</h2>
          {events.length > 0 && (
            <span className="rlist__count">
              {sort === 'mine' ? `${sorted.length} of ${events.length}` : events.length}
            </span>
          )}
        </div>
        <div
          className="presets presets--sort"
          role="group"
          aria-label="Sort farts"
          onKeyDown={event => rovingKeyDown(event, index => setSort(SORTS[index].key))}
        >
          {SORTS.map(option => (
            <button
              key={option.key}
              type="button"
              className="preset"
              aria-pressed={sort === option.key}
              tabIndex={sort === option.key ? 0 : -1}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="rlist__scroll">
        {loading && (
          <ul className="rlist__items" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i} className="rrow rrow--skeleton">
                <span className="ghost ghost--chip" />
                <span className="rrow__text">
                  <span className={`ghost ghost--place ghost--w${i % 3}`} />
                  <span className="ghost ghost--date" />
                </span>
                <span className="ghost ghost--len" />
                <span className="ghost ghost--key" />
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="sr-only" role="status">Loading farts</p>}

        {failed && (
          <div className="rlist__empty">
            <div className="rlist__empty-title">
              <span className="led led--sodium" aria-hidden="true" />
              Can’t reach the fart server.
            </div>
            <p>Check your connection, then try again.</p>
            <button type="button" className="key rlist__retry" onClick={onRetry}>Try again</button>
          </div>
        )}

        {empty && (
          <div className="rlist__empty rlist__empty--first">
            <div className="rlist__empty-title">No farts yet.</div>
            <p>The map is empty. Somebody has to go first.</p>
            <div className="rlist__rec">
              <span className="bezel">
                <button type="button" className="key-ceramic key-ceramic--round" onClick={onRecord} aria-label="Record the first fart">
                  <span className="rec-dot" />
                </button>
              </span>
              <span className="key-legend">Record the first one</span>
            </div>
          </div>
        )}

        {sort === 'mine' && sorted.length === 0 && events.length > 0 && (
          <div className="rlist__empty">
            <div className="rlist__empty-title">None of yours yet.</div>
            <p>Farts you post from this device show up here, and only this device can delete them.</p>
          </div>
        )}

        {sorted.length > 0 && (
          <ul className="rlist__items" aria-labelledby="log-title">
            {sorted.slice(0, limit).map(({ event, duration, peakDb }) => {
              const place = describePlace(event, places[siteKey(event.lat, event.lng)])
              const isCurrent = player.id === event.id
              const playing = isCurrent && player.status === 'playing'
              const busy = isCurrent && player.status === 'loading'
              const selected = selectedId === event.id
              const own = ownIds.has(event.id)
              const fresh = now - event.timestamp < HOUR
              const code = event.country && event.country !== 'XX' ? event.country.toUpperCase() : '--'
              const showDb = sort === 'loudest'
              // Tenths here: a run of real peaks between −10.6 and −11.4 dB
              // would all print "−11 dB" and the order would look random
              const reading = showDb
                ? (Number.isFinite(peakDb) ? formatDb(peakDb, 1) : null)
                : (duration != null ? formatLength(duration) : null)
              return (
                <li
                  key={event.id}
                  className={`rrow ${selected ? 'is-selected' : ''} ${playing || busy ? 'is-playing' : ''}`}
                  onMouseEnter={() => onHover?.(event)}
                  onMouseLeave={() => onHover?.(null)}
                >
                  <button
                    type="button"
                    className="rrow__main"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(event, { autoplay: true })}
                  >
                    <span className="cc-chip" aria-hidden="true">{code}</span>
                    <span className="rrow__text">
                      <span className="rrow__place">
                        {place.title}
                        {place.subtitle && <span className="sr-only">, {place.subtitle}</span>}
                      </span>
                      <span className="rrow__date">
                        {fresh && <span className="led led--sodium" aria-hidden="true" />}
                        {whenPosted(event.timestamp, now)}
                        {own && <span className="rrow__yours">Yours</span>}
                      </span>
                    </span>
                    <span className={`rrow__len ${reading ? '' : 'is-ghost'}`}>
                      {reading || (showDb ? '--.- dB' : '-.-- s')}
                      {!reading && <span className="sr-only">not measured yet</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rrow__play ${busy ? 'is-busy' : ''}`}
                    aria-pressed={playing || busy}
                    aria-label={`Play the fart from ${place.title}, ${whenPosted(event.timestamp, now).toLowerCase()}`}
                    onClick={() => playRow(event)}
                  >
                    <span className="rrow__key">
                      <Glyph name={playing || busy ? 'pause' : 'play'} size={12} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {sorted.length > limit && (
          <button type="button" className="key key--wide rlist__more" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, sorted.length - limit)} more
          </button>
        )}
      </div>
    </div>
  )
}
