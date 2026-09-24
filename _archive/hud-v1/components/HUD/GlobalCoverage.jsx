import { useMemo, useState } from 'react'

const NATIONS = [
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'TR', flag: '🇹🇷', name: 'Turkey' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy' },
]

function NationCell({ nation, isActive, eventCount, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => isActive && onClick?.(nation.code)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${nation.name}${isActive ? ` — ${eventCount} event${eventCount !== 1 ? 's' : ''}` : ' — No data yet'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1px',
        padding: '3px 2px',
        borderRadius: '3px',
        border: `1px solid ${
          isActive && hovered
            ? 'rgba(56,243,255,0.4)'
            : isActive
              ? 'rgba(56,243,255,0.2)'
              : 'rgba(255,255,255,0.03)'
        }`,
        background: isActive && hovered
          ? 'rgba(56,243,255,0.12)'
          : isActive
            ? 'rgba(56,243,255,0.06)'
            : 'rgba(255,255,255,0.01)',
        cursor: isActive ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: isActive ? 1 : 0.3,
        transform: isActive && hovered ? 'scale(1.08)' : 'scale(1)',
        boxShadow: isActive && hovered
          ? '0 0 8px rgba(56,243,255,0.2)'
          : 'none',
        position: 'relative',
      }}
    >
      <span style={{
        fontSize: '14px',
        filter: isActive ? 'none' : 'grayscale(1)',
        transition: 'filter 0.3s ease, transform 0.2s ease',
        transform: isActive && hovered ? 'scale(1.1)' : 'scale(1)',
      }}>
        {nation.flag}
      </span>
      <span style={{
        fontSize: '6px',
        letterSpacing: '0.1em',
        color: isActive && hovered ? '#38f3ff' : isActive ? 'rgba(56,243,255,0.7)' : 'var(--text-dim)',
        fontWeight: isActive ? 'bold' : 'normal',
        transition: 'color 0.2s ease',
      }}>
        {nation.code}
      </span>
      {/* Event count badge for active nations */}
      {isActive && eventCount > 0 && hovered && (
        <span style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          fontSize: '7px',
          fontWeight: 'bold',
          color: '#06090d',
          background: '#38f3ff',
          borderRadius: '6px',
          padding: '0 3px',
          lineHeight: '13px',
          minWidth: '13px',
          textAlign: 'center',
          boxShadow: '0 0 6px rgba(56,243,255,0.5)',
          animation: 'fadeIn 0.15s ease',
        }}>
          {eventCount}
        </span>
      )}
    </div>
  )
}

export default function GlobalCoverage({ events, onCountryClick }) {
  const { activeCountries, coverageCount, coveragePct, countryCounts } = useMemo(() => {
    const active = new Set()
    const counts = {}
    for (const e of events) {
      if (e.country) {
        const code = e.country.toUpperCase()
        active.add(code)
        counts[code] = (counts[code] || 0) + 1
      }
    }
    return {
      activeCountries: active,
      coverageCount: active.size,
      coveragePct: Math.round((active.size / NATIONS.length) * 100),
      countryCounts: counts,
    }
  }, [events])

  return (
    <div style={{
      fontFamily: 'monospace',
    }}>
      {/* Header with coverage stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <span style={{
          fontSize: '8px',
          letterSpacing: '0.2em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}>
          COVERAGE
        </span>
        <span style={{
          fontSize: '9px',
          letterSpacing: '0.1em',
          color: coverageCount > 0 ? '#38f3ff' : 'var(--text-dim)',
          fontWeight: 'bold',
        }}>
          {coverageCount}/{NATIONS.length}
          <span style={{
            fontSize: '7px',
            color: 'var(--text-dim)',
            marginLeft: '4px',
            fontWeight: 'normal',
          }}>
            ({coveragePct}%)
          </span>
        </span>
      </div>

      {/* Coverage progress bar */}
      <div style={{
        height: '4px',
        borderRadius: '2px',
        background: 'rgba(56,243,255,0.08)',
        marginBottom: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${coveragePct}%`,
          borderRadius: '2px',
          background: coveragePct === 100
            ? 'linear-gradient(90deg, #9dff4a, #38f3ff, #ff64ff)'
            : coveragePct >= 75
              ? 'linear-gradient(90deg, #38f3ff, #9dff4a)'
              : 'linear-gradient(90deg, #38f3ff, #38f3ff88)',
          boxShadow: coveragePct === 100
            ? '0 0 12px rgba(157,255,74,0.5), 0 0 4px rgba(56,243,255,0.4)'
            : coveragePct > 0
              ? '0 0 8px rgba(56,243,255,0.4)'
              : 'none',
          transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>

      {/* Nation grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '3px',
      }}>
        {NATIONS.map(n => (
          <NationCell
            key={n.code}
            nation={n}
            isActive={activeCountries.has(n.code)}
            eventCount={countryCounts[n.code] || 0}
            onClick={onCountryClick}
          />
        ))}
      </div>

      {/* Full coverage celebration */}
      {coveragePct === 100 && (
        <div style={{
          marginTop: '8px',
          textAlign: 'center',
          padding: '6px 8px',
          borderRadius: '4px',
          background: 'linear-gradient(90deg, rgba(157,255,74,0.08), rgba(56,243,255,0.08), rgba(255,100,255,0.08))',
          border: '1px solid rgba(157,255,74,0.2)',
        }}>
          <div style={{
            fontSize: '9px',
            letterSpacing: '0.2em',
            color: '#9dff4a',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(157,255,74,0.5)',
            animation: 'pulseOpacity 2s ease-in-out infinite',
          }}>
            ★ FULL GLOBAL COVERAGE ★
          </div>
          <div style={{
            fontSize: '7px',
            color: 'var(--text-dim)',
            letterSpacing: '0.1em',
            marginTop: '2px',
          }}>
            ALL {NATIONS.length} NATIONS REPORTING
          </div>
        </div>
      )}
    </div>
  )
}
