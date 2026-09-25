import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { usePlayer, toggle, setPlaybackWindow } from '../../utils/player.js'
import { loadRecordingAnalysis } from '../../utils/audioAnalysis.js'
import {
  describePlace,
  flagEmoji,
  formatSeconds,
  loudnessWord,
  recordingAudioUrl,
  siteKey,
  timeAgo,
  volumeToDb,
} from '../../utils/recordings.js'

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'longest', label: 'Longest' },
  { key: 'loudest', label: 'Loudest' },
]

const TITLES = {
  newest: 'Latest farts',
  longest: 'Longest farts',
  loudest: 'Loudest farts',
  mine: 'Your farts',
}

const PAGE = 60

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
  const [sort, setSort] = useState('newest')
  const [limit, setLimit] = useState(PAGE)
  const player = usePlayer()

  const hasOwn = ownIds.size > 0
  const tabs = hasOwn ? [...SORTS, { key: 'mine', label: 'Mine' }] : SORTS
  const activeSort = sort === 'mine' && !hasOwn ? 'newest' : sort

  const sorted = useMemo(() => {
    const list = activeSort === 'mine' ? events.filter(event => ownIds.has(event.id)) : [...events]
    if (activeSort === 'longest') list.sort((a, b) => (b.duration || 0) - (a.duration || 0) || b.timestamp - a.timestamp)
    else if (activeSort === 'loudest') list.sort((a, b) => (b.peakVolume || -1) - (a.peakVolume || -1) || b.timestamp - a.timestamp)
    else list.sort((a, b) => b.timestamp - a.timestamp)
    return list
  }, [events, activeSort, ownIds])

  return (
    <div className="rlist">
      <div className="rlist__head">
        <h2 className="rlist__title">{TITLES[activeSort]}</h2>
        <div className="segmented" role="tablist" aria-label="Sort recordings">
          {tabs.map(option => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={activeSort === option.key}
              className={activeSort === option.key ? 'is-active' : ''}
              onClick={() => { setSort(option.key); setLimit(PAGE) }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rlist__scroll">
        {loadState === 'loading' && events.length === 0 && (
          <ul className="rlist__items" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => <li key={i} className="rrow rrow--skeleton"><span /><span /></li>)}
          </ul>
        )}

        {loadState === 'error' && events.length === 0 && (
          <div className="rlist__empty">
            <p>Can't reach the fart server right now.</p>
            <button type="button" className="pill-button" onClick={onRetry}>Try again</button>
          </div>
        )}

        {loadState === 'ready' && events.length === 0 && (
          <div className="rlist__empty">
            <p className="rlist__empty-title">No farts yet.</p>
            <p>The map is empty. Somebody has to go first.</p>
            <button type="button" className="pill-button pill-button--record" onClick={onRecord}>
              <Icon name="mic" size={18} /> Record the first one
            </button>
          </div>
        )}

        {activeSort === 'mine' && sorted.length === 0 && events.length > 0 && (
          <div className="rlist__empty">
            <p>Nothing here right now. Farts you post from this device show up in this tab.</p>
          </div>
        )}

        {events.length > 0 && (
          <ul className="rlist__items">
            {sorted.slice(0, limit).map(event => {
              const key = siteKey(event.lat, event.lng)
              const place = describePlace(event, places[key])
              const isCurrent = player.id === event.id
              const playing = isCurrent && (player.status === 'playing' || player.status === 'loading')
              const loud = loudnessWord(volumeToDb(event.peakVolume))
              return (
                <li key={event.id}>
                  <div
                    className={`rrow ${selectedId === event.id ? 'is-selected' : ''} ${playing ? 'is-playing' : ''}`}
                    onMouseEnter={() => onHover?.(event)}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <button
                      type="button"
                      className="rrow__main"
                      onClick={() => onSelect(event, { autoplay: true })}
                    >
                      <span className="rrow__flag" aria-hidden="true">{flagEmoji(event.country)}</span>
                      <span className="rrow__text">
                        <span className="rrow__place">{place.title}</span>
                        <span className="rrow__meta">
                          {timeAgo(event.timestamp)}
                          {event.duration != null && <> · {formatSeconds(event.duration)}</>}
                          {loud && <> · {loud}</>}
                          {ownIds.has(event.id) && <span className="badge badge--lime">Yours</span>}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rrow__play"
                      aria-label={playing ? 'Pause' : `Play the fart from ${place.title}`}
                      onClick={() => {
                        toggle(event.id, recordingAudioUrl(event.id), { duration: event.duration })
                        loadRecordingAnalysis(event.id)
                          .then(analysis => setPlaybackWindow(event.id, analysis.trimStart, analysis.trimEnd, analysis.peaks))
                          .catch(() => {})
                      }}
                    >
                      {isCurrent && player.status === 'loading'
                        ? <span className="spinner spinner--sm" />
                        : <Icon name={playing ? 'pause' : 'play'} size={16} />}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {sorted.length > limit && (
          <button type="button" className="rlist__more" onClick={() => setLimit(limit + PAGE)}>
            Show more ({sorted.length - limit} left)
          </button>
        )}
      </div>
    </div>
  )
}
