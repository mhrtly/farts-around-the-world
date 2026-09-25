import { memo } from 'react'

// Slanted seven-segment digits drawn in SVG (not a font). Unlit segments are
// always drawn as a faint ghost "8", like a real display. Segments switch on
// instantly and decay when they switch off (see .seg in instrument.css).

const SEGMENTS = {
  a: 'M6 2 L34 2 L29 8 L11 8 Z',
  b: 'M35 3 L35 33 L30 30 L30 9 Z',
  c: 'M35 37 L35 67 L30 61 L30 40 Z',
  d: 'M6 68 L34 68 L29 62 L11 62 Z',
  e: 'M5 37 L10 40 L10 61 L5 67 Z',
  f: 'M5 3 L10 9 L10 30 L5 33 Z',
  g: 'M7 35 L11 31.5 L29 31.5 L33 35 L29 38.5 L11 38.5 Z',
}
const KEYS = Object.keys(SEGMENTS)
const GLYPHS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
  6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '',
}
const DIGIT_W = 44
const DOT_W = 8

function SevenSeg({ value = '', tone = 'phosphor', height = 50, className = '', label }) {
  const text = String(value)
  const cells = []
  let x = 6
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '.') {
      // The decimal point belongs to the previous digit's cell
      cells.push(<circle key={`dot${i}`} cx={x - 3} cy={66} r={3.2} />)
      x += DOT_W - 2
      continue
    }
    const lit = GLYPHS[ch] ?? ''
    cells.push(
      <g key={i} transform={`translate(${x},0) skewX(-7)`}>
        {KEYS.map(segment => (
          <path key={segment} d={SEGMENTS[segment]} className={lit.includes(segment) ? undefined : 'is-off'} />
        ))}
      </g>,
    )
    x += DIGIT_W
  }
  const width = x + 2
  return (
    <svg
      className={`seg seg--${tone} ${className}`}
      viewBox={`0 0 ${width} 72`}
      height={height}
      width={(width / 72) * height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {cells}
    </svg>
  )
}

export default memo(SevenSeg)
