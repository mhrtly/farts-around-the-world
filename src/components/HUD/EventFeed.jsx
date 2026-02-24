import React from 'react'
import { REPORTER_ALIASES } from '../../config/humor.ts'

const TYPE_COLORS = {
  standard: '#38f3ff',
  epic: '#ff64ff',
  'silent-but-deadly': '#9dff4a',
}

const TYPE_LABELS = {
  standard: 'STD',
  epic: 'EPIC',
  'silent-but-deadly': 'SBD',
}

const FLAG_EMOJIS = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵',
  CN:'🇨🇳', BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦',
  MX:'🇲🇽', RU:'🇷🇺', NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬',
  AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩', TR:'🇹🇷', IT:'🇮🇹',
}

// Derive a stable alias from the event ID so it doesn't change on re-renders
function aliasForEvent(id) {
  const seed = parseInt(id.slice(0, 4).replace(/-/g, ''), 16) || 0
  return REPORTER_ALIASES[seed % REPORTER_ALIASES.length]
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

export default function EventFeed({ events }) {
  return (
    <div className="event-feed">
      <div className="panel-title">LIVE FEED</div>
      <div className="feed-list">
        {events.map(e => (
          <div key={e.id} className="feed-item">
            <span
              className="feed-dot"
              style={{ background: TYPE_COLORS[e.type], boxShadow: `0 0 5px ${TYPE_COLORS[e.type]}` }}
            />
            <span className="feed-flag">{FLAG_EMOJIS[e.country] ?? '🌍'}</span>
            <span className="feed-alias">{aliasForEvent(e.id)}</span>
            <span className="feed-coords">
              {e.lat.toFixed(1)}°&nbsp;{e.lng.toFixed(1)}°
            </span>
            <span
              className="feed-type"
              style={{ color: TYPE_COLORS[e.type], borderColor: TYPE_COLORS[e.type] }}
            >
              {TYPE_LABELS[e.type]}
            </span>
            <span className="feed-intensity">I:{e.intensity}</span>
            <span className="feed-time">{timeSince(e.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
