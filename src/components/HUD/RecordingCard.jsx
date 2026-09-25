import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { PlayKey, WaveTrack } from './WaveformPlayer.jsx'
import VuMeter from './instrument/VuMeter.jsx'
import Glyph from './deck/Glyph.jsx'
import PlaceName from './deck/PlaceName.jsx'
import SiblingKeys from './deck/SiblingKeys.jsx'
import useMediaQuery from './deck/useMediaQuery.js'
import { measurementsOf, rememberAnalysis } from './deck/measurements.js'
import { formatDb, whenPosted } from './deck/format.js'
import { loadRecordingAnalysis } from '../../utils/audioAnalysis.js'
import { currentLevel, playingId, setPlaybackWindow, usePlayer } from '../../utils/player.js'
import { sunPhase } from '../../utils/sunPhase.js'
import {
  describePlace,
  formatCoords,
  formatLength,
  loudnessWord,
  nickname,
  noteName,
  recordingAudioUrl,
} from '../../utils/recordings.js'

function useAnalysis(id) {
  const [result, setResult] = useState({ id: null, analysis: null, failed: false })
  useEffect(() => {
    let cancelled = false
    setResult({ id, analysis: null, failed: false })
    loadRecordingAnalysis(id)
      .then(analysis => {
        rememberAnalysis(id, analysis)
        if (!cancelled) setResult({ id, analysis, failed: false })
      })
      .catch(() => { if (!cancelled) setResult({ id, analysis: null, failed: true }) })
    return () => { cancelled = true }
  }, [id])
  return result.id === id ? result : { analysis: null, failed: false }
}

// "Arizona, US": the rest of the place name, then the country code
function regionOf(recording, sitePlace) {
  const place = recording.place || sitePlace
  if (!place) return null
  const code = recording.country && recording.country !== 'XX' ? recording.country.toUpperCase() : null
  const rest = place.split(',').map(part => part.trim()).filter(Boolean).slice(1)
  return [...rest, code].filter(Boolean).join(', ') || null
}

// The VU goes wherever there's room for it: desktop panels, phones with at
// least ~620 px of window (an iPhone in Safari with its toolbar showing),
// and phones on their side (the deck splits into two columns there).
const VU_ROOM = '(min-width: 860px) and (min-height: 540px), (max-width: 859px) and (min-height: 620px), (max-width: 859px) and (min-width: 560px) and (orientation: landscape)'

// How much of the meta line to print: everything, then without DAY/NIGHT,
// then without YOURS (the DELETE key says so too). If even the shortest
// version wraps, print it all on two lines.
const META_TRIMS = ['is-tighter', 'is-tightest']

// One reading in the measurements row. Unknown values show ghost digits and
// switch on with a short brightness flash once measured.
function Reading({ label, value, detail, state, flashKey }) {
  return (
    <div className="reading">
      <dt className="reading__label">{label}</dt>
      <dd className="reading__value">
        {state === 'ready' ? (
          <strong key={flashKey} className="flash-on">{value}</strong>
        ) : (
          <strong className="is-ghost">
            <span className="sr-only">{state === 'failed' ? 'not measured' : 'measuring'}</span>
            <span aria-hidden="true">{state === 'failed' ? '—' : value}</span>
          </strong>
        )}
        <em>{state === 'ready' ? detail : state === 'failed' ? 'NO DATA' : ' '}</em>
      </dd>
    </div>
  )
}

