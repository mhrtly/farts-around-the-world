import React, { useEffect, useMemo, useState } from 'react'
import {
  accountSummary,
  mergeTargets,
  moderationNotes,
  myEvents,
  reviewChecklist,
} from './mockData.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'review', label: 'Under review' },
  { id: 'deleted', label: 'Deleted' },
]

function relativeTime(timestamp) {
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000))

  if (deltaSeconds < 60) return `${deltaSeconds}s ago`
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`
  return `${Math.floor(deltaSeconds / 86400)}d ago`
}

function statusLabel(status) {
  if (status === 'review') return 'Under review'
  if (status === 'deleted') return 'Deleted'
  return 'Active'
}

function statusClass(status) {
  if (status === 'review') return 'proposal-badge is-review'
  if (status === 'deleted') return 'proposal-badge is-deleted'
  return 'proposal-badge is-active'
}

function audioLabel(event) {
  return event.hasAudio ? 'Audio attached' : 'No audio'
}

export default function MyFartsControlCenterPreview() {
  const [filter, setFilter] = useState('active')
  const visibleEvents = useMemo(() => {
    if (filter === 'all') return myEvents
    return myEvents.filter((event) => event.status === filter)
  }, [filter])

  const [selectedId, setSelectedId] = useState(visibleEvents[0]?.id || myEvents[0].id)

  useEffect(() => {
    if (!visibleEvents.some((event) => event.id === selectedId)) {
      setSelectedId(visibleEvents[0]?.id || myEvents[0].id)
    }
  }, [selectedId, visibleEvents])

  const selectedEvent = visibleEvents.find((event) => event.id === selectedId)
    || myEvents.find((event) => event.id === selectedId)
    || myEvents[0]

  return (
    <div className="proposal-preview">
      <div className="proposal-scene">
        <header className="proposal-scene__header">
          <div className="proposal-scene__heading">
            <div className="proposal-preview__eyebrow">Draft Proposal 0001</div>
            <h1 className="proposal-preview__title">My Farts Control Center</h1>
            <p className="proposal-preview__lede">
              This is a non-destructive preview of a profile-facing dashboard for ownership,
              self-delete, report visibility, and account upgrade flow. It is not wired into the
              production app path unless `?proposal=my-farts-control-center` is present.
            </p>

            <div className="proposal-scene__meta">
              <div className="proposal-pill">
                Status <strong>draft only</strong>
              </div>
              <div className="proposal-pill">
                Review mode <strong>keep / adjust / reject</strong>
              </div>
              <div className="proposal-pill">
                Merge style <strong>selective, not automatic</strong>
              </div>
              <div className="proposal-pill">
                Review note <strong>proposals/0001-my-farts-control-center.md</strong>
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
            <div className="proposal-card__title">Account model</div>
            <div className="proposal-account">
              <div className="proposal-account__name">{accountSummary.displayName}</div>
              <div className="proposal-account__subcopy">
                Identity mode: {accountSummary.identityMode}. This keeps posting low-friction
                while preserving ownership for delete, moderation history, votes, and later
                Google account linking.
              </div>
            </div>

            <div className="proposal-grid">
              <div className="proposal-stat">
                <div className="proposal-stat__label">Uploads</div>
                <div className="proposal-stat__value">{accountSummary.uploads}</div>
              </div>
              <div className="proposal-stat">
                <div className="proposal-stat__label">Public</div>
                <div className="proposal-stat__value">{accountSummary.publicEvents}</div>
              </div>
              <div className="proposal-stat">
                <div className="proposal-stat__label">Under review</div>
                <div className="proposal-stat__value">{accountSummary.underReview}</div>
              </div>
              <div className="proposal-stat">
                <div className="proposal-stat__label">Avg rating</div>
                <div className="proposal-stat__value">{accountSummary.averageRating}</div>
              </div>
            </div>

            <div className="proposal-note">
              <strong>Session age:</strong> {accountSummary.sessionAgeDays} days. The draft assumes
              account data survives browser restarts and can later be linked to Google without
              losing old uploads.
            </div>

            <div className="proposal-card__title">Merge targets</div>
            <div className="proposal-stack">
              {mergeTargets.map((target) => (
                <div key={target} className="proposal-note">
                  {target}
                </div>
              ))}
            </div>
          </section>

          <section className="proposal-card">
            <div className="proposal-toolbar">
              <div>
                <div className="proposal-card__title">Creator archive</div>
                <div className="proposal-card__headline">A real place to manage uploads</div>
              </div>
              <div className="proposal-toolbar__count">
                {visibleEvents.length} visible in current filter
              </div>
            </div>

            <div className="proposal-toolbar">
              <div className="proposal-toolbar__chips">
                {FILTERS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`proposal-filter${filter === entry.id ? ' is-active' : ''}`}
                    onClick={() => setFilter(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="proposal-list">
              {visibleEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`proposal-event${selectedId === event.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(event.id)}
                >
                  <div className="proposal-event__topline">
                    <div className="proposal-event__title">{event.title}</div>
                    <div className={statusClass(event.status)}>{statusLabel(event.status)}</div>
                  </div>

                  <div className="proposal-event__caption">{event.caption}</div>

                  <div className="proposal-event__meta">
                    <span>{event.city}, {event.countryCode}</span>
                    <span>{relativeTime(event.createdAt)}</span>
                    <span>{audioLabel(event)}</span>
                  </div>

                  <div className="proposal-event__actions">
                    <span>{event.ratingAverage} / 10 avg</span>
                    <span>{event.ratingCount} ratings</span>
                    <span>{event.reportCount} reports</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="proposal-card">
            <div className="proposal-card__title">Selected event</div>
            <div className="proposal-detail">
              <div className="proposal-detail__hero">
                <div className={statusClass(selectedEvent.status)}>{statusLabel(selectedEvent.status)}</div>
                <div className="proposal-detail__title">{selectedEvent.title}</div>
                <div className="proposal-detail__copy">
                  {selectedEvent.caption}
                </div>
              </div>

              <div className="proposal-kv">
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Location</div>
                  <div className="proposal-kv__value">
                    {selectedEvent.city}, {selectedEvent.countryLabel}
                  </div>
                </div>
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Published</div>
                  <div className="proposal-kv__value">{relativeTime(selectedEvent.createdAt)}</div>
                </div>
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Duration</div>
                  <div className="proposal-kv__value">{selectedEvent.durationSec}s</div>
                </div>
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Peak level</div>
                  <div className="proposal-kv__value">{selectedEvent.peakDb} dBFS</div>
                </div>
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Visibility</div>
                  <div className="proposal-kv__value">{selectedEvent.visibility}</div>
                </div>
                <div className="proposal-kv__item">
                  <div className="proposal-kv__label">Type</div>
                  <div className="proposal-kv__value">{selectedEvent.type}</div>
                </div>
              </div>

              <div className="proposal-card__title">Planned actions</div>
              <div className="proposal-checklist">
                <div className="proposal-checklist__item">
                  <strong>Play audio:</strong> remains available so creators can verify the upload.
                </div>
                <div className="proposal-checklist__item">
                  <strong>Delete event:</strong> immediate self-service action with soft-delete semantics.
                </div>
                <div className="proposal-checklist__item">
                  <strong>View reports:</strong> visible summary so creators understand why an item is under review.
                </div>
                <div className="proposal-checklist__item">
                  <strong>Upgrade account:</strong> link Google later without losing existing uploads.
                </div>
              </div>

              <div className="proposal-card__title">Moderation notes</div>
              <div className="proposal-checklist">
                {moderationNotes.map((note) => (
                  <div key={note} className="proposal-checklist__item">
                    {note}
                  </div>
                ))}
              </div>

              <div className="proposal-card__title">Claude review prompts</div>
              <div className="proposal-checklist">
                {reviewChecklist.map((item) => (
                  <div key={item} className="proposal-checklist__item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
