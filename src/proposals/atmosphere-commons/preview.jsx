import React from 'react'
import {
  guardrails,
  impactLedger,
  missions,
  pillars,
  postcards,
  rituals,
} from './mockData.js'

function toneClass(tone) {
  if (tone === 'review') return 'is-review'
  if (tone === 'deleted') return 'is-deleted'
  return 'is-active'
}

export default function AtmosphereCommonsPreview() {
  return (
    <div className="proposal-preview">
      <div className="proposal-scene">
        <header className="proposal-scene__header">
          <div className="proposal-scene__heading">
            <div className="proposal-preview__eyebrow">Draft Proposal 0004</div>
            <h1 className="proposal-preview__title">Atmosphere Commons</h1>
            <p className="proposal-preview__lede">
              A non-destructive draft for making the app more connective and restorative: shared
              listening rituals, world postcards, optional acts of repair, and a softer bridge
              from laughter to care.
            </p>
            <div className="proposal-scene__meta">
              <div className="proposal-pill">
                Emotional arc <strong>laugh, connect, repair</strong>
              </div>
              <div className="proposal-pill">
                Review note <strong>proposals/0004-atmosphere-commons.md</strong>
              </div>
              <div className="proposal-pill">
                Guardrail <strong>no greenwashing</strong>
              </div>
            </div>
          </div>

          <div className="proposal-scene__actions">
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>
        </header>

        <div className="proposal-commons">
          <aside className="proposal-card">
            <div className="proposal-card__title">Commons pillars</div>
            <div className="proposal-list">
              {pillars.map((pillar) => (
                <div key={pillar.title} className="proposal-event">
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{pillar.title}</div>
                    <div className={`proposal-badge ${toneClass(pillar.tone)}`}>
                      pillar
                    </div>
                  </div>
                  <div className="proposal-event__caption">{pillar.copy}</div>
                </div>
              ))}
            </div>

            <div className="proposal-card__title">Guardrails</div>
            <div className="proposal-checklist">
              {guardrails.map((item) => (
                <div key={item} className="proposal-checklist__item">
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <main className="proposal-card proposal-card--display">
            <div className="proposal-altar">
              <div className="proposal-altar__halo proposal-altar__halo--outer" />
              <div className="proposal-altar__halo proposal-altar__halo--mid" />
              <div className="proposal-altar__halo proposal-altar__halo--inner" />
              <div className="proposal-altar__core">
                <div className="proposal-display__eyebrow">Shared atmosphere</div>
                <div className="proposal-display__title">Temple of the commons</div>
                <div className="proposal-display__copy">
                  The app can become more than a joke dashboard if it turns absurdity into a brief
                  experience of global solidarity, curiosity, and optional repair.
                </div>
              </div>

              <div className="proposal-orbit-grid">
                {rituals.map((ritual) => (
                  <div key={ritual.title} className="proposal-orbit-card">
                    <div className="proposal-card__title">{ritual.title}</div>
                    <div className="proposal-detail__copy">{ritual.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="proposal-card__title">World postcards</div>
            <div className="proposal-postcards">
              {postcards.map((card) => (
                <div key={card.place} className="proposal-postcard">
                  <div className="proposal-kv__label">{card.place}</div>
                  <div className="proposal-kv__value">{card.line}</div>
                </div>
              ))}
            </div>
          </main>

          <aside className="proposal-card">
            <div className="proposal-card__title">Acts of repair</div>
            <div className="proposal-checklist">
              {missions.map((mission) => (
                <div key={mission.title} className="proposal-checklist__item">
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{mission.title}</div>
                    <div className={`proposal-badge ${toneClass(mission.status)}`}>
                      optional
                    </div>
                  </div>
                  <div className="proposal-detail__copy">{mission.detail}</div>
                </div>
              ))}
            </div>

            <div className="proposal-card__title">Impact ledger</div>
            <div className="proposal-kv">
              {impactLedger.map((entry) => (
                <div key={entry.label} className="proposal-kv__item">
                  <div className="proposal-kv__label">{entry.label}</div>
                  <div className="proposal-kv__value">{entry.value}</div>
                </div>
              ))}
            </div>

            <div className="proposal-note">
              If this ever becomes real, the numbers must be transparent and traceable. The point
              is not to pretend the app is noble. The point is to make joy lead somewhere useful.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
