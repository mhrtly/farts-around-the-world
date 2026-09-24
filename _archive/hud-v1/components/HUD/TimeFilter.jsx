import { useState } from 'react'

const WINDOWS = [
  { label: 'ALL', value: null },
  { label: '1H', value: 3600000 },
  { label: '6H', value: 21600000 },
  { label: '24H', value: 86400000 },
  { label: '7D', value: 604800000 },
]

export default function TimeFilter({ value, onChange }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <div style={{
      display: 'flex',
      gap: '3px',
      padding: '2px',
      background: 'rgba(56,243,255,0.02)',
      borderRadius: '5px',
      border: '1px solid rgba(56,243,255,0.06)',
    }}>
      {WINDOWS.map((tw, i) => {
        const isActive = value === tw.value
        const isHovered = hoveredIdx === i

        return (
          <button
            key={tw.label}
            onClick={() => onChange(tw.value)}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: '8px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              letterSpacing: '0.15em',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              background: isActive
                ? 'rgba(56,243,255,0.18)'
                : isHovered
                  ? 'rgba(56,243,255,0.08)'
                  : 'transparent',
              color: isActive
                ? '#38f3ff'
                : isHovered
                  ? 'rgba(56,243,255,0.7)'
                  : 'var(--text-dim)',
              boxShadow: isActive
                ? '0 0 8px rgba(56,243,255,0.2), inset 0 0 8px rgba(56,243,255,0.08)'
                : 'none',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.15s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Active indicator dot */}
            {isActive && (
              <span style={{
                position: 'absolute',
                top: '2px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: '#38f3ff',
                boxShadow: '0 0 4px #38f3ff',
              }} />
            )}
            {tw.label}
          </button>
        )
      })}
    </div>
  )
}
