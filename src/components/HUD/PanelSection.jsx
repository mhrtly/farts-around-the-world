import { useState } from 'react'

/**
 * Collapsible section wrapper for left panel.
 * Clicking the header toggles content visibility.
 * Persists collapse state in localStorage.
 */
export default function PanelSection({ id, title, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`fatwa-panel-${id}`)
    return stored !== null ? stored === 'true' : defaultOpen
  })

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    localStorage.setItem(`fatwa-panel-${id}`, String(next))
  }

  return (
    <div>
      <button
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '3px 0',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(56,243,255,0.08)',
          cursor: 'pointer',
          fontFamily: 'monospace',
          marginBottom: isOpen ? '6px' : '0',
        }}
      >
        <span style={{
          fontSize: '8px',
          letterSpacing: '0.3em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '8px',
          color: 'rgba(56,243,255,0.3)',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s ease',
          lineHeight: 1,
        }}>
          ▾
        </span>
      </button>
      {isOpen && (
        <div style={{
          animation: 'fadeIn 0.15s ease',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
