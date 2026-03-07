import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ── Country data ────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '\uD83C\uDDFA\uD83C\uDDF8', lat: 39.8, lng: -98.5 },
  { code: 'GB', name: 'United Kingdom', flag: '\uD83C\uDDEC\uD83C\uDDE7', lat: 54.0, lng: -2.0 },
  { code: 'DE', name: 'Germany', flag: '\uD83C\uDDE9\uD83C\uDDEA', lat: 51.2, lng: 10.4 },
  { code: 'FR', name: 'France', flag: '\uD83C\uDDEB\uD83C\uDDF7', lat: 46.2, lng: 2.2 },
  { code: 'JP', name: 'Japan', flag: '\uD83C\uDDEF\uD83C\uDDF5', lat: 36.2, lng: 138.3 },
  { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', lat: 35.9, lng: 104.2 },
  { code: 'BR', name: 'Brazil', flag: '\uD83C\uDDE7\uD83C\uDDF7', lat: -14.2, lng: -51.9 },
  { code: 'IN', name: 'India', flag: '\uD83C\uDDEE\uD83C\uDDF3', lat: 20.6, lng: 79.0 },
  { code: 'AU', name: 'Australia', flag: '\uD83C\uDDE6\uD83C\uDDFA', lat: -25.3, lng: 133.8 },
  { code: 'CA', name: 'Canada', flag: '\uD83C\uDDE8\uD83C\uDDE6', lat: 56.1, lng: -106.3 },
  { code: 'MX', name: 'Mexico', flag: '\uD83C\uDDF2\uD83C\uDDFD', lat: 23.6, lng: -102.6 },
  { code: 'RU', name: 'Russia', flag: '\uD83C\uDDF7\uD83C\uDDFA', lat: 61.5, lng: 105.3 },
  { code: 'NG', name: 'Nigeria', flag: '\uD83C\uDDF3\uD83C\uDDEC', lat: 9.1, lng: 8.7 },
  { code: 'ZA', name: 'South Africa', flag: '\uD83C\uDDFF\uD83C\uDDE6', lat: -30.6, lng: 22.9 },
  { code: 'EG', name: 'Egypt', flag: '\uD83C\uDDEA\uD83C\uDDEC', lat: 26.8, lng: 30.8 },
  { code: 'AR', name: 'Argentina', flag: '\uD83C\uDDE6\uD83C\uDDF7', lat: -38.4, lng: -63.6 },
  { code: 'KR', name: 'South Korea', flag: '\uD83C\uDDF0\uD83C\uDDF7', lat: 35.9, lng: 127.8 },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9', lat: -0.8, lng: 113.9 },
  { code: 'TR', name: 'Turkey', flag: '\uD83C\uDDF9\uD83C\uDDF7', lat: 38.9, lng: 35.2 },
  { code: 'IT', name: 'Italy', flag: '\uD83C\uDDEE\uD83C\uDDF9', lat: 41.9, lng: 12.6 },
]

// ── Region presets ──────────────────────────────────────────────────────────
const REGIONS = [
  { name: 'Global',        icon: '\uD83C\uDF0D', lat: 20, lng: 0, altitude: 2.5 },
  { name: 'North America', icon: '\uD83C\uDF0E', lat: 40, lng: -100, altitude: 1.6 },
  { name: 'South America', icon: '\uD83C\uDF0E', lat: -15, lng: -55, altitude: 1.6 },
  { name: 'Europe',        icon: '\uD83C\uDF0D', lat: 50, lng: 10, altitude: 1.4 },
  { name: 'Africa',        icon: '\uD83C\uDF0D', lat: 5, lng: 20, altitude: 1.6 },
  { name: 'Asia',          icon: '\uD83C\uDF0F', lat: 35, lng: 100, altitude: 1.6 },
  { name: 'Oceania',       icon: '\uD83C\uDF0F', lat: -25, lng: 140, altitude: 1.8 },
  { name: 'Middle East',   icon: '\uD83C\uDF0D', lat: 28, lng: 45, altitude: 1.4 },
]

