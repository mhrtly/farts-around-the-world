import Sheet from './Sheet.jsx'
import Icon from './Icon.jsx'
import { LOUDNESS_BANDS } from '../../utils/recordings.js'

const minus = value => String(value).replace('-', '−')

export default function AboutPanel({ open, onClose, onRecord }) {
  return (
    <Sheet open={open} onClose={onClose} variant="about" label="About Farts Around the World" modal>
      <div className="about">
        <header className="about__plate">
          <span className="about__nameplate">
            <span className="about__lamp" aria-hidden="true" />
            <span className="plate-title">Farts Around the World</span>
          </span>
          <button type="button" className="key key--sm about__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} strokeWidth={2} />
          </button>
        </header>

        <h2 className="about__title">What is this?</h2>
        <p className="about__lead">
          A map of real fart recordings from real places. That's it. That's the site.
        </p>

        <ol className="about__steps">
          <li>
            <span className="about__step-no" aria-hidden="true">1</span>
            <p><strong>Record one.</strong> Up to 10 seconds, straight from your phone or laptop mic.</p>
          </li>
          <li>
            <span className="about__step-no" aria-hidden="true">2</span>
            <p><strong>It gets pinned</strong> to the map where you are, rounded to about a kilometer so nobody finds your house.</p>
          </li>
          <li>
            <span className="about__step-no" aria-hidden="true">3</span>
            <p><strong>Anyone can listen.</strong> Tap a glowing dot anywhere on Earth and hear what happened there.</p>
          </li>
        </ol>

        <section className="about__section" aria-labelledby="about-measure">
          <h3 id="about-measure" className="about__label">What gets measured</h3>
          <p className="about__note">
            Length, loudness and pitch come from the actual audio. Yes, some farts are in tune.
            The loudness word is the peak level, in decibels below the loudest your mic can capture:
          </p>
          <div className="about__scale" role="img" aria-label={LOUDNESS_BANDS.map((band, index) => (
            index === 0 ? `${band.word} below ${band.max} dB`
              : band.max === Infinity ? `${band.word} above ${LOUDNESS_BANDS[index - 1].max} dB`
                : `${band.word} up to ${band.max} dB`
          )).join(', ')}
          >
            {LOUDNESS_BANDS.map(band => (
              <span key={band.word} className="about__band">
                <span className="about__band-word">{band.word}</span>
                {band.max !== Infinity && <span className="about__band-edge">{minus(band.max)}</span>}
              </span>
            ))}
          </div>
        </section>

        <p className="about__note">
          Posted one by mistake? Open its card on the same device and press Delete.
        </p>

        <section className="about__section about__keys" aria-labelledby="about-keys">
          <h3 id="about-keys" className="about__label">Keyboard</h3>
          <dl className="about__keylist">
            <div><dt><kbd>R</kbd></dt><dd>Record</dd></div>
            <div><dt><kbd>Space</kbd></dt><dd>Play / pause</dd></div>
            <div><dt><kbd aria-label="Left arrow">←</kbd><kbd aria-label="Right arrow">→</kbd></dt><dd>Newer / older</dd></div>
            <div><dt><kbd>+</kbd><kbd aria-label="Minus">−</kbd></dt><dd>Zoom in / out</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Close</dd></div>
          </dl>
        </section>

        {/* The recorder arms the mic inside this click, so no extra tap is needed */}
        <button type="button" className="key-ceramic about__record" onClick={() => onRecord()}>
          <span className="rec-dot" aria-hidden="true" />
          Record a fart
        </button>

        <p className="about__credit">A Potato Propaganda production</p>
        <p className="about__credit about__credit--data">Night lights up close: NASA Black Marble (VIIRS), via NASA GIBS</p>
      </div>
    </Sheet>
  )
}
