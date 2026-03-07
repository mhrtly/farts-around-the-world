import { useMemo } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA',
  FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5', CN:'\uD83C\uDDE8\uD83C\uDDF3',
  BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA',
  CA:'\uD83C\uDDE8\uD83C\uDDE6', MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA',
  NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
  AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9',
  TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function HighlightCard({ title, titleColor, event, accentColor, index = 0 }) {
  if (!event) return null
  const cls = classifyEmission(event.duration, event.volume)
  const flag = FLAG_MAP[event.country] || '\uD83C\uDF0D'

  return (
    <div style={{
      flex: '0 0 auto',
      minWidth: '180px',
      maxWidth: '220px',
      padding: '8px 12px',
      background: 'rgba(10,18,28,0.7)',
      border: `1px solid ${accentColor}25`,
      borderRadius: '6px',
      fontFamily: 'monospace',
      position: 'relative',
      overflow: 'hidden',
      animation: `highlightCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s both`,
    }}>
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        opacity: 0.6,
      }} />

      <div style={{
        fontSize: '7px', letterSpacing: '0.3em', color: titleColor,
        textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold',
      }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{ fontSize: '14px' }}>{flag}</span>
        <span style={{
          fontSize: '10px', color: cls.color, fontWeight: 'bold', letterSpacing: '0.08em',
        }}>
          {cls.label.toUpperCase()}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', fontSize: '9px', color: 'var(--text-dim)' }}>
        {event.duration != null && (
          <span>{event.duration}s</span>
        )}
        {event.volume != null && (
          <span>vol {event.volume}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '8px', opacity: 0.6 }}>
          {relativeTime(event.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default function HighlightsStrip({ events }) {
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
          />
        )}
        {highlights.loudest && (highlights.loudest.volume || 0) > 0 && (
          <HighlightCard
            title="LOUDEST"
            titleColor="#ff4d5a"
            event={highlights.loudest}
            accentColor="#ff4d5a"
            index={cardIndex++}
          />
        )}
        {highlights.longest && (highlights.longest.duration || 0) > 0 && (
          <HighlightCard
            title="LONGEST"
            titleColor="#ff64ff"
            event={highlights.longest}
            accentColor="#ff64ff"
            index={cardIndex++}
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
