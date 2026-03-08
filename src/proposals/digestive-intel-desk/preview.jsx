import React from 'react'
import {
  architectureNotes,
  intelStories,
  liveOpsItems,
  mergeTargets,
  topicSignals,
} from './mockData.js'

function severityTone(level) {
  if (level === 'critical') return 'is-deleted'
  if (level === 'elevated') return 'is-review'
  return 'is-active'
}

function topicClass(score) {
  if (score >= 90) return 'is-active'
  if (score >= 75) return 'is-review'
  return 'is-deleted'
}

export default function DigestiveIntelDeskPreview() {
  return (
    <div className="proposal-preview">
      <div className="proposal-scene">
        <header className="proposal-scene__header">
          <div className="proposal-scene__heading">
            <div className="proposal-preview__eyebrow">Draft Proposal 0002</div>
            <h1 className="proposal-preview__title">Digestive Intel Desk</h1>
            <p className="proposal-preview__lede">
              A non-destructive draft for turning the current joke ticker into a cleaner intelligence
              system: one channel for live app activity, one for real-world digestive, methane, and
              food-science context. The goal is more meaning, not just more noise.
            </p>

            <div className="proposal-scene__meta">
              <div className="proposal-pill">
                Mode <strong>information architecture draft</strong>
              </div>
              <div className="proposal-pill">
                Review note <strong>proposals/0002-digestive-intel-desk.md</strong>
              </div>
              <div className="proposal-pill">
                Merge style <strong>server fetch first, UI second</strong>
              </div>
            </div>
          </div>

          <div className="proposal-scene__actions">
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>
        </header>

        <div className="proposal-layout">
          <section className="proposal-card">
            <div className="proposal-card__title">Live Ops</div>
            <div className="proposal-card__headline">Internal signal channel</div>
            <div className="proposal-list">
              {liveOpsItems.map((item) => (
                <div key={item.id} className="proposal-event">
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{item.title}</div>
                    <div className={`proposal-badge ${severityTone(item.severity)}`}>
                      {item.severity}
                    </div>
                  </div>
                  <div className="proposal-event__caption">{item.detail}</div>
                  <div className="proposal-event__meta">
                    <span>{item.region}</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="proposal-card__title">Architecture notes</div>
            <div className="proposal-checklist">
              {architectureNotes.map((note) => (
                <div key={note} className="proposal-checklist__item">
                  {note}
                </div>
              ))}
            </div>
          </section>

          <section className="proposal-card">
            <div className="proposal-card__title">Digestive Intel</div>
            <div className="proposal-card__headline">External context, clearly labeled</div>

            <div className="proposal-list">
              {intelStories.map((story) => (
                <div key={story.id} className="proposal-event">
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{story.title}</div>
                    <div className={`proposal-badge ${topicClass(story.trust)}`}>
                      trust {story.trust}
                    </div>
                  </div>

                  <div className="proposal-event__caption">{story.summary}</div>

                  <div className="proposal-event__meta">
                    <span>{story.topic}</span>
                    <span>{story.source}</span>
                    <span>{story.region}</span>
                    <span>{story.published}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="proposal-card">
            <div className="proposal-card__title">Topic Radar</div>
            <div className="proposal-card__headline">What the desk would surface</div>

            <div className="proposal-checklist">
              {topicSignals.map((signal) => (
                <div key={signal.topic} className="proposal-checklist__item">
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{signal.topic}</div>
                    <div className={`proposal-badge ${topicClass(signal.score)}`}>
                      {signal.direction}
                    </div>
                  </div>
                  <div className="proposal-event__actions">
                    <span>signal score</span>
                    <span>{signal.score}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="proposal-card__title">Merge targets</div>
            <div className="proposal-stack">
              {mergeTargets.map((target) => (
                <div key={target} className="proposal-note">
                  {target}
                </div>
              ))}
            </div>

            <div className="proposal-card__title">Why this matters</div>
            <div className="proposal-note">
              The app gets more believable and more replayable when it distinguishes internal joke
              telemetry from real-world digestion and methane coverage. That separation keeps the
              humor intact while making the product feel more designed.
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
