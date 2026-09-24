import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

function StatsLine({ stats, live, className = '' }) {
  if (!stats) return null
  const parts = [
    `${stats.total.toLocaleString()} fart${stats.total === 1 ? '' : 's'}`,
    `${stats.places} place${stats.places === 1 ? '' : 's'}`,
    `${stats.countries} countr${stats.countries === 1 ? 'y' : 'ies'}`,
  ]
  return (
    <p className={`topbar__stats ${className}`}>
      <span className={`live-dot ${live ? 'is-live' : ''}`} title={live ? 'Live — new farts appear instantly' : 'Reconnecting…'} />
      {parts.join(' · ')}
    </p>
  )
}

export default function TopBar({ stats, live, onNavigate, onAbout, accountSlot = null, menuExtra = null }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointer = event => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const onKey = event => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const go = path => {
    setMenuOpen(false)
    onNavigate(path)
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">💨</span>
        <div className="brand__text">
          <h1 className="brand__title">Farts Around the World</h1>
          <p className="brand__tagline">Real farts, pinned where they happened.</p>
          <StatsLine stats={stats} live={live} className="topbar__stats--inline" />
        </div>
      </div>

      <div className="topbar__right">
        <StatsLine stats={stats} live={live} className="topbar__stats--side" />
        {accountSlot}
        <div className="menu" ref={menuRef}>
          <button
            type="button"
            className="icon-button icon-button--glass"
            aria-label="More"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(value => !value)}
          >
            <Icon name="more" />
          </button>
          {menuOpen && (
            <div
              className="menu__panel"
              role="menu"
              onClick={event => {
                // Close after any choice (including Clerk's sign-in, which opens its own modal)
                if (event.target.closest('[role="menuitem"]')) setMenuOpen(false)
              }}
            >
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAbout() }}>
                <Icon name="info" size={18} />
                <span><strong>What is this?</strong><em>The short version</em></span>
              </button>
              <div className="menu__divider" />
              <p className="menu__label">Side projects</p>
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
      </div>
    </header>
  )
}
