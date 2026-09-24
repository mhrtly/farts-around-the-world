import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import WaveformPlayer from './WaveformPlayer.jsx'
import { loadRecordingAnalysis, soundSeconds } from '../../utils/audioAnalysis.js'
import { setPlaybackWindow } from '../../utils/player.js'
import {
  describePlace,
  flagEmoji,
  formatDate,
  formatSeconds,
  loudnessLevel,
  loudnessWord,
  nickname,
  noteName,
  recordingAudioUrl,
  timeAgo,
  volumeToDb,
} from '../../utils/recordings.js'

function useAnalysis(id) {
  const [result, setResult] = useState({ id: null, analysis: null, failed: false })
  useEffect(() => {
    let cancelled = false
    setResult({ id, analysis: null, failed: false })
    loadRecordingAnalysis(id)
      .then(analysis => { if (!cancelled) setResult({ id, analysis, failed: false }) })
      .catch(() => { if (!cancelled) setResult({ id, analysis: null, failed: true }) })
    return () => { cancelled = true }
  }, [id])
  return result.id === id ? result : { analysis: null, failed: false }
}

export default function RecordingCard({
  site,
  recording,
  isOwn = false,
  onSelectRecording,
  onClose,
  onPrev,
  onNext,
  onShuffle,
  onShare,
  onDelete,
}) {
  const { analysis, failed } = useAnalysis(recording.id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => setConfirmDelete(false), [recording.id])

  // Play just the sound (older clips have seconds of silence around it)
  useEffect(() => {
    if (analysis) setPlaybackWindow(recording.id, analysis.trimStart, analysis.trimEnd)
  }, [analysis, recording.id])
  useEffect(() => {
    if (!confirmDelete) return undefined
    const timer = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmDelete])

  const place = describePlace(recording, site?.place)
  const duration = analysis ? soundSeconds(analysis) : recording.duration ?? null
  // Stored loudness was measured before upload normalization, so prefer it.
  const storedPeakDb = volumeToDb(recording.peakVolume)
  const peakDb = storedPeakDb ?? analysis?.peakDb ?? null
  const loudness = loudnessWord(peakDb)
  const pitchKnown = Boolean(analysis)
  const note = noteName(analysis?.pitchHz)
  const name = nickname({ duration, peakDb })
  const others = site?.events || [recording]
  const index = others.findIndex(event => event.id === recording.id)

  return (
    <div className="rcard">
      <header className="rcard__head">
        <span className="rcard__flag" aria-hidden="true">{flagEmoji(recording.country)}</span>
        <div className="rcard__place">
          <h2 className="rcard__title">{place.title}</h2>
          {place.subtitle && <p className="rcard__subtitle">{place.subtitle}</p>}
        </div>
        <button type="button" className="icon-button icon-button--accent" onClick={() => onShare?.(recording, place)} aria-label="Share this fart" title="Share">
          <Icon name="share" />
        </button>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>

      {others.length > 1 && (
        <div className="rcard__siblings" role="tablist" aria-label="Farts recorded here">
          <span className="rcard__siblings-label">{others.length} farts here</span>
          <div className="rcard__chips">
            {others.slice(0, 12).map((event, i) => (
              <button
                key={event.id}
                type="button"
                role="tab"
                aria-selected={event.id === recording.id}
                className={`chip ${event.id === recording.id ? 'is-active' : ''}`}
                onClick={() => onSelectRecording?.(event)}
              >
                #{others.length - i}
              </button>
            ))}
          </div>
        </div>
      )}

      <WaveformPlayer
        key={recording.id}
        id={recording.id}
        src={recordingAudioUrl(recording.id)}
        peaks={analysis?.peaks || null}
        duration={analysis?.duration ?? recording.duration}
        startAt={analysis?.trimStart || 0}
        endAt={analysis?.trimEnd ?? null}
        loadingWave={!analysis && !failed}
        size="lg"
        tone={isOwn ? 'lime' : 'cyan'}
        label={`Play the fart from ${place.title}`}
      />

      <div className="rcard__stats">
        <div className="stat">
          <span className="stat__label">Length</span>
          <strong className="stat__value">{duration != null ? formatSeconds(duration) : '—'}</strong>
        </div>
        <div className="stat">
          <span className="stat__label">Loudness</span>
          <strong className="stat__value">{loudness || (failed ? '—' : '…')}</strong>
          <span className="meter" aria-hidden="true"><span style={{ width: `${loudnessLevel(peakDb) * 100}%` }} /></span>
        </div>
        <div className="stat">
          <span className="stat__label">Pitch</span>
          <strong className="stat__value">
            {pitchKnown ? (note || 'None') : failed ? '—' : '…'}
          </strong>
          <span className="stat__hint">
            {pitchKnown ? (note ? `${Math.round(analysis.pitchHz)} Hz` : 'all air') : ''}
          </span>
        </div>
      </div>

      <p className="rcard__meta">
        {name && <span className="rcard__name">{name}</span>}
        <span title={formatDate(recording.timestamp)}>Posted {timeAgo(recording.timestamp)}</span>
        {isOwn && <span className="badge badge--lime">Yours</span>}
      </p>

      <footer className="rcard__actions">
        <div className="rcard__nav">
          <button type="button" className="icon-button" onClick={onPrev} aria-label="Newer fart" title="Newer">
            <Icon name="prev" />
          </button>
          <button type="button" className="pill-button" onClick={onShuffle}>
            <Icon name="shuffle" size={18} /> Random
          </button>
          <button type="button" className="icon-button" onClick={onNext} aria-label="Older fart" title="Older">
            <Icon name="next" />
          </button>
        </div>
        {isOwn && onDelete && (
          <button
            type="button"
            className={`pill-button pill-button--danger ${confirmDelete ? 'is-armed' : ''}`}
            onClick={() => (confirmDelete ? onDelete(recording) : setConfirmDelete(true))}
          >
            <Icon name="trash" size={18} /> {confirmDelete ? 'Really?' : 'Delete'}
          </button>
        )}
      </footer>
      {index >= 0 && others.length > 1 && <span className="sr-only">Recording {others.length - index} of {others.length} at this place</span>}
    </div>
  )
}
