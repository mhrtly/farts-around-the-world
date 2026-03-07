import React, { useMemo } from 'react'
import { getLeaderboard } from '../../data/aggregator.js'

const FLAG_MAP = {
  US:'\uD83C\uDDFA\uD83C\uDDF8', GB:'\uD83C\uDDEC\uD83C\uDDE7', DE:'\uD83C\uDDE9\uD83C\uDDEA',
  FR:'\uD83C\uDDEB\uD83C\uDDF7', JP:'\uD83C\uDDEF\uD83C\uDDF5', CN:'\uD83C\uDDE8\uD83C\uDDF3',
  BR:'\uD83C\uDDE7\uD83C\uDDF7', IN:'\uD83C\uDDEE\uD83C\uDDF3', AU:'\uD83C\uDDE6\uD83C\uDDFA',
  CA:'\uD83C\uDDE8\uD83C\uDDE6', MX:'\uD83C\uDDF2\uD83C\uDDFD', RU:'\uD83C\uDDF7\uD83C\uDDFA',
  NG:'\uD83C\uDDF3\uD83C\uDDEC', ZA:'\uD83C\uDDFF\uD83C\uDDE6', EG:'\uD83C\uDDEA\uD83C\uDDEC',
  AR:'\uD83C\uDDE6\uD83C\uDDF7', KR:'\uD83C\uDDF0\uD83C\uDDF7', ID:'\uD83C\uDDEE\uD83C\uDDE9',
  TR:'\uD83C\uDDF9\uD83C\uDDF7', IT:'\uD83C\uDDEE\uD83C\uDDF9',
}

export default function Leaderboard({ events, serverLeaderboard, windowMs = 60000 }) {
  // Use server leaderboard if available, fall back to client-side
  const leaderboard = useMemo(() => {
    if (serverLeaderboard && serverLeaderboard.length > 0) {
      return serverLeaderboard.slice(0, 5).map((row, i) => ({
        rank: i + 1,
        country: row.country,
        flag: FLAG_MAP[row.country] || '\uD83C\uDF0D',
        count: row.count,
      }))
    }
    return getLeaderboard(events, windowMs)
  }, [events, serverLeaderboard, windowMs])

  const leaderCount = leaderboard[0]?.count || 0

  return (
    <section className="leaderboard">
      <div className="panel-title">COUNTRY LEADERBOARD</div>

      {leaderboard.length === 0 ? (
        <div className="lb-empty">No emissions recorded today.</div>
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
