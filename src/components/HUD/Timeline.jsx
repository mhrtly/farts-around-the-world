import React, { useEffect, useMemo, useState } from 'react'
import { buildTimelineBuckets } from '../../data/aggregator.js'

export default function Timeline({ events, windowSeconds = 60 }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const buckets = useMemo(
    () => buildTimelineBuckets(events, windowSeconds),
    [events, windowSeconds, tick]
  )

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map(b => b.count)),
    [buckets]
  )

  return (
    <section className="timeline-hud" aria-label="Event timeline, rolling 60-second window">
      <div className="timeline-hud__header">
        <span className="timeline-hud__title">EVENT FREQUENCY</span>
        <span className="timeline-hud__window">LAST {windowSeconds}s</span>
      </div>
      <div className="timeline-hud__bars">
        {buckets.map(b => (
          <div
            key={b.second}
            className="timeline-hud__bar"
            style={{ height: `${Math.max((b.count / maxCount) * 100, 4)}%` }}
            title={`${b.count} events`}
          />
        ))}
      </div>
    </section>
  )
}
