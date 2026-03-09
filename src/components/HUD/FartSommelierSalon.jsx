import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CustomAudioPlayer from './CustomAudioPlayer.jsx'
import { SOMMELIER_PERSONAS, analyzeAudioBuffer, createSommelierFlight } from './fartSommelierEngine.js'
import '../../styles/fartSommelierSalon.css'

const STORAGE_KEY = 'fatwa-sommelier-salon-v1'

function readSalonStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const critics = Object.fromEntries(
      SOMMELIER_PERSONAS.map(persona => [
        persona.id,
        {
          correct: parsed?.critics?.[persona.id]?.correct || 0,
          total: parsed?.critics?.[persona.id]?.total || 0,
        },
      ])
    )

    return {
      flightsPlayed: parsed.flightsPlayed || 0,
      perfectFlights: parsed.perfectFlights || 0,
      correctMatches: parsed.correctMatches || 0,
      totalMatches: parsed.totalMatches || 0,
      critics,
    }
  } catch {
    return {
      flightsPlayed: 0,
      perfectFlights: 0,
      correctMatches: 0,
      totalMatches: 0,
      critics: Object.fromEntries(
        SOMMELIER_PERSONAS.map(persona => [persona.id, { correct: 0, total: 0 }])
      ),
    }
  }
}

function saveSalonStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

function summarizeRound(score, total) {
  if (score === total) {
    return 'Perfect flight. The house critics would like to pretend this was inevitable.'
  }
  if (score === total - 1) {
    return 'Nearly perfect. One critic slipped through the candlelight.'
  }
  if (score >= 1) {
    return 'Some notes landed, some dissolved into atmosphere. That is still useful science.'
  }
  return 'A humbling tasting. The critics need another night in the cellar.'
}

