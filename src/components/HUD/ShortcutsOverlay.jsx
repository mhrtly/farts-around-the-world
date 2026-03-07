import { useEffect } from 'react'

const SHORTCUTS = [
  { keys: ['R'], label: 'Record a fart', category: 'ACTIONS' },
  { keys: ['B'], label: 'Browse & rate emissions', category: 'ACTIONS' },
  { keys: ['T'], label: 'Spotlight tour', category: 'ACTIONS' },
  { keys: ['\u2318', 'K'], label: 'Command Palette', category: 'NAVIGATION', alt: ['Ctrl', 'K'] },
  { keys: ['/'], label: 'Command Palette (alt)', category: 'NAVIGATION' },
  { keys: ['?'], label: 'Show this help', category: 'NAVIGATION' },
  { keys: ['Esc'], label: 'Close panel / dismiss', category: 'GENERAL' },
]

const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')

export default function ShortcutsOverlay({ onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Group by category
  const categories = []
  let currentCat = null
  for (const s of SHORTCUTS) {
    if (s.category !== currentCat) {
      currentCat = s.category
      categories.push({ name: currentCat, items: [] })
    }
    categories[categories.length - 1].items.push(s)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(6,9,13,0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '380px', maxWidth: '90vw',
          background: 'rgba(10,18,28,0.96)',
          border: '1px solid rgba(56,243,255,0.2)',
          borderRadius: '10px',
          boxShadow: '0 0 60px rgba(56,243,255,0.1), 0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'cmdPaletteIn 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(56,243,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.25em',
              color: '#38f3ff', fontFamily: 'monospace', textTransform: 'uppercase',
            }}>
              Keyboard Shortcuts
            </div>
            <div style={{
              fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em',
              fontFamily: 'monospace', marginTop: '2px',
            }}>
              FATWA OPERATOR QUICK REFERENCE
            </div>
          </div>
          <span style={{
            fontSize: '9px', letterSpacing: '0.1em',
            padding: '3px 8px', borderRadius: '3px',
            background: 'rgba(56,243,255,0.08)',
            border: '1px solid rgba(56,243,255,0.2)',
            color: 'rgba(56,243,255,0.5)',
            fontFamily: 'monospace',
            cursor: 'pointer',
          }} onClick={onClose}>
            ESC
          </span>
        </div>

        {/* Shortcuts list */}
        <div style={{ padding: '8px 0' }}>
          {categories.map(cat => (
            <div key={cat.name}>
              <div style={{
                padding: '8px 20px 4px',
                fontSize: '8px', letterSpacing: '0.35em',
                color: 'var(--text-dim)', fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}>
                {cat.name}
              </div>
              {cat.items.map((shortcut, i) => {
                const keys = (!isMac && shortcut.alt) ? shortcut.alt : shortcut.keys
                return (
                  <div key={i} style={{
                    padding: '7px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                      {shortcut.label}
                    </span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {keys.map((key, ki) => (
                        <span key={ki}>
                          {ki > 0 && <span style={{ color: 'var(--text-dim)', fontSize: '10px', margin: '0 2px' }}>+</span>}
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(56,243,255,0.08)',
                            border: '1px solid rgba(56,243,255,0.2)',
                            color: '#38f3ff',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            letterSpacing: '0.05em',
                            minWidth: '28px',
                            textAlign: 'center',
                          }}>
                            {key}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid rgba(56,243,255,0.06)',
          fontSize: '9px',
          fontFamily: 'monospace',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}>
          Press <span style={{ color: 'rgba(56,243,255,0.4)' }}>?</span> to toggle this panel
        </div>
      </div>
    </div>
  )
}
