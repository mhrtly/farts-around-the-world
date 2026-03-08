import React from 'react'
import {
  activeRegion,
  commandActions,
  layerToggles,
  liveSignals,
  productMoves,
  regionPresets,
  scorecards,
  timeWindows,
} from './mockData.js'

function toneClass(tone) {
  if (tone === 'review') return 'is-review'
  if (tone === 'deleted') return 'is-deleted'
  return 'is-active'
}

export default function PlanetarySignalDeckPreview() {
  return (
    <div className="proposal-preview">
      <div className="proposal-scene">
        <header className="proposal-scene__header">
          <div className="proposal-scene__heading">
            <div className="proposal-preview__eyebrow">Draft Proposal 0003</div>
            <h1 className="proposal-preview__title">Planetary Signal Deck</h1>
            <p className="proposal-preview__lede">
              A World Monitor-inspired dashboard composition for this project: denser operator
              tooling, quicker presets, stronger dossiers, and a more modern command-deck feel,
              while staying committed to the absurdity of serious infrastructure for fart culture.
            </p>
            <div className="proposal-scene__meta">
              <div className="proposal-pill">
                Inspiration <strong>World Monitor structure</strong>
              </div>
              <div className="proposal-pill">
                Tone <strong>serious shell, ridiculous subject</strong>
              </div>
              <div className="proposal-pill">
                Review note <strong>proposals/0003-planetary-signal-deck.md</strong>
              </div>
            </div>
          </div>

          <div className="proposal-scene__actions">
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>
        </header>

        <div className="proposal-deck">
          <div className="proposal-deck__chrome">
            <div className="proposal-deck__brand">
              <span className="proposal-deck__badge">FATWA</span>
              <span className="proposal-deck__label">Planetary Signal Deck</span>
            </div>
            <div className="proposal-deck__command">Press Cmd+K to jump, filter, or open dossiers</div>
          </div>

          <div className="proposal-deck__toolbar">
            <div className="proposal-toolbar__chips">
              {regionPresets.map((preset, index) => (
                <button
                  key={preset}
                  type="button"
                  className={`proposal-filter${index === 0 ? ' is-active' : ''}`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="proposal-toolbar__chips">
              {timeWindows.map((window, index) => (
                <button
                  key={window}
                  type="button"
                  className={`proposal-filter${index === 1 ? ' is-active' : ''}`}
                >
                  {window}
                </button>
              ))}
            </div>
          </div>

          <div className="proposal-deck__grid">
            <aside className="proposal-card">
              <div className="proposal-card__title">Layer matrix</div>
              <div className="proposal-list">
                {layerToggles.map((layer) => (
                  <div key={layer.name} className="proposal-layer">
                    <span>{layer.name}</span>
                    <span className={`proposal-badge ${toneClass(layer.state === 'on' ? 'active' : layer.state === 'standby' ? 'review' : 'deleted')}`}>
                      {layer.state}
                    </span>
                  </div>
                ))}
              </div>

              <div className="proposal-card__title">Suggested commands</div>
              <div className="proposal-checklist">
                {commandActions.map((action) => (
                  <div key={action} className="proposal-checklist__item">
                    {action}
                  </div>
                ))}
              </div>
            </aside>

            <main className="proposal-card proposal-card--display">
              <div className="proposal-display">
                <div className="proposal-display__hero">
                  <div className="proposal-display__eyebrow">Global overview</div>
                  <div className="proposal-display__title">Command the fumes</div>
                  <div className="proposal-display__copy">
                    The map should feel like one live instrument inside a larger system: presets,
                    scoring, dossiers, alerts, and creator operations all around it.
                  </div>
                </div>

                <div className="proposal-radar">
                  <div className="proposal-radar__ring proposal-radar__ring--outer" />
                  <div className="proposal-radar__ring proposal-radar__ring--mid" />
                  <div className="proposal-radar__ring proposal-radar__ring--inner" />
                  <div className="proposal-radar__dot proposal-radar__dot--one" />
                  <div className="proposal-radar__dot proposal-radar__dot--two" />
                  <div className="proposal-radar__dot proposal-radar__dot--three" />
                  <div className="proposal-radar__sweep" />
                </div>

                <div className="proposal-score-grid">
                  {scorecards.map((card) => (
                    <div key={card.label} className="proposal-score">
                      <div className="proposal-stat__label">{card.label}</div>
                      <div className={`proposal-score__value proposal-score__value--${card.tone}`}>
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="proposal-card__title">Live signal stack</div>
              <div className="proposal-list">
                {liveSignals.map((signal) => (
                  <div key={signal.title} className="proposal-event">
                    <div className="proposal-event__topline">
                      <div className="proposal-event__title">{signal.title}</div>
                      <div className={`proposal-badge ${toneClass(signal.tone)}`}>
                        {signal.tone === 'active' ? 'live' : signal.tone}
                      </div>
                    </div>
                    <div className="proposal-event__caption">{signal.detail}</div>
                  </div>
                ))}
              </div>
            </main>

            <aside className="proposal-card">
              <div className="proposal-card__title">Region dossier</div>
              <div className="proposal-detail__hero">
                <div className="proposal-badge is-review">{activeRegion.status}</div>
                <div className="proposal-detail__title">{activeRegion.name}</div>
                <div className="proposal-detail__copy">{activeRegion.summary}</div>
              </div>

              <div className="proposal-kv">
                {activeRegion.stats.map((stat) => (
                  <div key={stat.label} className="proposal-kv__item">
                    <div className="proposal-kv__label">{stat.label}</div>
                    <div className="proposal-kv__value">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="proposal-card__title">Why this layout matters</div>
              <div className="proposal-checklist">
                {productMoves.map((move) => (
                  <div key={move} className="proposal-checklist__item">
                    {move}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
