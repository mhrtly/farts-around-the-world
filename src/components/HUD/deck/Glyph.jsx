// Screen-printed key glyphs. Drawn in SVG rather than with ◀ ▶ characters,
// which iOS turns into emoji.

const SHAPES = {
  play: <path d="M3.5 1.6v12.8a.7.7 0 0 0 1.05.6l10.6-6.4a.7.7 0 0 0 0-1.2L4.55 1a.7.7 0 0 0-1.05.6Z" />,
  pause: <><rect x="3" y="1.5" width="3.8" height="13" rx=".6" /><rect x="9.2" y="1.5" width="3.8" height="13" rx=".6" /></>,
  left: <path d="M11 3.2v9.6a.5.5 0 0 1-.78.42L3.6 8.42a.5.5 0 0 1 0-.84l6.62-4.8A.5.5 0 0 1 11 3.2Z" />,
  right: <path d="M5 3.2v9.6a.5.5 0 0 0 .78.42l6.62-4.8a.5.5 0 0 0 0-.84L5.78 2.78A.5.5 0 0 0 5 3.2Z" />,
}

export default function Glyph({ name, size = 16, className = '' }) {
  return (
    <svg
      className={`glyph glyph--${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  )
}
