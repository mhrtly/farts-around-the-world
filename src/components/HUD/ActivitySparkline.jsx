import { useMemo, useEffect, useState } from 'react'

export default function ActivitySparkline({ events, minutes = 30, width = 120, height = 28 }) {
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
  const barWidth = width / buckets.length
  const padding = 1

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
          opacity={0.3}
        />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#38f3ff"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        {/* Dots for buckets with events */}
        {points.map((p, i) => buckets[i] > 0 && (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={buckets[i] === maxCount ? 2.5 : 1.5}
            fill="#38f3ff"
            opacity={buckets[i] === maxCount ? 1 : 0.6}
          />
        ))}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38f3ff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#38f3ff" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
