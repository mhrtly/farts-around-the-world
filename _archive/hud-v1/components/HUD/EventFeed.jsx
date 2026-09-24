import React, { useState } from 'react'
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

function FeedRow({ event, maxVolume, index, onEventClick }) {
  const [hovered, setHovered] = useState(false)
  const cls = classifyEmission(event.duration, event.volume)
  const isRecent = (Date.now() - event.timestamp) < 30000

  // Volume bar width (relative to max)
  const volPct = event.volume != null && maxVolume > 0
    ? Math.round((event.volume / maxVolume) * 100)
    : 0

  return (
    <div
      className="feed-item"
      onClick={() => onEventClick?.(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: onEventClick ? 'pointer' : 'default',
        borderColor: hovered
          ? `${cls.color}30`
          : isRecent
            ? 'rgba(157,255,74,0.08)'
            : undefined,
        background: hovered
          ? `${cls.color}08`
          : isRecent
            ? 'rgba(157,255,74,0.03)'
            : undefined,
        boxShadow: hovered
          ? `inset 2px 0 0 ${cls.color}66`
          : isRecent
            ? 'inset 2px 0 0 rgba(157,255,74,0.2)'
            : undefined,
        transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        transition: 'all 0.15s ease',
        animation: `feed-in 0.25s ease-out ${index * 0.03}s both`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Volume background bar */}
      {volPct > 0 && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: `${volPct}%`,
          background: `linear-gradient(90deg, ${cls.color}08, transparent)`,
          pointerEvents: 'none',
          transition: 'width 0.3s ease',
        }} />
      )}

      <span
        className="feed-dot"
        style={{
          background: cls.color,
          boxShadow: `0 0 5px ${cls.color}`,
          position: 'relative',
          zIndex: 1,
        }}
      />
      <span className="feed-flag" style={{ position: 'relative', zIndex: 1 }}>
        {FLAG_EMOJIS[event.country] ?? '🌍'}
      </span>
      <span className="feed-alias" style={{
        position: 'relative', zIndex: 1,
        color: hovered ? 'rgba(56,243,255,0.7)' : undefined,
      }}>
        {aliasForEvent(event.id)}
      </span>
      <span
        className="feed-type"
        style={{
          color: cls.color,
          borderColor: `${cls.color}44`,
          position: 'relative',
          zIndex: 1,
          background: hovered ? `${cls.color}15` : undefined,
        }}
      >
        {cls.code}
      </span>
      {event.duration != null && (
        <span className="feed-stat" style={{
          position: 'relative', zIndex: 1,
          color: hovered ? '#ff64ff' : undefined,
          transition: 'color 0.15s ease',
        }}>
          {event.duration}s
        </span>
      )}
      {event.volume != null && hovered && (
        <span style={{
          fontSize: '8px',
          color: '#38f3ff',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
          animation: 'fadeIn 0.15s ease',
        }}>
          v{event.volume}
        </span>
      )}
      {event.hasAudio && (
        <span className="feed-audio" style={{ position: 'relative', zIndex: 1 }}>♪</span>
      )}
      <span className="feed-time" style={{
        position: 'relative', zIndex: 1,
        color: isRecent ? '#9dff4a' : undefined,
        fontWeight: isRecent ? 'bold' : undefined,
      }}>
        {timeSince(event.timestamp)}
      </span>
    </div>
  )
}

export default function EventFeed({ events, onEventClick }) {
  const displayed = events.slice(0, 15)

  // Find max volume for relative bar sizing
  const maxVolume = displayed.reduce((max, e) => Math.max(max, e.volume || 0), 0)

  return (
    <div className="event-feed">
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
          {displayed.map((e, i) => (
            <FeedRow
              key={e.id}
              event={e}
              maxVolume={maxVolume}
              index={i}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