export default function FartSommelierSalon({ onClose, pageMode = false }) {
  const [flight, setFlight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archiveSync, setArchiveSync] = useState(null)
  const [answers, setAnswers] = useState({})
  const [judged, setJudged] = useState(false)
  const [roundSummary, setRoundSummary] = useState(null)
  const [stats, setStats] = useState(() => readSalonStats())
  const objectUrlsRef = useRef([])
  const audioContextRef = useRef(null)

  const releaseObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    objectUrlsRef.current = []
  }, [])

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) {
      throw new Error('This browser cannot decode the archive audio for Sommelier mode.')
    }

    audioContextRef.current = new AudioContextCtor()
    return audioContextRef.current
  }, [])

  const loadFlight = useCallback(async () => {
    setLoading(true)
    setError('')
    setArchiveSync(null)
    setJudged(false)
    setRoundSummary(null)
    setAnswers({})
    releaseObjectUrls()

    try {
      const response = await fetch('/api/archive/clips?limit=3&sort=random')
      const data = await response.json()

      if (!response.ok) {
        if (data?.state && data?.state !== 'ready') {
          setArchiveSync(data)
          setFlight(null)
          return
        }
        throw new Error(data.error || 'Failed to load sommelier flight')
      }

      const clips = (data.clips || []).slice(0, 3)
      if (clips.length < 3) {
        throw new Error('Need at least three archive clips to stage a tasting flight.')
      }

      const audioContext = getAudioContext()
      const enrichedClips = await Promise.all(clips.map(async clip => {
        const audioResponse = await fetch(clip.audioUrl)
        if (!audioResponse.ok) {
          throw new Error(`Failed to load ${clip.fileName}`)
        }

        const arrayBuffer = await audioResponse.arrayBuffer()
        const blob = new Blob(
          [arrayBuffer],
          { type: audioResponse.headers.get('content-type') || 'audio/wav' }
        )
        const localAudioUrl = URL.createObjectURL(blob)
        objectUrlsRef.current.push(localAudioUrl)

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
        return {
          ...clip,
          audioUrl: localAudioUrl,
          analysis: analyzeAudioBuffer(audioBuffer),
        }
      }))

      setFlight(createSommelierFlight(enrichedClips))
    } catch (err) {
      setFlight(null)
      setError(err.message || 'Failed to load sommelier flight')
    } finally {
      setLoading(false)
    }
  }, [getAudioContext, releaseObjectUrls])

  useEffect(() => {
    loadFlight()
  }, [loadFlight])

  useEffect(() => {
    if (!archiveSync || archiveSync.state === 'ready') {
      return undefined
    }

    const timerId = setTimeout(() => {
      loadFlight()
    }, 5000)

    return () => clearTimeout(timerId)
  }, [archiveSync, loadFlight])

  useEffect(() => {
    const handleEscape = event => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => () => {
    releaseObjectUrls()
    const closePromise = audioContextRef.current?.close?.()
    if (closePromise?.catch) {
      closePromise.catch(() => {})
    }
  }, [releaseObjectUrls])

  const handleAnswer = useCallback((criticId, slotLabel) => {
    if (judged) {
      return
    }

    setAnswers(prev => ({
      ...prev,
      [criticId]: slotLabel,
    }))
  }, [judged])

  const canJudge = flight && Object.keys(answers).length === flight.critics.length

  const judgeFlight = useCallback(() => {
    if (!flight || !canJudge) {
      return
    }

    const results = flight.critics.map(critic => ({
      criticId: critic.id,
      correct: answers[critic.id] === critic.targetSlot,
    }))
    const score = results.filter(result => result.correct).length

    const nextStats = {
      flightsPlayed: stats.flightsPlayed + 1,
      perfectFlights: stats.perfectFlights + (score === flight.critics.length ? 1 : 0),
      correctMatches: stats.correctMatches + score,
      totalMatches: stats.totalMatches + flight.critics.length,
      critics: { ...stats.critics },
    }

    for (const critic of flight.critics) {
      nextStats.critics[critic.id] = {
        correct: (nextStats.critics[critic.id]?.correct || 0) + (answers[critic.id] === critic.targetSlot ? 1 : 0),
        total: (nextStats.critics[critic.id]?.total || 0) + 1,
      }
    }

    saveSalonStats(nextStats)
    setStats(nextStats)
    setJudged(true)
    setRoundSummary({
      score,
      total: flight.critics.length,
      copy: summarizeRound(score, flight.critics.length),
    })
  }, [answers, canJudge, flight, stats])

  const houseAccuracy = useMemo(() => {
    if (!stats.totalMatches) {
      return '—'
    }
    return `${Math.round((stats.correctMatches / stats.totalMatches) * 100)}%`
  }, [stats.correctMatches, stats.totalMatches])

  return (
    <div
      className={`sommelier-salon ${pageMode ? 'sommelier-salon--page' : ''}`}
      onClick={pageMode ? undefined : onClose}
    >
      <div
        className={`sommelier-salon__dialog ${pageMode ? 'sommelier-salon__dialog--page' : ''}`}
        onClick={event => event.stopPropagation()}
      >
        <header className="sommelier-salon__header">
          <div>
            <div className="sommelier-salon__eyebrow">Sommelier Salon</div>
            <h2 className="sommelier-salon__title">The house of competing fart critics</h2>
            <p className="sommelier-salon__subtitle">
              Three AI critics describe tonight&apos;s flight in earnest acoustic language. Listen to the clips, then decide who belongs to whom.
            </p>
          </div>

          <button className="sommelier-salon__close" onClick={onClose} type="button">
            {pageMode ? 'Back Home' : 'Close'}
          </button>
        </header>

        <section className="sommelier-salon__toolbar">
          <div className="sommelier-salon__house-note">
            <strong>Nightly Research</strong>
            <span>{flight?.researchNote || 'The critics are listening for a flight.'}</span>
          </div>

          <div className="sommelier-salon__stats">
            <div className="sommelier-salon__stat">
              <span>Flights</span>
              <strong>{stats.flightsPlayed}</strong>
            </div>
            <div className="sommelier-salon__stat">
              <span>Perfect</span>
              <strong>{stats.perfectFlights}</strong>
            </div>
            <div className="sommelier-salon__stat">
              <span>Accuracy</span>
              <strong>{houseAccuracy}</strong>
            </div>
          </div>
        </section>

        <div className="sommelier-salon__body">
          {loading && (
            <div className="sommelier-salon__empty">
              <div className="sommelier-salon__empty-title">Pouring tonight&apos;s flight</div>
              <div className="sommelier-salon__empty-copy">
                Pulling three archive clips and letting the house critics listen.
              </div>
            </div>
          )}

          {!loading && archiveSync && archiveSync.state !== 'ready' && (
            <div className="sommelier-salon__empty">
              <div className="sommelier-salon__empty-title">The cellar is still syncing</div>
              <div className="sommelier-salon__empty-copy">
                {archiveSync.message || 'Preparing the public archive on the production server.'}
              </div>
              <div className="sommelier-salon__empty-copy">
                State: {archiveSync.state} · {archiveSync.clipCount || 0} clips ready so far
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="sommelier-salon__empty sommelier-salon__empty--error">
              <div className="sommelier-salon__empty-title">Sommelier flight unavailable</div>
              <div className="sommelier-salon__empty-copy">{error}</div>
            </div>
          )}

          {!loading && !error && !archiveSync && flight && (
            <>
              <section className="sommelier-salon__section">
                <div className="sommelier-salon__section-head">
                  <div>
                    <div className="sommelier-salon__section-eyebrow">Flight</div>
                    <h3>Listen before you judge</h3>
                  </div>
                  <div className="sommelier-salon__microcopy">
                    Each clip is real archive audio. The notes are generated from live waveform features, not fixed tags.
                  </div>
                </div>

                <div className="sommelier-salon__clips">
                  {flight.lineup.map(clip => (
                    <article className="sommelier-clip-card" key={clip.id}>
                      <div className="sommelier-clip-card__header">
                        <div className="sommelier-clip-card__slot">{clip.slotLabel}</div>
                        <div>
                          <div className="sommelier-clip-card__eyebrow">Archive clip</div>
                          <div className="sommelier-clip-card__title">{clip.fileName}</div>
                        </div>
                      </div>

                      <CustomAudioPlayer src={clip.audioUrl} color="#6cefff" height={48} />

                      <div className="sommelier-clip-card__metrics">
                        <span>{clip.analysis.activeDuration.toFixed(2)}s active</span>
                        <span>{clip.analysis.burstCount} bursts</span>
                        <span>{clip.analysis.pitchHz ? `${Math.round(clip.analysis.pitchHz)} Hz` : 'pitch elusive'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="sommelier-salon__section">
                <div className="sommelier-salon__section-head">
                  <div>
                    <div className="sommelier-salon__section-eyebrow">Critics</div>
                    <h3>Match each note to its fart</h3>
                  </div>
                  <div className="sommelier-salon__microcopy">
                    Choose the clip that best fits each note. The house wants language that is vivid and operational at the same time.
                  </div>
                </div>

                <div className="sommelier-salon__critics">
                  {flight.critics.map(critic => {
                    const personaStats = stats.critics[critic.id] || { correct: 0, total: 0 }
                    const personaAccuracy = personaStats.total
                      ? `${Math.round((personaStats.correct / personaStats.total) * 100)}%`
                      : '—'

                    return (
                      <article
                        className={`sommelier-critic-card ${judged ? 'is-judged' : ''}`}
                        key={critic.id}
                        style={{ '--critic-color': critic.color }}
                      >
                        <div className="sommelier-critic-card__header">
                          <div>
                            <div className="sommelier-critic-card__title-row">
                              <h4>{critic.name}</h4>
                              <span>{critic.title}</span>
                            </div>
                            <p>{critic.accent}</p>
                          </div>
                          <div className="sommelier-critic-card__accuracy">
                            <strong>{personaAccuracy}</strong>
                            <span>local hit rate</span>
                          </div>
                        </div>

                        <blockquote className="sommelier-critic-card__note">{critic.note}</blockquote>
                        <div className="sommelier-critic-card__quote">“{critic.pullQuote}”</div>

                        <div className="sommelier-critic-card__facets">
                          {critic.facets.map(facet => (
                            <span className="sommelier-critic-card__facet" key={`${critic.id}-${facet.key}`}>
                              {facet.badge}
                            </span>
                          ))}
                        </div>

                        <div className="sommelier-critic-card__answers">
                          {flight.lineup.map(clip => (
                            <button
                              key={`${critic.id}-${clip.slotLabel}`}
                              type="button"
                              className={`sommelier-critic-card__answer ${answers[critic.id] === clip.slotLabel ? 'is-selected' : ''} ${judged && critic.targetSlot === clip.slotLabel ? 'is-correct' : ''}`}
                              onClick={() => handleAnswer(critic.id, clip.slotLabel)}
                              disabled={judged}
                            >
                              <span>{clip.slotLabel}</span>
                              <small>{clip.fileName}</small>
                            </button>
                          ))}
                        </div>

                        {judged && (
                          <div className={`sommelier-critic-card__result ${answers[critic.id] === critic.targetSlot ? 'is-right' : 'is-wrong'}`}>
                            <strong>{answers[critic.id] === critic.targetSlot ? 'Matched' : 'Missed'}</strong>
                            <span>House answer: clip {critic.targetSlot}</span>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="sommelier-salon__footer">
          <div className="sommelier-salon__footer-copy">
            {judged && roundSummary ? (
              <>
                <strong>{roundSummary.score}/{roundSummary.total}</strong>
                <span>{roundSummary.copy}</span>
              </>
            ) : (
              <>
                <strong>{Object.keys(answers).length}/{flight?.critics.length || 0}</strong>
                <span>critics assigned</span>
              </>
            )}
          </div>

          <div className="sommelier-salon__footer-actions">
            <button
              type="button"
              className="sommelier-salon__button sommelier-salon__button--secondary"
              onClick={loadFlight}
            >
              Pour another flight
            </button>
            <button
              type="button"
              className="sommelier-salon__button sommelier-salon__button--primary"
              onClick={judgeFlight}
              disabled={!canJudge || judged}
            >
              Judge the flight
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
