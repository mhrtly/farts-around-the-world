import { useState, useRef, useEffect } from 'react'

/**
 * Collapsible section wrapper for left panel.
 * Clicking the header toggles content visibility.
 * Persists collapse state in localStorage.
 * Enhanced with smooth height animation and hover feedback.
 */
export default function PanelSection({ id, title, defaultOpen = true, children, badge = null }) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`fatwa-panel-${id}`)
    return stored !== null ? stored === 'true' : defaultOpen
  })
  const [hovered, setHovered] = useState(false)
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(0)

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    localStorage.setItem(`fatwa-panel-${id}`, String(next))
  }

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [children, isOpen])

  return (
    <div style={{
      borderRadius: '4px',
      border: `1px solid ${hovered ? 'rgba(56,243,255,0.1)' : 'rgba(56,243,255,0.04)'}`,
      background: hovered ? 'rgba(56,243,255,0.02)' : 'transparent',
      transition: 'border-color 0.2s ease, background 0.2s ease',
      overflow: 'hidden',
    }}>
      <button
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 8px',
          background: hovered ? 'rgba(56,243,255,0.04)' : 'none',
          border: 'none',
          borderBottom: isOpen ? '1px solid rgba(56,243,255,0.08)' : '1px solid transparent',
          cursor: 'pointer',
          fontFamily: 'monospace',
          transition: 'background 0.15s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Animated chevron */}
          <span style={{
            fontSize: '6px',
            color: hovered ? '#38f3ff' : 'rgba(56,243,255,0.3)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease, color 0.15s ease',
            lineHeight: 1,
            display: 'inline-block',
          }}>
            ▶
          </span>
          <span style={{
            fontSize: '8px',
            letterSpacing: '0.3em',
            color: hovered ? 'rgba(56,243,255,0.7)' : 'var(--text-dim)',
            textTransform: 'uppercase',
            transition: 'color 0.15s ease',
          }}>
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Optional badge (like count) */}
          {badge != null && (
            <span style={{
              fontSize: '8px',
              fontWeight: 'bold',
              color: '#38f3ff',
              letterSpacing: '0.05em',
              padding: '1px 5px',
              borderRadius: '3px',
              background: 'rgba(56,243,255,0.08)',
              border: '1px solid rgba(56,243,255,0.15)',
            }}>
              {badge}
            </span>
          )}
          <span style={{
            fontSize: '8px',
            color: 'rgba(56,243,255,0.3)',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            lineHeight: 1,
          }}>
            ▾
          </span>
        </div>
      </button>

      {/* Content with animated height */}
      <div style={{
        maxHeight: isOpen ? `${Math.max(contentHeight, 2000)}px` : '0',
        overflow: 'hidden',
        transition: isOpen
          ? 'max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
          : 'max-height 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: isOpen ? 1 : 0,
      }}>
        <div
          ref={contentRef}
          style={{
            padding: '8px 8px 6px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