// ── Build command list ──────────────────────────────────────────────────────
function buildCommands({ onAction }) {
  const commands = []

  // Actions
  commands.push({
    id: 'record', category: 'ACTIONS', icon: '\uD83C\uDFA4',
    label: 'Record a Fart', hint: 'R',
    action: () => onAction('modal', 'record'),
  })
  commands.push({
    id: 'browse', category: 'ACTIONS', icon: '\uD83D\uDCA8',
    label: 'Rate Emissions', hint: 'B',
    action: () => onAction('modal', 'browse'),
  })
  commands.push({
    id: 'tour', category: 'ACTIONS', icon: '\uD83D\uDD2D',
    label: 'Spotlight Tour', hint: 'T',
    action: () => onAction('tour'),
  })

  // Regions
  for (const region of REGIONS) {
    commands.push({
      id: `region-${region.name}`, category: 'REGIONS', icon: region.icon,
      label: region.name,
      action: () => onAction('flyTo', { lat: region.lat, lng: region.lng, altitude: region.altitude }),
    })
  }

  // Countries
  for (const country of COUNTRIES) {
    commands.push({
      id: `country-${country.code}`, category: 'COUNTRIES', icon: country.flag,
      label: country.name, hint: country.code,
      action: () => onAction('flyTo', { lat: country.lat, lng: country.lng, altitude: 1.6 }),
    })
  }

  // Time windows
  commands.push({
    id: 'time-1h', category: 'TIME WINDOW', icon: '\u23F1',
    label: 'Last Hour', action: () => onAction('timeWindow', 3600000),
  })
  commands.push({
    id: 'time-6h', category: 'TIME WINDOW', icon: '\u23F1',
    label: 'Last 6 Hours', action: () => onAction('timeWindow', 21600000),
  })
  commands.push({
    id: 'time-24h', category: 'TIME WINDOW', icon: '\u23F1',
    label: 'Last 24 Hours', action: () => onAction('timeWindow', 86400000),
  })
  commands.push({
    id: 'time-7d', category: 'TIME WINDOW', icon: '\u23F1',
    label: 'Last 7 Days', action: () => onAction('timeWindow', 604800000),
  })
  commands.push({
    id: 'time-all', category: 'TIME WINDOW', icon: '\u23F1',
    label: 'All Time', action: () => onAction('timeWindow', null),
  })

  return commands
}

// ── Fuzzy match ─────────────────────────────────────────────────────────────
function fuzzyMatch(query, text) {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  // Simple substring + starts-with scoring
  if (t.startsWith(q)) return 2
  if (t.includes(q)) return 1
  // Character-by-character fuzzy
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length ? 0.5 : false
}

