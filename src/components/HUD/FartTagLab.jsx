import { useCallback, useEffect, useMemo, useState } from 'react'
import CustomAudioPlayer from './CustomAudioPlayer.jsx'
import '../../styles/archiveTagLab.css'

const STARTER_TAGS = [
  'staccato',
  'sustained',
  'low-heavy',
  'high-texture',
  'tonal',
  'noisy',
  'buzzy',
  'raspy',
  'rumbly',
  'airy',
  'stealthy',
  'explosive',
  'chaotic',
  'squeaky',
]

const SORT_OPTIONS = [
  { value: 'random', label: 'Random Batch' },
  { value: 'untagged', label: 'Least Tagged' },
  { value: 'most-tagged', label: 'Most Tagged' },
]

function parseCustomTags(value) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

export default function FartTagLab({ onClose }) {
  const [clips, setClips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archiveSync, setArchiveSync] = useState(null)
  const [sort, setSort] = useState('random')
  const [selectedTags, setSelectedTags] = useState({})
  const [customTagInput, setCustomTagInput] = useState({})
  const [submitState, setSubmitState] = useState({})

  const loadBatch = useCallback(async (nextSort = sort) => {
    setLoading(true)
    setError('')
    setArchiveSync(null)

    try {
      const response = await fetch(`/api/archive/clips?limit=8&sort=${encodeURIComponent(nextSort)}`)
      const data = await response.json()

      if (!response.ok) {
        if (data?.state && data?.state !== 'ready') {
          setArchiveSync(data)
          setClips([])
          return
        }
        throw new Error(data.error || 'Failed to load archive clips')
      }

      setClips(data.clips || [])
      setSelectedTags({})
      setCustomTagInput({})
      setSubmitState({})
    } catch (err) {
      setClips([])
      setError(err.message || 'Failed to load archive clips')
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => {
    loadBatch(sort)
  }, [loadBatch, sort])

  useEffect(() => {
    if (!archiveSync || archiveSync.state === 'ready') {
      return undefined
    }

    const timerId = setTimeout(() => {
      loadBatch(sort)
    }, 5000)

    return () => clearTimeout(timerId)
  }, [archiveSync, loadBatch, sort])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const toggleTag = useCallback((clipId, tag) => {
    setSelectedTags(prev => {
      const current = new Set(prev[clipId] || [])
      if (current.has(tag)) {
        current.delete(tag)
      } else {
        current.add(tag)
      }

      return {
        ...prev,
        [clipId]: [...current],
      }
    })
  }, [])

  const submitTagsForClip = useCallback(async (clipId) => {
    const picked = selectedTags[clipId] || []
    const custom = parseCustomTags(customTagInput[clipId] || '')
    const tags = [...new Set([...picked, ...custom])]

    if (!tags.length) {
      setSubmitState(prev => ({
        ...prev,
        [clipId]: { status: 'error', message: 'Choose or type at least one tag.' },
      }))
      return
    }

    setSubmitState(prev => ({
      ...prev,
      [clipId]: { status: 'saving', message: 'Saving tags...' },
    }))

    try {
      const response = await fetch(`/api/archive/clips/${encodeURIComponent(clipId)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save tags')
      }

      setClips(prev => prev.map(clip => (clip.id === clipId ? data.clip : clip)))
      setSelectedTags(prev => ({ ...prev, [clipId]: [] }))
      setCustomTagInput(prev => ({ ...prev, [clipId]: '' }))
      setSubmitState(prev => ({
        ...prev,
        [clipId]: { status: 'saved', message: 'Saved. Thanks for training the archive.' },
      }))
    } catch (err) {
      setSubmitState(prev => ({
        ...prev,
        [clipId]: { status: 'error', message: err.message || 'Failed to save tags' },
      }))
    }
  }, [customTagInput, selectedTags])

  const batchStats = useMemo(() => {
    const totalTags = clips.reduce((sum, clip) => sum + (clip.tagCount || 0), 0)
    return {
      clipCount: clips.length,
      averageTags: clips.length ? (totalTags / clips.length).toFixed(1) : '0.0',
    }
  }, [clips])

  return (
    <div className="archive-tag-lab" onClick={onClose}>
      <div className="archive-tag-lab__dialog" onClick={event => event.stopPropagation()}>
        <header className="archive-tag-lab__header">
          <div>
            <div className="archive-tag-lab__eyebrow">Community Archive Lab</div>
            <h2 className="archive-tag-lab__title">Crowdsource the fart taxonomy</h2>
            <p className="archive-tag-lab__subtitle">
              Listen to raw clips, vote on existing labels, and propose new tag language.
            </p>
          </div>

          <button className="archive-tag-lab__close" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <section className="archive-tag-lab__toolbar">
          <div className="archive-tag-lab__sorts">
            {SORT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`archive-tag-lab__sort ${sort === option.value ? 'is-active' : ''}`}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="archive-tag-lab__meta">
            <span>{batchStats.clipCount} clips loaded</span>
            <span>{batchStats.averageTags} avg tags per clip</span>
            <button type="button" className="archive-tag-lab__refresh" onClick={() => loadBatch(sort)}>
              Load another batch
            </button>
          </div>
        </section>

        <div className="archive-tag-lab__body">
          {loading && (
            <div className="archive-tag-lab__empty">
              <div className="archive-tag-lab__empty-title">Loading archive clips</div>
              <div className="archive-tag-lab__empty-copy">Pulling a fresh batch from the Kaggle archive.</div>
            </div>
          )}

          {!loading && archiveSync && archiveSync.state !== 'ready' && (
            <div className="archive-tag-lab__empty">
              <div className="archive-tag-lab__empty-title">Archive is syncing</div>
              <div className="archive-tag-lab__empty-copy">
                {archiveSync.message || 'Preparing the public archive on the production server.'}
              </div>
              <div className="archive-tag-lab__empty-copy">
                State: {archiveSync.state} · {archiveSync.clipCount || 0} clips ready so far
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="archive-tag-lab__empty archive-tag-lab__empty--error">
              <div className="archive-tag-lab__empty-title">Archive unavailable</div>
              <div className="archive-tag-lab__empty-copy">{error}</div>
            </div>
          )}

          {!loading && !error && !archiveSync && clips.map(clip => {
            const currentSelected = new Set(selectedTags[clip.id] || [])
            const status = submitState[clip.id]

            return (
              <article className="archive-tag-card" key={clip.id}>
                <div className="archive-tag-card__header">
                  <div>
                    <div className="archive-tag-card__eyebrow">Clip {clip.id}</div>
                    <div className="archive-tag-card__title">{clip.fileName}</div>
                  </div>
                  <div className="archive-tag-card__count">
                    <strong>{clip.tagCount}</strong>
                    <span>tag votes</span>
                  </div>
                </div>

                <CustomAudioPlayer src={clip.audioUrl} color="#38f3ff" height={48} />

                <div className="archive-tag-card__section">
                  <div className="archive-tag-card__label">Top community tags</div>
                  <div className="archive-tag-card__chips">
                    {clip.tags.length > 0 ? clip.tags.slice(0, 8).map(tag => (
                      <span className="archive-tag-card__chip archive-tag-card__chip--existing" key={`${clip.id}-${tag.normalizedTag}`}>
                        {tag.label}
                        <strong>{tag.count}</strong>
                      </span>
                    )) : (
                      <span className="archive-tag-card__placeholder">No tags yet. Name what you hear.</span>
                    )}
                  </div>
                </div>

                <div className="archive-tag-card__section">
                  <div className="archive-tag-card__label">Quick tags</div>
                  <div className="archive-tag-card__chips">
                    {STARTER_TAGS.map(tag => (
                      <button
                        key={`${clip.id}-${tag}`}
                        type="button"
                        className={`archive-tag-card__chip archive-tag-card__chip--selectable ${currentSelected.has(tag) ? 'is-selected' : ''}`}
                        onClick={() => toggleTag(clip.id, tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="archive-tag-card__section">
                  <label className="archive-tag-card__label" htmlFor={`custom-tag-${clip.id}`}>
                    Add your own tags
                  </label>
                  <input
                    id={`custom-tag-${clip.id}`}
                    className="archive-tag-card__input"
                    type="text"
                    value={customTagInput[clip.id] || ''}
                    onChange={event => setCustomTagInput(prev => ({ ...prev, [clip.id]: event.target.value }))}
                    placeholder="wet, fluttery, metallic, room echo..."
                  />
                </div>

                <div className="archive-tag-card__footer">
                  <button
                    type="button"
                    className="archive-tag-card__submit"
                    disabled={status?.status === 'saving'}
                    onClick={() => submitTagsForClip(clip.id)}
                  >
                    {status?.status === 'saving' ? 'Saving...' : 'Submit tags'}
                  </button>

                  <div className={`archive-tag-card__status ${status?.status === 'error' ? 'is-error' : ''}`}>
                    {status?.message || 'Anonymous tagging. No account required.'}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
