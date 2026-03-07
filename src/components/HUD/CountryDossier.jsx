import { useMemo } from 'react'
import { classifyEmission } from '../../config/humor.ts'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

const COUNTRY_NAMES = {
  US:'United States', GB:'United Kingdom', DE:'Germany', FR:'France',
  JP:'Japan', CN:'China', BR:'Brazil', IN:'India', AU:'Australia',
  CA:'Canada', MX:'Mexico', RU:'Russia', NG:'Nigeria', ZA:'South Africa',
  EG:'Egypt', AR:'Argentina', KR:'South Korea', ID:'Indonesia',
  TR:'Turkey', IT:'Italy',
}

function relativeTime(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function StatRow({ label, value, color = '#38f3ff', bar = null }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0',
      borderBottom: '1px solid rgba(56,243,255,0.06)',
      fontFamily: 'monospace',
    }}>
      <span style={{
        fontSize: '8px',
        letterSpacing: '0.15em',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        width: '90px',
        flexShrink: 0,
      }}>
        {label}
      </span>
      {bar != null && (
        <div style={{
          flex: 1,
          height: '4px',
          background: 'rgba(56,243,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(100, bar)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: '2px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}
      <span style={{
        fontSize: '12px',
        fontWeight: 'bold',
        color,
        textShadow: `0 0 8px ${color}44`,
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  )
}

export default function CountryDossier({ countryCode, events, allEvents, onClose, onFlyTo }) {
  const data = useMemo(() => {
    if (!countryCode || !events) return null

    const countryEvents = events.filter(e => e.country === countryCode)
    const allCountryEvents = (allEvents || events).filter(e => e.country === countryCode)
    const total = countryEvents.length
    const totalAll = allCountryEvents.length
    const withAudio = countryEvents.filter(e => e.hasAudio)
    const withDuration = countryEvents.filter(e => e.duration != null && e.duration > 0)
    const withVolume = countryEvents.filter(e => e.volume != null && e.volume > 0)

    const avgDuration = withDuration.length > 0
      ? (withDuration.reduce((s, e) => s + e.duration, 0) / withDuration.length).toFixed(1)
      : null
    const maxDuration = withDuration.length > 0
      ? Math.max(...withDuration.map(e => e.duration)).toFixed(1)
      : null
    const avgVolume = withVolume.length > 0
      ? Math.round(withVolume.reduce((s, e) => s + e.volume, 0) / withVolume.length)
      : null
    const maxVolume = withVolume.length > 0
      ? Math.round(Math.max(...withVolume.map(e => e.volume)))
      : null

    // Rank among all countries
    const countryCounts = new Map()
    for (const e of events) {
      countryCounts.set(e.country, (countryCounts.get(e.country) || 0) + 1)
    }
    const sorted = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])
    const rank = sorted.findIndex(([c]) => c === countryCode) + 1
    const totalCountries = sorted.length
    const globalShare = events.length > 0
      ? ((total / events.length) * 100).toFixed(1)
      : '0'

    // Recent events (last 5)
    const recent = countryEvents.slice(0, 5)

    // Dominant classification
    const classMap = new Map()
    for (const e of countryEvents) {
      const cls = classifyEmission(e.duration, e.volume)
      classMap.set(cls.label, (classMap.get(cls.label) || 0) + 1)
    }
    const dominantClass = [...classMap.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      total, totalAll, rank, totalCountries, globalShare,
      audioCount: withAudio.length,
      avgDuration, maxDuration, avgVolume, maxVolume,
      recent, dominantClass,
    }
  }, [countryCode, events, allEvents])

  if (!data) return null

  const flag = FLAG_MAP[countryCode] || '🌍'
  const name = COUNTRY_NAMES[countryCode] || countryCode

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,9,13,0.75)',
        backdropFilter: 'blur(8px)',
        animation: 'cmdPaletteIn 0.2s ease-out',
      }}
    >
      <div style={{
        width: '440px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        overflowY: 'auto',
        background: 'rgba(10,18,28,0.95)',
        border: '1px solid rgba(56,243,255,0.15)',
        borderRadius: '12px',
        fontFamily: 'monospace',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(56,243,255,0.1)',
          position: 'relative',
        }}>
          {/* Accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, #38f3ff, #ff64ff, transparent)',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '36px' }}>{flag}</span>
            <div>
              <div style={{
                fontSize: '18px', fontWeight: 'bold', color: '#fff',
                letterSpacing: '0.05em',
              }}>
                {name}
              </div>
              <div style={{
                fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-dim)',
                textTransform: 'uppercase', marginTop: '2px',
              }}>
                TERRITORY DOSSIER · {countryCode}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{
                fontSize: '24px', fontWeight: 'bold', color: '#38f3ff',
                textShadow: '0 0 12px rgba(56,243,255,0.4)',
              }}>
                #{data.rank}
              </div>
              <div style={{
                fontSize: '8px', letterSpacing: '0.15em', color: 'var(--text-dim)',
              }}>
                OF {data.totalCountries}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'none', border: 'none', color: 'var(--text-dim)',
              fontSize: '18px', cursor: 'pointer', padding: '4px 8px',
              fontFamily: 'monospace',
            }}
          >
            ×
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{
            fontSize: '7px', letterSpacing: '0.3em', color: 'var(--text-dim)',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            EMISSION STATISTICS
          </div>

          <StatRow
            label="TOTAL"
            value={data.total}
            color="#38f3ff"
            bar={data.totalCountries > 0 ? (data.total / (data.total || 1)) * 100 : 0}
          />
          <StatRow
            label="ALL TIME"
            value={data.totalAll}
            color="#38f3ff"
          />
          <StatRow
            label="GLOBAL SHARE"
            value={`${data.globalShare}%`}
            color="#9dff4a"
            bar={parseFloat(data.globalShare)}
          />
          <StatRow
            label="WITH AUDIO"
            value={data.audioCount}
            color="#ff64ff"
            bar={data.total > 0 ? (data.audioCount / data.total) * 100 : 0}
          />

          {data.avgDuration != null && (
            <StatRow
              label="AVG DURATION"
              value={`${data.avgDuration}s`}
              color="#ffb020"
              bar={Math.min(100, (parseFloat(data.avgDuration) / 10) * 100)}
            />
          )}
          {data.maxDuration != null && (
            <StatRow
              label="PEAK DURATION"
              value={`${data.maxDuration}s`}
              color="#ff4d5a"
            />
          )}
          {data.avgVolume != null && (
            <StatRow
              label="AVG VOLUME"
              value={data.avgVolume}
              color="#ffb020"
              bar={data.avgVolume}
            />
          )}
          {data.maxVolume != null && (
            <StatRow
              label="PEAK VOLUME"
              value={data.maxVolume}
              color="#ff4d5a"
            />
          )}

          {/* Dominant Classification */}
          {data.dominantClass && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'rgba(56,243,255,0.04)',
              border: '1px solid rgba(56,243,255,0.08)',
              borderRadius: '6px',
            }}>
              <div style={{
                fontSize: '7px', letterSpacing: '0.3em', color: 'var(--text-dim)',
                textTransform: 'uppercase', marginBottom: '4px',
              }}>
                DOMINANT CLASSIFICATION
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: 'bold',
                  color: classifyEmission(null, null).color,
                }}>
                  {data.dominantClass[0]}
                </span>
                <span style={{
                  fontSize: '9px', color: 'var(--text-dim)',
                }}>
                  × {data.dominantClass[1]}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{
            fontSize: '7px', letterSpacing: '0.3em', color: 'var(--text-dim)',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            RECENT INTERCEPTS
          </div>

          {data.recent.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '16px',
              fontSize: '9px', color: 'var(--text-dim)',
              letterSpacing: '0.1em',
            }}>
              No emissions in current window
            </div>
          ) : (
            data.recent.map((event, i) => {
              const cls = classifyEmission(event.duration, event.volume)
              return (
                <div
                  key={event.id || i}
                  onClick={() => onFlyTo?.({ lat: event.lat, lng: event.lng, altitude: 1.2 })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    borderBottom: '1px solid rgba(56,243,255,0.04)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,243,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    fontSize: '10px', fontWeight: 'bold',
                    color: cls.color,
                    width: '80px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cls.label}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                    {cls.code}
                  </span>
                  <div style={{
                    display: 'flex', gap: '6px', fontSize: '9px',
                    color: 'var(--text-dim)', marginLeft: 'auto', flexShrink: 0,
                  }}>
                    {event.duration != null && <span>{event.duration}s</span>}
                    {event.volume != null && <span>vol {event.volume}</span>}
                    {event.hasAudio && <span style={{ color: '#9dff4a' }}>♪</span>}
                    <span style={{ fontSize: '8px', opacity: 0.5 }}>
                      {relativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 24px 16px',
          borderTop: '1px solid rgba(56,243,255,0.08)',
          display: 'flex',
          gap: '8px',
        }}>
          <button
            onClick={() => onFlyTo?.({ lat: data.recent[0]?.lat, lng: data.recent[0]?.lng, altitude: 1.4 })}
            disabled={data.recent.length === 0}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '9px',
              fontWeight: 'bold',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: data.recent.length > 0 ? 'rgba(56,243,255,0.08)' : 'rgba(56,243,255,0.02)',
              border: '1px solid rgba(56,243,255,0.2)',
              borderRadius: '4px',
              color: data.recent.length > 0 ? '#38f3ff' : 'var(--text-dim)',
              cursor: data.recent.length > 0 ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
          >
            🌍 Fly to Territory
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '9px',
              fontWeight: 'bold',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Close Dossier
          </button>
        </div>

        {/* Esc hint */}
        <div style={{
          textAlign: 'center',
          padding: '0 0 12px',
          fontSize: '8px',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.1em',
        }}>
          ESC to close
        </div>
      </div>
    </div>
  )
}
