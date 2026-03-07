import { useMemo } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h`
}

/**
 * Compact recent event mini-feed for the right panel.
 * Shows the last 4 events as tiny signal rows.
 */
export default function RecentSignals({ events }) {
  const recentEvents = useMemo(() => {
    return events.slice(0, 4)
  }, [events])

  if (recentEvents.length === 0) {
    return (
      <div style={{
        padding: '8px 10px',
        borderRadius: '4px',
        border: '1px solid rgba(56,243,255,0.06)',
        background: 'rgba(56,243,255,0.02)',
        fontFamily: 'monospace',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '7px',
          letterSpacing: '0.2em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          RECENT SIGNALS
        </div>
        <div style={{
          fontSize: '9px',
          color: 'rgba(56,243,255,0.25)',
          letterSpacing: '0.06em',
        }}>
          Awaiting transmissions...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: '4px',
      border: '1px solid rgba(56,243,255,0.08)',
      background: 'rgba(6,9,13,0.4)',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      {/* Mini header */}
      <div style={{
        padding: '5px 10px',
        fontSize: '7px',
        letterSpacing: '0.2em',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(56,243,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>RECENT SIGNALS</span>
        <span style={{
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          background: '#9dff4a',
          boxShadow: '0 0 4px rgba(157,255,74,0.5)',
          animation: 'pulseOpacity 2s ease-in-out infinite',
          display: 'inline-block',
        }} />
      </div>

      {/* Signal rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {recentEvents.map((e, i) => {
          const cls = classifyEmission(e.duration, e.volume)
          const flag = FLAG_MAP[e.country] || '🌍'

          return (
            <div
              key={e.id || i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderBottom: i < recentEvents.length - 1
                  ? '1px solid rgba(56,243,255,0.03)'
                  : 'none',
                animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
              }}
            >
              {/* Flag */}
              <span style={{ fontSize: '11px', flexShrink: 0 }}>{flag}</span>

              {/* Classification dot */}
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: cls.color,
                boxShadow: `0 0 4px ${cls.color}55`,
                flexShrink: 0,
              }} />

              {/* Country code */}
              <span style={{
                fontSize: '8px',
                color: 'var(--text-primary)',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                width: '18px',
                flexShrink: 0,
              }}>
                {e.country}
              </span>

              {/* Duration if available */}
              {e.duration != null && (
                <span style={{
                  fontSize: '8px',
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                }}>
                  {e.duration}s
                </span>
              )}

              {/* Audio indicator */}
              {e.hasAudio && (
                <span style={{
                  fontSize: '8px',
                  color: '#9dff4a',
                  flexShrink: 0,
                }}>
                  ♪
                </span>
              )}

              {/* Time — pushed right */}
              <span style={{
                fontSize: '7px',
                color: 'rgba(255,255,255,0.15)',
                marginLeft: 'auto',
                flexShrink: 0,
              }}>
                {relativeTime(e.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
