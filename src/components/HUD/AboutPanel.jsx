import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'

export default function AboutPanel({ open, onClose, onRecord }) {
  return (
    <Sheet open={open} onClose={onClose} variant="about" label="About Farts Around the World" modal>
      <div className="about">
        <header className="about__head">
          <h2>What is this?</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <p className="about__lead">
          A map of real fart recordings from real places. That's it. That's the site.
        </p>
        <ol className="about__steps">
          <li><strong>Record one.</strong> Up to 10 seconds, straight from your phone or laptop mic.</li>
          <li><strong>It gets pinned</strong> to the map where you are, rounded to about a kilometer so nobody finds your house.</li>
          <li><strong>Anyone can listen.</strong> Tap a glowing dot anywhere on Earth and hear what happened there.</li>
        </ol>
        <p className="about__note">
          Length, loudness, and pitch are measured from the actual audio. Yes, some farts are in tune.
          Posted one by mistake? Open its card on the same device and hit Delete.
        </p>
        <p className="about__keys">
          Keyboard: <kbd>R</kbd> record · <kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> hop between farts · <kbd>Esc</kbd> close
        </p>
        <button type="button" className="big-button big-button--record" onClick={() => { onClose(); onRecord() }}>
          <Icon name="mic" size={20} /> Record a fart
        </button>
        <p className="about__credit">A Potato Propoganda production.</p>
      </div>
    </Sheet>
  )
}
