import { useMemo, useEffect, useState } from 'react'

export default function ActivitySparkline({ events, minutes = 30, width = 160, height = 24 }) {
  const [tick, setTick] = useState(0)

  // Tick every 5 seconds to keep sparkline current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const buckets = useMemo(() => {
    const now = Date.now()
    const bucketCount = Math.min(minutes, 30) // Max 30 buckets
    const bucketMs = (minutes * 60 * 1000) / bucketCount
    const result = new Array(bucketCount).fill(0)

    for (const e of events) {
      const age = now - e.timestamp
      if (age < 0 || age >= minutes * 60 * 1000) continue
      const idx = Math.floor(age / bucketMs)
      if (idx >= 0 && idx < bucketCount) {
        result[bucketCount - 1 - idx]++
      }
    }

    return result
  }, [events, minutes, tick])

  const maxCount = Math.max(1, ...buckets)
  const totalInWindow = buckets.reduce((s, b) => s + b, 0)
  const barWidth = width / buckets.length

  // Build SVG path for smooth line
  const points = buckets.map((count, i) => ({
    x: i * barWidth + barWidth / 2,
    y: height - (count / maxCount) * (height - 4) - 2,
  }))

  const linePath = points.map((p, i) =>
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ')

  const areaPath = linePath +
    ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  // Last point for live dot
  const lastPoint = points[points.length - 1]
  const lastBucketHasEvents = buckets[buckets.length - 1] > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <span style={{
        fontSize: '7px',
        letterSpacing: '0.15em',
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        writingMode: 'vertical-lr',
        transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
      }}>
        {minutes}M
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#sparkGrad)"
          opacity={0.35}
        />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#38f3ff"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        {/* Dots for buckets with events */}
        {points.map((p, i) => buckets[i] > 0 && i < points.length - 1 && (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={buckets[i] === maxCount ? 2.5 : 1.5}
            fill="#38f3ff"
            opacity={buckets[i] === maxCount ? 1 : 0.5}
          />
        ))}
        {/* Peak dot — glow */}
        {points.map((p, i) => buckets[i] === maxCount && maxCount > 1 && (
          <circle
            key={`peak-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="none"
            stroke="#ffb020"
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}
        {/* Live dot — pulsing on the last point */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={lastBucketHasEvents ? 3 : 2}
          fill={lastBucketHasEvents ? '#9dff4a' : '#38f3ff'}
          opacity={0.9}
        >
          <animate
            attributeName="r"
            values={lastBucketHasEvents ? '2.5;4;2.5' : '1.5;2.5;1.5'}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.9;0.4;0.9"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        {/* Live dot outer ring */}
        {lastBucketHasEvents && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={5}
            fill="none"
            stroke="#9dff4a"
            strokeWidth={0.5}
            opacity={0.3}
          >
            <animate
              attributeName="r"
              values="4;7;4"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38f3ff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#38f3ff" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      {/* Event count in window */}
      <span style={{
        fontSize: '10px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        color: totalInWindow > 0 ? '#38f3ff' : 'var(--text-dim)',
        textShadow: totalInWindow > 0 ? '0 0 6px rgba(56,243,255,0.3)' : 'none',
        minWidth: '18px',
        textAlign: 'right',
        transition: 'color 0.3s ease',
      }}>
        {totalInWindow}
      </span>
    </div>
  )
}
