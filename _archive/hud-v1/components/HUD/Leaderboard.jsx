import React, { useMemo, useState, useRef, useEffect } from 'react'
import { getLeaderboard } from '../../data/aggregator.js'

const FLAG_MAP = {
  US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪',
  FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
  BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺',
  CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
  NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬',
  AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
  TR:'🇹🇷', IT:'🇮🇹',
}

const RANK_COLORS = {
  1: { accent: '#ffd700', glow: 'rgba(255,215,0,0.35)', badge: '★', label: 'GOLD' },
  2: { accent: '#c0c0c0', glow: 'rgba(192,192,192,0.25)', badge: '☆', label: 'SILVER' },
  3: { accent: '#cd7f32', glow: 'rgba(205,127,50,0.25)', badge: '◆', label: 'BRONZE' },
}

export default function Leaderboard({ events, serverLeaderboard, windowMs = 60000, onCountryClick }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const prevOrderRef = useRef([])

  // Use server leaderboard if available, fall back to client-side
  const leaderboard = useMemo(() => {
    if (serverLeaderboard && serverLeaderboard.length > 0) {
      return serverLeaderboard.slice(0, 5).map((row, i) => ({
        rank: i + 1,
        country: row.country,
        flag: FLAG_MAP[row.country] || '🌍',
        count: row.count,
      }))
    }
    return getLeaderboard(events, windowMs)
  }, [events, serverLeaderboard, windowMs])

  // Calculate total for percentage
  const totalEvents = useMemo(() => leaderboard.reduce((s, e) => s + e.count, 0), [leaderboard])
  const leaderCount = leaderboard[0]?.count || 0

  // Track rank changes for trend arrows
  const trends = useMemo(() => {
    const prev = prevOrderRef.current
    const trendMap = {}
    for (const entry of leaderboard) {
      const prevIdx = prev.indexOf(entry.country)
      if (prevIdx === -1) {
        trendMap[entry.country] = 'new'
      } else if (prevIdx > entry.rank - 1) {
        trendMap[entry.country] = 'up'
      } else if (prevIdx < entry.rank - 1) {
        trendMap[entry.country] = 'down'
      } else {
        trendMap[entry.country] = 'same'
      }
    }
    return trendMap
  }, [leaderboard])

  // Update previous order after render
  useEffect(() => {
    prevOrderRef.current = leaderboard.map(e => e.country)
  }, [leaderboard])

  return (
    <section className="leaderboard">
      {leaderboard.length === 0 ? (
        <div className="lb-empty" style={{ textAlign: 'center', padding: '12px 4px' }}>
          <div style={{ fontSize: '18px', marginBottom: '6px', opacity: 0.4 }}>🌍</div>
          <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-dim)' }}>
            Awaiting global data
          </div>
        </div>
      ) : (
        leaderboard.map((entry, index) => {
          const width = leaderCount > 0 ? `${(entry.count / leaderCount) * 100}%` : '0%'
          const baseOpacity = Math.max(0.28, 1 - index * 0.16)
          const isHovered = hoveredIdx === index
          const rankStyle = RANK_COLORS[entry.rank]
          const pct = totalEvents > 0 ? Math.round((entry.count / totalEvents) * 100) : 0
          const trend = trends[entry.country]

          return (
            <div
              className={`lb-row ${rankStyle ? `lb-row--rank${entry.rank}` : ''}`}
              key={`${entry.country}-${entry.rank}`}
              onClick={() => onCountryClick?.(entry.country)}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                cursor: onCountryClick ? 'pointer' : 'default',
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                borderColor: isHovered && rankStyle
                  ? `${rankStyle.accent}60`
                  : isHovered
                    ? 'rgba(56,243,255,0.4)'
                    : undefined,
                boxShadow: isHovered && rankStyle
                  ? `0 0 16px ${rankStyle.glow}, inset 0 0 8px ${rankStyle.glow}`
                  : isHovered
                    ? '0 0 16px rgba(56,243,255,0.15), inset 0 0 8px rgba(56,243,255,0.05)'
                    : undefined,
                animation: `lbSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.06}s both`,
              }}
              title={`View ${entry.country} dossier`}
            >
              <div className="lb-bar" style={{ width, opacity: baseOpacity }} />

              {/* Rank badge */}
              <div className="lb-rank" style={{
                color: rankStyle ? rankStyle.accent : undefined,
                textShadow: rankStyle ? `0 0 8px ${rankStyle.glow}` : undefined,
                fontWeight: rankStyle ? 'bold' : undefined,
              }}>
                {rankStyle ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                    <span style={{ fontSize: '8px', opacity: 0.7 }}>{rankStyle.badge}</span>
                    <span>{entry.rank}</span>
                  </span>
                ) : (
                  `#${entry.rank}`
                )}
              </div>

              <span className="lb-flag" aria-hidden="true" style={{
                transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}>{entry.flag}</span>

              <span className="lb-country" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {entry.country}
                {/* Trend arrow */}
                {trend === 'up' && (
                  <span style={{ fontSize: '7px', color: '#9dff4a', lineHeight: 1 }}>▲</span>
                )}
                {trend === 'down' && (
                  <span style={{ fontSize: '7px', color: '#ff4d5a', lineHeight: 1 }}>▼</span>
                )}
                {trend === 'new' && (
                  <span style={{
                    fontSize: '6px', color: '#ffb020', letterSpacing: '0.1em',
                    padding: '0 3px', background: 'rgba(255,176,32,0.12)',
                    borderRadius: '2px', lineHeight: '12px',
                  }}>NEW</span>
                )}
              </span>

              <span className="lb-count" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span>{entry.count}</span>
                {/* Percentage share */}
                {pct > 0 && (
                  <span style={{
                    fontSize: '7px',
                    color: 'var(--text-dim)',
                    letterSpacing: '0.06em',
                    fontWeight: 'normal',
                  }}>
                    {pct}%
                  </span>
                )}
              </span>
            </div>
          )
        })
      )}
    </section>
  )
}
