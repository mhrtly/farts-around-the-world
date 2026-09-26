import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const CLOSE_MS = 140

// "30 FARTS · 10 PLACES · 1 COUNTRY". While the numbers are still loading they
// sit as ghost digits, then switch on.
const COUNTERS = [
  ['total', 'fart', 'farts'],
  ['places', 'place', 'places'],
  ['countries', 'country', 'countries'],
]

function Counters({ stats }) {
  return (
    <p className={`topbar__counters ${stats ? 'is-on' : ''}`} aria-hidden={stats ? undefined : true}>
      {COUNTERS.map(([key, one, many], index) => {
        const value = stats ? stats[key] : null
        // The separator ends each item, so a wrap leaves it at the end of the
        // first line rather than starting the second
        return (
          <span key={key} className="topbar__count">
            <b>{value == null ? '--' : value.toLocaleString('en-US')}</b> {value === 1 ? one : many}
            {index < COUNTERS.length - 1 && <span className="topbar__sep" aria-hidden="true">·</span>}
          </span>
        )
      })}
    </p>
  )
}

export default function TopBar({ stats, live, onNavigate, onAbout, menuExtra = null, onMenuOpen, onTour, onPotato }) {
  // 'closed' | 'open' | 'closing' (the panel decays out before it unmounts)
  const [menu, setMenu] = useState('closed')
  const menuRef = useRef(null)
  const keyRef = useRef(null)
  const panelRef = useRef(null)
  const open = menu === 'open'

  const items = () => [...(panelRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]

  const closeMenu = useCallback((returnFocus = false) => {
    setMenu(state => (state === 'open' ? 'closing' : state))
    if (returnFocus) keyRef.current?.focus({ preventScroll: true })
  }, [])

  const openMenu = () => {
    setMenu('open')
    onMenuOpen?.()
  }

  useEffect(() => {
    if (menu !== 'closing') return undefined
    const timer = setTimeout(() => setMenu('closed'), CLOSE_MS)
    return () => clearTimeout(timer)
  }, [menu])

  // Focus goes into the menu when it opens (keyboard and screen readers land on
  // the first item; a mouse click doesn't show a focus ring for it).
  useEffect(() => {
    if (!open) return undefined
    items()[0]?.focus({ preventScroll: true })
    const onPointer = event => {
      if (!menuRef.current?.contains(event.target)) closeMenu()
    }
    // Focus moving elsewhere (e.g. R opens the recorder) closes it too
    const onFocus = event => {
      if (!menuRef.current?.contains(event.target)) closeMenu()
    }
    window.addEventListener('pointerdown', onPointer)
    document.addEventListener('focusin', onFocus)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open, closeMenu])

  const onPanelKey = event => {
    const list = items()
    if (!list.length) return
    const index = list.indexOf(document.activeElement)
    let next = null
    if (event.key === 'ArrowDown') next = list[(index + 1) % list.length]
    else if (event.key === 'ArrowUp') next = list[(index - 1 + list.length) % list.length]
    else if (event.key === 'Home') next = list[0]
    else if (event.key === 'End') next = list[list.length - 1]
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu(true)
      return
    } else if (event.key === 'Tab') {
      closeMenu()
      return
    }
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  const onKeyKeyDown = event => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) {
      event.preventDefault()
      openMenu()
    }
  }

  const go = path => {
    closeMenu()
    onNavigate(path)
  }

  const tapsRef = useRef([])
  const onLockupTap = () => {
    const now = Date.now()
    tapsRef.current = tapsRef.current.filter(at => now - at < 2500).concat(now)
    if (tapsRef.current.length >= 5) {
      tapsRef.current = []
      onPotato?.()
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__id">
        {/* Five quick taps on the wordmark: you'll see */}
        <div className="topbar__lockup" onClick={onLockupTap}>
          <span
            className={`pilot ${live ? 'is-live' : ''}`}
            role="img"
            aria-label={live ? 'Live' : 'Reconnecting'}
            title={live ? 'Live: new farts appear the moment they are posted' : 'Reconnecting…'}
          />
          <h1 className="topbar__mark">Farts Around the World</h1>
        </div>
        <Counters stats={stats} />
      </div>

      <div className="menu" ref={menuRef}>
        <button
          ref={keyRef}
          type="button"
          className="key menu-key"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menu !== 'closed' ? 'topbar-menu' : undefined}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={onKeyKeyDown}
        >
          <span className="menu-key__lines" aria-hidden="true" />
        </button>
        {menu !== 'closed' && (
          <div
            ref={panelRef}
            id="topbar-menu"
            className={`menu__panel chassis ${menu === 'closing' ? 'is-closing' : ''}`}
            role="menu"
            aria-label="Menu"
            onKeyDown={onPanelKey}
            onClick={event => {
              // Close after any choice (including sign-in, which opens its own modal)
              if (event.target.closest('[role="menuitem"]')) closeMenu()
            }}
          >
            {onTour && (
              <button type="button" role="menuitem" onClick={() => onTour()}>
                <Icon name="orbit" size={18} />
                <span><strong>World tour</strong><em>Every fart, hands-free</em></span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                // Hand focus back to the menu key first, so the About panel
                // returns it there when it closes.
                closeMenu(true)
                onAbout()
              }}
            >
              <Icon name="info" size={18} />
              <span><strong>What is this?</strong><em>The short version</em></span>
            </button>
            <div className="menu__divider" />
            <p className="menu__label" aria-hidden="true">Side projects</p>
            <button type="button" role="menuitem" onClick={() => go('/archive-lab')}>
              <Icon name="tag" size={18} />
              <span><strong>Archive Lab</strong><em>Tag 7,000+ clips from a public fart dataset</em></span>
            </button>
            <button type="button" role="menuitem" onClick={() => go('/sommelier')}>
              <Icon name="wine" size={18} />
              <span><strong>Sommelier Salon</strong><em>Match tasting notes to the right clip</em></span>
            </button>
            {menuExtra}
          </div>
        )}
      </div>
    </header>
  )
}
