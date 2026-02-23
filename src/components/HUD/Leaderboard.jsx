import React, { useMemo } from 'react'
import { getLeaderboard } from '../../data/aggregator.js'

export default function Leaderboard({ events, windowMs = 60000 }) {
  const leaderboard = useMemo(
    () => getLeaderboard(events, windowMs),
    [events, windowMs]
  )
  const leaderCount = leaderboard[0]?.count || 0

  return (
    <section className="leaderboard">
      <div className="panel-title">COUNTRY LEADERBOARD</div>

      {leaderboard.length === 0 ? (
        <div className="lb-empty">No events in rolling window.</div>
      ) : (
        leaderboard.map((entry, index) => {
          const width = leaderCount > 0 ? `${(entry.count / leaderCount) * 100}%` : '0%'
          const opacity = Math.max(0.28, 1 - index * 0.16)

          return (
            <div className="lb-row" key={`${entry.country}-${entry.rank}`}>
              <div className="lb-bar" style={{ width, opacity }} />
              <div className="lb-rank">#{entry.rank}</div>
              <span className="lb-flag" aria-hidden="true">{entry.flag}</span>
              <span className="lb-country">{entry.country}</span>
              <span className="lb-count">{entry.count}</span>
            </div>
          )
        })
      )}
    </section>
  )
}
