import React, { useEffect, useMemo, useState } from 'react'
import './proposalPreview.css'

const previewModules = import.meta.glob('./*/preview.jsx')

function getAvailableProposalIds() {
  return Object.keys(previewModules)
    .map((path) => path.split('/')[1])
    .sort()
}

function buildProposalHref(id) {
  const params = new URLSearchParams(window.location.search)
  params.set('proposal', id)
  return `?${params.toString()}`
}

export default function ProposalPreviewRoot() {
  const proposalId = useMemo(() => {
    return new URLSearchParams(window.location.search).get('proposal')?.trim() || ''
  }, [])
  const availableIds = useMemo(getAvailableProposalIds, [])

  const [PreviewComponent, setPreviewComponent] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const moduleLoader = previewModules[`./${proposalId}/preview.jsx`]

    if (!moduleLoader) {
      setLoadError(`Unknown proposal "${proposalId}"`)
      return
    }

    let cancelled = false

    moduleLoader()
      .then((mod) => {
        if (!cancelled) {
          setPreviewComponent(() => mod.default)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || 'Failed to load proposal preview')
        }
      })

    return () => {
      cancelled = true
    }
  }, [proposalId])

  if (loadError) {
    return (
      <div className="proposal-preview">
        <div className="proposal-preview__shell">
          <div className="proposal-preview__masthead">
            <div>
              <div className="proposal-preview__eyebrow">Proposal Sandbox</div>
              <h1 className="proposal-preview__title">Preview unavailable</h1>
              <p className="proposal-preview__lede">{loadError}</p>
            </div>
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>

          <div className="proposal-preview__panel">
            <div className="proposal-preview__subhead">Available proposals</div>
            <div className="proposal-preview__chips">
              {availableIds.map((id) => (
                <a key={id} className="proposal-preview__chip" href={buildProposalHref(id)}>
                  {id}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!PreviewComponent) {
    return (
      <div className="proposal-preview">
        <div className="proposal-preview__shell">
          <div className="proposal-preview__masthead">
            <div>
              <div className="proposal-preview__eyebrow">Proposal Sandbox</div>
              <h1 className="proposal-preview__title">Loading preview</h1>
              <p className="proposal-preview__lede">
                Draft proposals load only when the `proposal` query param is present.
              </p>
            </div>
            <a className="proposal-preview__action" href="/">
              Return to live app
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <PreviewComponent />
}