// ── Component ───────────────────────────────────────────────────────────────
export default function CommandPalette({ onClose, onAction }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const allCommands = useMemo(() => buildCommands({ onAction }), [onAction])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    return allCommands
      .map(cmd => {
        const labelScore = fuzzyMatch(query, cmd.label)
        const hintScore = cmd.hint ? fuzzyMatch(query, cmd.hint) : false
        const catScore = fuzzyMatch(query, cmd.category)
        const score = Math.max(labelScore || 0, hintScore || 0, catScore || 0)
        return { ...cmd, _score: score }
      })
      .filter(cmd => cmd._score > 0)
      .sort((a, b) => b._score - a._score)
  }, [query, allCommands])

  // Group by category
  const grouped = useMemo(() => {
    const groups = []
    let currentCat = null
    for (const cmd of filtered) {
      if (cmd.category !== currentCat) {
        currentCat = cmd.category
        groups.push({ type: 'header', label: currentCat })
      }
      groups.push({ type: 'item', cmd })
    }
    return groups
  }, [filtered])

  // Flat list of selectable items
  const selectableItems = useMemo(
    () => grouped.filter(g => g.type === 'item'),
    [grouped]
  )

  // Reset selection when filter changes
  useEffect(() => { setSelectedIndex(0) }, [query])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, selectableItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = selectableItems[selectedIndex]
      if (item) {
        item.cmd.action()
        onClose()
      }
    }
  }, [onClose, selectableItems, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const el = list.querySelector(`[data-idx="${selectedIndex}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  let itemIdx = -1

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(6,9,13,0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '480px', maxWidth: '90vw',
          background: 'rgba(10,18,28,0.96)',
          border: '1px solid rgba(56,243,255,0.25)',
          borderRadius: '10px',
          boxShadow: '0 0 60px rgba(56,243,255,0.12), 0 24px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
          animation: 'cmdPaletteIn 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(56,243,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            fontSize: '14px', color: 'rgba(56,243,255,0.5)',
            fontFamily: 'monospace', fontWeight: 'bold',
          }}>{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command..."
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              caretColor: '#38f3ff',
            }}
          />
          <span style={{
            fontSize: '9px', letterSpacing: '0.1em',
            padding: '2px 6px', borderRadius: '3px',
            background: 'rgba(56,243,255,0.08)',
            border: '1px solid rgba(56,243,255,0.2)',
            color: 'rgba(56,243,255,0.5)',
            fontFamily: 'monospace',
          }}>
            ESC
          </span>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            flex: 1,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(56,243,255,0.2) transparent',
          }}
        >
          {grouped.length === 0 ? (
            <div style={{
              padding: '24px', textAlign: 'center',
              fontSize: '11px', color: 'var(--text-dim)',
              fontFamily: 'monospace', letterSpacing: '0.1em',
            }}>
              NO MATCHING COMMANDS
            </div>
          ) : (
            grouped.map((entry, i) => {
              if (entry.type === 'header') {
                return (
                  <div key={`h-${entry.label}`} style={{
                    padding: '8px 16px 4px',
                    fontSize: '8px', letterSpacing: '0.35em',
                    color: 'var(--text-dim)', fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    background: 'rgba(6,9,13,0.4)',
                    borderTop: i > 0 ? '1px solid rgba(56,243,255,0.06)' : 'none',
                  }}>
                    {entry.label}
                  </div>
                )
              }

              itemIdx++
              const isSelected = itemIdx === selectedIndex
              const currentIdx = itemIdx

              return (
                <div
                  key={entry.cmd.id}
                  data-idx={currentIdx}
                  onClick={() => { entry.cmd.action(); onClose() }}
                  onMouseEnter={() => setSelectedIndex(currentIdx)}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    background: isSelected
                      ? 'linear-gradient(90deg, rgba(56,243,255,0.15), rgba(56,243,255,0.05))'
                      : 'transparent',
                    borderLeft: isSelected ? '2px solid #38f3ff' : '2px solid transparent',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                >
                  <span style={{ fontSize: '16px', width: '24px', textAlign: 'center', flexShrink: 0 }}>
                    {entry.cmd.icon}
                  </span>
                  <span style={{
                    flex: 1, letterSpacing: '0.05em',
                    textShadow: isSelected ? '0 0 12px rgba(56,243,255,0.3)' : 'none',
                  }}>
                    {entry.cmd.label}
                  </span>
                  {entry.cmd.hint && (
                    <span style={{
                      fontSize: '9px', letterSpacing: '0.1em',
                      padding: '1px 5px', borderRadius: '3px',
                      background: 'rgba(56,243,255,0.06)',
                      border: '1px solid rgba(56,243,255,0.12)',
                      color: 'rgba(56,243,255,0.4)',
                    }}>
                      {entry.cmd.hint}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(56,243,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '9px',
          fontFamily: 'monospace',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', opacity: 0.5 }}>{'\u2191\u2193'}</span> navigate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', opacity: 0.5 }}>{'\u23CE'}</span> select
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', opacity: 0.5 }}>esc</span> close
          </span>
          <span style={{ marginLeft: 'auto', color: 'rgba(56,243,255,0.3)' }}>
            FATWA COMMAND DECK
          </span>
        </div>
      </div>
    </div>
  )
}
