import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { buildTimelineBuckets } from '../../data/aggregator.js'

export default function Timeline({ events, windowSeconds = 60 }) {
  const [tick, setTick] = useState(0)
  const [hoveredBar, setHoveredBar] = useState(null)

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

  // Events per minute over the window
  const epm = useMemo(() => {
    const total = buckets.reduce((s, b) => s + b.count, 0)
    return total
  }, [buckets])

  // Peak second count
  const peakCount = useMemo(
    () => Math.max(0, ...buckets.map(b => b.count)),
    [buckets]
  )

  const handleBarEnter = useCallback((index, count) => {
    setHoveredBar({ index, count })
  }, [])

  const handleBarLeave = useCallback(() => {
    setHoveredBar(null)
  }, [])

  return (
    <section className="timeline-hud" aria-label="Event timeline, rolling 60-second window">
      <div className="timeline-hud__header">
        <span className="timeline-hud__title">EVENT FREQUENCY</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* EPM stat */}
          <span style={{
            fontSize: '8px',
            letterSpacing: '0.15em',
            color: epm > 0 ? '#38f3ff' : 'var(--text-dim)',
            fontFamily: 'monospace',
            transition: 'color 0.3s ease',
          }}>
            <span style={{
              fontWeight: 'bold',
              fontSize: '11px',
              textShadow: epm > 0 ? '0 0 6px rgba(56,243,255,0.4)' : 'none',
            }}>
              {epm}
            </span>
            {' '}EPM
          </span>
          {/* Peak indicator */}
          {peakCount > 1 && (
            <span style={{
              fontSize: '8px',
              letterSpacing: '0.12em',
              color: '#ffb020',
              fontFamily: 'monospace',
            }}>
              PEAK {peakCount}
            </span>
          )}
          <span className="timeline-hud__window">LAST {windowSeconds}s</span>
        </div>
      </div>
      <div
        className="timeline-hud__bars"
        onMouseLeave={handleBarLeave}
        style={{ position: 'relative' }}
      >
        {buckets.map((b, i) => {
          const heightPct = Math.max((b.count / maxCount) * 100, 4)
          const isLast = i === buckets.length - 1
          const isPeak = b.count === peakCount && peakCount > 0
          const isHovered = hoveredBar?.index === i
          const hasEvents = b.count > 0

          return (
            <div
              key={b.second}
              className={`timeline-hud__bar ${isPeak ? 'timeline-hud__bar--peak' : ''} ${isLast ? 'timeline-hud__bar--current' : ''}`}
              onMouseEnter={() => handleBarEnter(i, b.count)}
              style={{
                height: `${heightPct}%`,
                opacity: hasEvents ? 1 : 0.3,
                transform: isHovered ? 'scaleX(1.6)' : 'scaleX(1)',
                transition: 'height 0.15s ease-out, opacity 0.2s ease, transform 0.1s ease',
                animation: hasEvents ? `timelineBarIn 0.3s ease-out ${i * 0.008}s both` : 'none',
              }}
            />
          )
        })}

        {/* Hover tooltip */}
        {hoveredBar != null && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: `${(hoveredBar.index / buckets.length) * 100}%`,
            transform: 'translateX(-50%)',
            padding: '3px 8px',
            background: 'rgba(10,18,28,0.95)',
            border: '1px solid rgba(56,243,255,0.3)',
            borderRadius: '3px',
            fontSize: '9px',
            fontFamily: 'monospace',
            color: hoveredBar.count > 0 ? '#38f3ff' : 'var(--text-dim)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            marginBottom: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.1s ease',
          }}>
            <span style={{ fontWeight: 'bold' }}>{hoveredBar.count}</span>
            <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>
              {hoveredBar.count === 1 ? 'event' : 'events'}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