// The listening deck: which fart, where and when, the waveform and a VU
// needle driven by the sound as it plays, and the real measurements.
export default function RecordingCard({
  site,
  recording,
  isOwn = false,
  ordinal = null,
  onSelectRecording,
  onClose,
  onPrev,
  onNext,
  onShuffle,
  onShare,
  onDelete,
}) {
  const id = recording.id
  const { analysis, failed } = useAnalysis(id)
  const player = usePlayer()
  const withVu = useMediaQuery(VU_ROOM)
  const [deleteState, setDeleteState] = useState('idle') // idle → armed → busy

  useEffect(() => setDeleteState('idle'), [id])
  useEffect(() => {
    if (deleteState !== 'armed') return undefined
    const timer = setTimeout(() => setDeleteState('idle'), 4000)
    return () => clearTimeout(timer)
  }, [deleteState])

  // Play just the sound (older clips have seconds of silence around it)
  useEffect(() => {
    if (analysis) setPlaybackWindow(id, analysis.trimStart, analysis.trimEnd, analysis.peaks)
  }, [analysis, id])

  const place = describePlace(recording, site?.place)
  const region = regionOf(recording, site?.place)
  const coords = formatCoords(recording.lat, recording.lng)
  const { duration, peakDb } = measurementsOf(recording, analysis)
  const lengthKnown = duration != null
  const peakKnown = Number.isFinite(peakDb)
  const pitchHz = analysis?.pitchHz
  const note = noteName(pitchHz)
  const name = nickname({ duration, peakDb })
  const phase = sunPhase(recording.lat, recording.lng, recording.timestamp)
  const siblings = site?.events?.length > 1 ? site.events : null
  const src = recordingAudioUrl(id)
  const soundStart = analysis
    ? (analysis.region && !analysis.region.quiet && analysis.sampleRate ? analysis.region.start / analysis.sampleRate : analysis.trimStart)
    : null
  const playing = player.id === id && player.status === 'playing'
  const error = player.id === id ? player.error : null

  // The needle follows the waveform envelope under the playhead, pinned to
  // the recording's real peak level.
  const vuRef = useRef({})
  vuRef.current = {
    id,
    peakDb,
    maxEnv: analysis?.peaks?.length ? Math.max(...analysis.peaks) || 1 : 1,
  }
  const getDb = useCallback(() => {
    const { id: current, peakDb: peak, maxEnv } = vuRef.current
    if (playingId() !== current || !Number.isFinite(peak)) return null
    const env = currentLevel()
    if (!(env > 0.001)) return -60
    // Waveform peaks are square-root scaled, so the level ratio is env²: 40·log10
    return peak + 40 * Math.log10(env / maxEnv)
  }, [])

  // Fit the meta line on one line (see META_TRIMS), again whenever its width
  // changes (rotation, window resize) or the fonts arrive.
  const metaRef = useRef(null)
  useLayoutEffect(() => {
    const meta = metaRef.current
    if (!meta) return undefined
    const wraps = () => {
      const pieces = [meta.querySelector('.deck__nick'), ...meta.querySelectorAll('.deck__stamp > span')]
        .filter(piece => piece && piece.offsetWidth > 0)
      return pieces.some(piece => piece.offsetTop > pieces[0].offsetTop + 6)
    }
    const fit = () => {
      for (let level = 0; level <= META_TRIMS.length; level++) {
        meta.classList.remove(...META_TRIMS)
        meta.classList.add(...META_TRIMS.slice(0, level))
        if (!wraps()) return
      }
      meta.classList.remove(...META_TRIMS)
    }
    fit()
    let alive = true
    let width = meta.offsetWidth
    document.fonts?.ready?.then(() => { if (alive) fit() })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (meta.offsetWidth === width) return
      width = meta.offsetWidth
      fit()
    })
    observer?.observe(meta)
    return () => {
      alive = false
      observer?.disconnect()
    }
  }, [id, name, isOwn, ordinal?.n, ordinal?.total, phase])

  // Swipe the deck sideways for the next fart (touch only). The rest of the
  // deck stays usable: sideways scrolling keys and the waveform are left alone.
  const deckRef = useRef(null)
  const swipeRef = useRef(null)
  const swallowClickRef = useRef(false)
  const onPointerDown = event => {
    if (event.pointerType === 'mouse' || event.target.closest('.siblings__scroll, .wtrack__bars')) return
    swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), dx: 0 }
  }
  const onPointerMove = event => {
    const swipe = swipeRef.current
    if (!swipe || swipe.id !== event.pointerId) return
    const dx = event.clientX - swipe.x
    const dy = event.clientY - swipe.y
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      swipeRef.current = null
      if (deckRef.current) deckRef.current.style.transform = ''
      return
    }
    swipe.dx = dx
    // A little give under the finger, like a sprung panel
    if (deckRef.current && Math.abs(dx) > 8) {
      deckRef.current.classList.add('is-swiping')
      deckRef.current.style.transform = `translate3d(${Math.max(-28, Math.min(28, dx * 0.22)).toFixed(1)}px,0,0)`
    }
  }
  const endSwipe = event => {
    const swipe = swipeRef.current
    swipeRef.current = null
    if (deckRef.current) {
      deckRef.current.classList.remove('is-swiping')
      deckRef.current.style.transform = ''
    }
    if (!swipe || swipe.id !== event.pointerId || event.type === 'pointercancel') return
    const dy = event.clientY - swipe.y
    const quick = performance.now() - swipe.t < 700
    if (quick && Math.abs(swipe.dx) > 56 && Math.abs(swipe.dx) > Math.abs(dy) * 1.8) {
      swallowClickRef.current = true
      setTimeout(() => { swallowClickRef.current = false }, 0)
      if (swipe.dx < 0) onNext?.()
      else onPrev?.()
    }
  }
  const onClickCapture = event => {
    if (!swallowClickRef.current) return
    swallowClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const measuring = failed ? 'failed' : 'loading'
  const canDelete = Boolean(isOwn && onDelete)
  const onDeleteKey = async () => {
    if (deleteState === 'busy') return
    if (deleteState !== 'armed') {
      setDeleteState('armed')
      return
    }
    setDeleteState('busy')
    try {
      await onDelete?.(recording)
    } finally {
      setDeleteState(state => (state === 'busy' ? 'idle' : state))
    }
  }

  return (
    <article
      ref={deckRef}
      className="rcard deck"
      aria-label={`Fart from ${place.full}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onClickCapture={onClickCapture}
    >
      {/* Two halves: stacked on phones, side by side on a phone held sideways */}
      <div className="deck__side deck__side--a">
        <header className="deck__head">
          <div className="deck__id">
            <PlaceName text={place.title} className="deck__place" />
            <div className="deck__where">
              {region && <span className="deck__region" title={place.subtitle || undefined}>{region}</span>}
              {coords && <span className="deck__coords">{coords}</span>}
            </div>
          </div>
          <button type="button" className="key deck__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} strokeWidth={2} />
          </button>
        </header>

        <div className={`well deck__display ${withVu ? 'has-vu' : ''}`}>
          {withVu && <VuMeter size="sm" getDb={getDb} active={playing} lit={peakKnown} className="deck__vu" />}
          <WaveTrack
            key={id}
            id={id}
            src={src}
            peaks={analysis?.peaks || null}
            duration={analysis?.duration ?? null}
            startAt={analysis?.trimStart || 0}
            endAt={analysis?.trimEnd ?? null}
            soundStart={soundStart}
            soundLength={lengthKnown ? duration : null}
            loading={!analysis && !failed}
            failed={failed}
            bars={withVu ? 44 : 56}
            className="deck__track"
          />
        </div>
        {error && (
          <div className="deck__error" role="status">
            <span className="led led--sodium" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>

      <div className="deck__side deck__side--b">
        <div className="deck__row">
          <PlayKey id={id} src={src} duration={analysis?.duration ?? null} label={`Play the fart from ${place.title}`} />
          <dl className="deck__readings">
            <Reading
              label="Length"
              state={lengthKnown ? 'ready' : measuring}
              value={lengthKnown ? formatLength(duration) : '-.--'}
              detail={' '}
              flashKey={`${id}:${duration}`}
            />
            <Reading
              label="Peak"
              state={peakKnown ? 'ready' : measuring}
              value={peakKnown ? formatDb(peakDb) : '-- dB'}
              detail={loudnessWord(peakDb)?.toUpperCase()}
              flashKey={`${id}:${peakDb}`}
            />
            <Reading
              label="Pitch"
              state={analysis ? 'ready' : measuring}
              value={analysis ? (note ? <span className="note-name">{note}</span> : 'NONE') : '--'}
              detail={analysis ? (note ? `${Math.round(pitchHz)} Hz` : 'ALL AIR') : ''}
              flashKey={`${id}:pitch`}
            />
          </dl>
        </div>

        <div ref={metaRef} className="deck__meta">
          {name && <span className="tag deck__nick">{name}</span>}
          <span className="deck__stamp">
            {ordinal && <span className="deck__ordinal">No. {ordinal.n} of {ordinal.total}</span>}
            <span className="deck__posted">
              {whenPosted(recording.timestamp)}
            </span>
            {phase && <span className="deck__phase">{phase}</span>}
            {isOwn && <span className="deck__yours">Yours</span>}
          </span>
        </div>

        {siblings && (
          <SiblingKeys
            events={siblings}
            selectedId={id}
            onSelect={event => onSelectRecording?.(event)}
          />
        )}

        <div className={`deck__keys ${canDelete ? 'has-delete' : ''}`}>
          <button type="button" className="key deck__step" onClick={onPrev} aria-label="Newer fart" title={canDelete ? 'Newer' : undefined}>
            <Glyph name="left" size={12} />
            <span className="deck__step-word">Newer</span>
          </button>
          <button type="button" className="key deck__shuffle" onClick={onShuffle} aria-label="Random fart" title="Random">
            <Icon name="shuffle" size={19} strokeWidth={1.9} />
          </button>
          <button type="button" className="key deck__share" onClick={() => onShare?.(recording, place)} aria-label="Share this fart">
            Share
          </button>
          {canDelete && (
            <button
              type="button"
              className={`key deck__delete is-${deleteState}`}
              onClick={onDeleteKey}
              disabled={deleteState === 'busy'}
              aria-label={deleteState === 'armed' ? 'Confirm: delete this fart' : deleteState === 'busy' ? 'Deleting this fart' : 'Delete this fart'}
            >
              <span className={`led ${deleteState === 'armed' ? 'is-blink' : ''}`} aria-hidden="true" />
              <span>{deleteState === 'armed' ? 'Confirm' : deleteState === 'busy' ? 'Deleting' : 'Delete'}</span>
            </button>
          )}
          <button type="button" className="key deck__step" onClick={onNext} aria-label="Older fart" title={canDelete ? 'Older' : undefined}>
            <span className="deck__step-word">Older</span>
            <Glyph name="right" size={12} />
          </button>
        </div>
      </div>
      <span className="sr-only" role="status">
        {deleteState === 'armed' ? 'Press delete again to remove this fart.' : deleteState === 'busy' ? 'Deleting.' : ''}
      </span>
    </article>
  )
}
