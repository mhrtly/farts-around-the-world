import { useMemo, useState } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪',
  FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺',
  CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬',
  AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function HighlightCard({ title, titleColor, event, accentColor, index = 0, onFlyTo }) {
  const [hovered, setHovered] = useState(false)

  if (!event) return null
  const cls = classifyEmission(event.duration, event.volume)
  const flag = FLAG_MAP[event.country] || '🌍'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onFlyTo?.({ lat: event.lat, lng: event.lng, altitude: 1.2 })}
      style={{
        flex: '0 0 auto',
        minWidth: '180px',
        maxWidth: '220px',
        padding: '8px 12px',
        background: hovered ? 'rgba(10,18,28,0.85)' : 'rgba(10,18,28,0.7)',
        border: `1px solid ${hovered ? `${accentColor}50` : `${accentColor}25`}`,
        borderRadius: '6px',
        fontFamily: 'monospace',
        position: 'relative',
        overflow: 'hidden',
        cursor: onFlyTo ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 4px 16px ${accentColor}20, 0 0 12px ${accentColor}10`
          : 'none',
        transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease',
        animation: `highlightCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s both`,
      }}
    >
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        opacity: hovered ? 0.9 : 0.6,
        transition: 'opacity 0.2s ease',
      }} />

      <div style={{
        fontSize: '7px', letterSpacing: '0.3em', color: titleColor,
        textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{title}</span>
        {/* Fly-to hint on hover */}
        {hovered && onFlyTo && (
          <span style={{
            fontSize: '7px',
            color: 'var(--text-dim)',
            letterSpacing: '0.08em',
            fontWeight: 'normal',
            animation: 'fadeIn 0.15s ease',
          }}>
            LOCATE ↗
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{
          fontSize: '14px',
          transform: hovered ? 'scale(1.15)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>{flag}</span>
        <span style={{
          fontSize: '10px', color: cls.color, fontWeight: 'bold', letterSpacing: '0.08em',
        }}>
          {cls.label.toUpperCase()}
        </span>
        <span style={{
          fontSize: '6px', color: 'var(--text-dim)',
          padding: '1px 4px', borderRadius: '2px',
          background: `${cls.color}10`, border: `1px solid ${cls.color}20`,
          letterSpacing: '0.08em',
        }}>
          {cls.code}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', fontSize: '9px', color: 'var(--text-dim)' }}>
        {event.duration != null && (
          <span style={{ color: hovered ? '#ff64ff' : undefined, transition: 'color 0.2s ease' }}>
            {event.duration}s
          </span>
        )}
        {event.volume != null && (
          <span style={{ color: hovered ? '#38f3ff' : undefined, transition: 'color 0.2s ease' }}>
            vol {event.volume}
          </span>
        )}
        {event.hasAudio && (
          <span style={{ color: '#9dff4a', fontSize: '10px' }}>♪</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '8px', opacity: 0.6 }}>
          {relativeTime(event.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default function HighlightsStrip({ events, onFlyTo }) {
  const highlights = useMemo(() => {
    if (!events || events.length < 2) return null

    const withAudio = events.filter(e => e.hasAudio)
    const latest = events[0] || null
    const loudest = [...events].sort((a, b) => (b.volume || 0) - (a.volume || 0))[0] || null
    const longest = [...events].sort((a, b) => (b.duration || 0) - (a.duration || 0))[0] || null

    // Only show if at least one has meaningful data
    if (!latest && !loudest && !longest) return null

    return { latest, loudest, longest, totalWithAudio: withAudio.length }
  }, [events])

  if (!highlights) return null

  let cardIndex = 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 14px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          fontSize: '8px',
          fontFamily: 'monospace',
          letterSpacing: '0.3em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          writingMode: 'vertical-lr',
          transform: 'rotate(180deg)',
          padding: '0 2px',
        }}>
          HIGHLIGHTS
        </div>

        {highlights.latest && highlights.latest !== highlights.loudest && highlights.latest !== highlights.longest && (
          <HighlightCard
            title="LATEST"
            titleColor="#38f3ff"
            event={highlights.latest}
            accentColor="#38f3ff"
            index={cardIndex++}
            onFlyTo={onFlyTo}
          />
        )}
        {highlights.loudest && (highlights.loudest.volume || 0) > 0 && (
          <HighlightCard
            title="LOUDEST"
            titleColor="#ff4d5a"
            event={highlights.loudest}
            accentColor="#ff4d5a"
            index={cardIndex++}
            onFlyTo={onFlyTo}
          />
        )}
        {highlights.longest && (highlights.longest.duration || 0) > 0 && (
          <HighlightCard
            title="LONGEST"
            titleColor="#ff64ff"
            event={highlights.longest}
            accentColor="#ff64ff"
            index={cardIndex++}
            onFlyTo={onFlyTo}
          />
        )}

        {highlights.totalWithAudio > 0 && (
          <div style={{
            flex: '0 0 auto',
            minWidth: '100px',
            padding: '8px 12px',
            background: 'rgba(157,255,74,0.04)',
            border: '1px solid rgba(157,255,74,0.12)',
            borderRadius: '6px',
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '3px',
            animation: `highlightCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${cardIndex * 0.08}s both`,
          }}>
            <div style={{
              fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(157,255,74,0.6)',
              textTransform: 'uppercase',
            }}>
              WITH AUDIO
            </div>
            <div style={{
              fontSize: '20px', fontWeight: 'bold', color: '#9dff4a',
              textShadow: '0 0 12px rgba(157,255,74,0.4)',
              animation: 'pulseOpacity 3s ease-in-out infinite',
            }}>
              {highlights.totalWithAudio}
            </div>
          </div>
        )}
      </div>

      {/* Right-edge fade gradient to indicate scrollable content */}
      <div style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: '40px',
        background: 'linear-gradient(90deg, transparent, rgba(6,9,13,0.9))',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
