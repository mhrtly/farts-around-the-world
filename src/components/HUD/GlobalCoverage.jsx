import { useMemo } from 'react'

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

export default function GlobalCoverage({ events, onCountryClick }) {
  const { activeCountries, coverageCount, coveragePct } = useMemo(() => {
    const active = new Set()
    for (const e of events) {
      if (e.country) active.add(e.country.toUpperCase())
    }
    return {
      activeCountries: active,
      coverageCount: active.size,
      coveragePct: Math.round((active.size / NATIONS.length) * 100),
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
        height: '3px',
        borderRadius: '2px',
        background: 'rgba(56,243,255,0.08)',
        marginBottom: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${coveragePct}%`,
          borderRadius: '2px',
          background: coveragePct === 100
            ? 'linear-gradient(90deg, #9dff4a, #38f3ff)'
            : 'linear-gradient(90deg, #38f3ff, #38f3ff88)',
          boxShadow: coveragePct > 0 ? '0 0 8px rgba(56,243,255,0.4)' : 'none',
          transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>

      {/* Nation grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '3px',
      }}>
        {NATIONS.map(n => {
          const isActive = activeCountries.has(n.code)
          return (
            <div
              key={n.code}
              onClick={() => isActive && onCountryClick?.(n.code)}
              title={`${n.name}${isActive ? '' : ' — No data yet'}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
                padding: '3px 2px',
                borderRadius: '3px',
                border: `1px solid ${isActive ? 'rgba(56,243,255,0.2)' : 'rgba(255,255,255,0.03)'}`,
                background: isActive
                  ? 'rgba(56,243,255,0.06)'
                  : 'rgba(255,255,255,0.01)',
                cursor: isActive ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                opacity: isActive ? 1 : 0.35,
              }}
            >
              <span style={{
                fontSize: '14px',
                filter: isActive ? 'none' : 'grayscale(1)',
                transition: 'filter 0.3s ease',
              }}>
                {n.flag}
              </span>
              <span style={{
                fontSize: '6px',
                letterSpacing: '0.1em',
                color: isActive ? '#38f3ff' : 'var(--text-dim)',
                fontWeight: isActive ? 'bold' : 'normal',
              }}>
                {n.code}
              </span>
            </div>
          )
        })}
      </div>

      {/* Full coverage celebration */}
      {coveragePct === 100 && (
        <div style={{
          marginTop: '6px',
          textAlign: 'center',
          fontSize: '8px',
          letterSpacing: '0.15em',
          color: '#9dff4a',
          fontWeight: 'bold',
          textShadow: '0 0 8px rgba(157,255,74,0.4)',
        }}>
          ★ FULL GLOBAL COVERAGE ACHIEVED ★
        </div>
      )}
    </div>
  )
}
