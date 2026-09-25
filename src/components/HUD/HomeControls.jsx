import Icon from './Icon.jsx'

// The home screen's main actions: a thumb dock on phones, a floating record
// button on desktop. Recording is the headline action on both.
export default function HomeControls({ compact, hidden, canShuffle, onRecord, onList, onShuffle }) {
  if (compact) {
    return (
      <nav className={`dock ${hidden ? 'is-hidden' : ''}`} aria-label="Actions">
        <button type="button" className="dock__side" onClick={onList}>
          <Icon name="list" size={22} />
          <span>Latest</span>
        </button>
        <button type="button" className="dock__rec" onClick={onRecord} aria-label="Record a fart">
          <span className="dock__rec-ring" aria-hidden="true" />
          <span className="dock__rec-core" aria-hidden="true" />
        </button>
        <button type="button" className="dock__side" onClick={onShuffle} disabled={!canShuffle}>
          <Icon name="shuffle" size={22} />
          <span>Random</span>
        </button>
      </nav>
    )
  }

  return (
    <div className="record-cta-wrap">
      <button type="button" className="record-cta" onClick={onRecord}>
        <span className="record-cta__dot" aria-hidden="true" />
        Record a fart
        <kbd>R</kbd>
      </button>
      <button type="button" className="shuffle-cta" onClick={onShuffle} disabled={!canShuffle} title="Play a random fart">
        <Icon name="shuffle" size={18} /> Random
      </button>
    </div>
  )
}

export function Hint({ compact, onDismiss }) {
  return (
    <div className="hint" role="status">
      <span className="hint__dot" aria-hidden="true" />
      {compact ? 'Tap' : 'Click'} a glowing dot to hear a real fart
      <button type="button" className="hint__close" onClick={onDismiss} aria-label="Dismiss hint">
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
