import React from 'react'
import { REPORTER_ALIASES } from '../../config/humor.ts'
import { classifyEmission } from '../../config/humor.ts'

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
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export default function EventFeed({ events, onEventClick }) {
  const displayed = events.slice(0, 15)

  return (
    <div className="event-feed">
      <div className="panel-title">LIVE FEED</div>

      {displayed.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '12px 4px',
          fontSize: '9px', letterSpacing: '0.12em',
          color: 'var(--text-dim)',
        }}>
          No signals detected
        </div>
      ) : (
        <div className="feed-list">
          {displayed.map(e => {
            const cls = classifyEmission(e.duration, e.volume)
            return (
              <div
                key={e.id}
                className="feed-item"
                onClick={() => onEventClick?.(e)}
                style={{ cursor: onEventClick ? 'pointer' : 'default' }}
              >
                <span
                  className="feed-dot"
                  style={{ background: cls.color, boxShadow: `0 0 5px ${cls.color}` }}
                />
                <span className="feed-flag">{FLAG_EMOJIS[e.country] ?? '🌍'}</span>
                <span className="feed-alias">{aliasForEvent(e.id)}</span>
                <span
                  className="feed-type"
                  style={{ color: cls.color, borderColor: `${cls.color}44` }}
                >
                  {cls.code}
                </span>
                {e.duration != null && (
                  <span className="feed-stat">{e.duration}s</span>
                )}
                {e.hasAudio && (
                  <span className="feed-audio">♪</span>
                )}
                <span className="feed-time">{timeSince(e.timestamp)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
